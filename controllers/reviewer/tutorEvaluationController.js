/**
 * root/controllers/reviews/tutorEvaluationController.js
 *
 * Business logic for storing/reading tutor-evaluation review-calculation values.
 *
 * Calculation follows the canonical (intended) formula documented in
 * review_calculation_logic.txt, and mirrors services/engine/audit_scoring.py
 * (compute_category_score / compute_weighted_overall) so a session scored
 * manually by a reviewer here and a session scored by the AI pipeline
 * (services/engine/services/tutor_eval_worker.py, audit_service.py,
 * audit_worker.py) produce IDENTICAL numbers for the same inputs:
 *   - per-category score = Met / (Met + Not Applicable) x 100
 *   - all-Not-Applicable category -> 100%
 *   - zero/empty denominator -> 0%
 *   - final score = weighted average of category scores by each category's
 *     rubric `weight` (cat_score) field — NEVER by criteria count. A
 *     category with no weight configured (<= 0 / null) defaults to weight 1
 *     so it still counts, matching audit_scoring.py's fallback.
 *   - red_flag normalized to 0/1
 */
const TutorEvaluationModel = require('../../models/reviewer/TutorEvaluationModel');
const { logger } = require('../../utils/logger');

function ok(data, msg) {
  return { success: true, message: msg || null, ...(data || {}) };
}

function err(msg, statusCode) {
  return { success: false, error: msg, statusCode: statusCode || 500 };
}

function toInt(value) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : 0;
}

function toNum(value) {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Canonical per-category score.
 * @returns {number} 0..100 rounded to 2 decimals
 */
function computeCategoryScore(countMet, countNotMet, countNotApplicable, totalCriteria) {
  if (totalCriteria > 0 && countNotApplicable === totalCriteria) return 100;

  const denominator = totalCriteria - countNotMet; // exclude Not Met
  if (denominator > 0) {
    return Math.round((countMet / denominator) * 10000) / 100;
  }
  return 0;
}

/**
 * Canonical final score: weighted average of category scores by each
 * category's rubric weight (cat_score) — NEVER by criteria count.
 * Mirrors services/engine/audit_scoring.py's compute_weighted_overall,
 * including the "unweighted category defaults to weight 1" fallback used in
 * services/engine/services/tutor_eval_worker.py's _compute_percentages, so
 * the manual-review and AI-review paths always agree.
 * @param {Array<{category_score_pct, weight, total_criteria}>} categories
 */
function computeFinalScore(categories) {
  let totalWeighted = 0;
  let totalWeight = 0;
  let totalCriteriaAll = 0;

  categories.forEach((cat) => {
    totalCriteriaAll += Math.max(0, toInt(cat.total_criteria));

    let weight = toNum(cat.weight);
    if (weight <= 0) weight = 1; // no rubric weight configured -> still counts (matches audit_scoring.py)

    totalWeighted += toNum(cat.category_score_pct) * weight;
    totalWeight += weight;
  });

  if (totalWeight <= 0) return { finalScorePct: 0, totalCriteriaAll };
  return {
    finalScorePct: Math.round((totalWeighted / totalWeight) * 100) / 100,
    totalCriteriaAll
  };
}

function normalizeRedFlag(value) {
  if (value === true || value === 1 || value === '1' || value === 'on' || value === 'true') return 1;
  return 0;
}

const controller = {
  /** POST /api/tutor-evaluation/summary — Save a tutor-evaluation calculation summary */
  async saveReview(req, res) {
    try {
      const body = req.body || {};
      const sessionId = toInt(body.session_id);
      if (!sessionId) {
        return res.status(400).json(err('session_id is required', 400));
      }

      const rawCategories = Array.isArray(body.categories) ? body.categories : [];
      if (rawCategories.length === 0) {
        return res.status(400).json(err('categories[] is required', 400));
      }

      const reviewerId = body.reviewer_id != null && body.reviewer_id !== ''
        ? toInt(body.reviewer_id)
        : req.user.id;
      const flow = body.flow === 'update' ? 'update' : 'submit';

      const categories = rawCategories.map((cat) => {
        const totalCriteria = Math.max(0, toInt(cat.total_criteria));
        const countMet = Math.max(0, toInt(cat.count_met));
        const countNotMet = Math.max(0, toInt(cat.count_not_met));
        const countNotApplicable = Math.max(0, toInt(cat.count_not_applicable));

        return {
          category_id: cat.category_id != null && cat.category_id !== '' ? toInt(cat.category_id) : null,
          category_code: cat.category_code || null,
          category_name: cat.category_name || cat.category || '',
          weight: toNum(cat.weight),
          total_criteria: totalCriteria,
          count_met: countMet,
          count_not_met: countNotMet,
          count_not_applicable: countNotApplicable,
          category_score_pct: computeCategoryScore(countMet, countNotMet, countNotApplicable, totalCriteria)
        };
      });

      const { finalScorePct, totalCriteriaAll } = computeFinalScore(categories);
      const redFlag = normalizeRedFlag(body.red_flag);

      const result = await TutorEvaluationModel.upsertReview({
        session_id: sessionId,
        reviewer_id: reviewerId,
        flow,
        total_criteria_all: totalCriteriaAll,
        final_score_pct: finalScorePct,
        red_flag: redFlag,
        categories
      });

      // If this session belongs to a meeting the reviewer is assigned to,
      // mark the assignment completed so it drops out of the review queue.
      let reviewCompleted = false;
      let meetingId = body.meeting_id != null && body.meeting_id !== ''
        ? toInt(body.meeting_id)
        : await TutorEvaluationModel.getMeetingIdBySessionId(sessionId);
      if (meetingId) {
        try {
          const upd = await TutorEvaluationModel.markReviewCompleted(meetingId, reviewerId);
          reviewCompleted = upd.updated;
        } catch (e) {
          logger.warn('[tutorEvaluationController] Could not mark review completed', e);
        }
      }

      res.status(201).json(ok({
        id: result.id,
        session_id: sessionId,
        reviewer_id: reviewerId,
        meeting_id: meetingId,
        flow,
        total_criteria_all: totalCriteriaAll,
        final_score_pct: finalScorePct,
        red_flag: redFlag,
        review_completed: reviewCompleted,
        categories
      }, reviewCompleted ? 'Review saved and marked complete.' : 'Review summary saved successfully.'));
    } catch (e) {
      res.status(500).json(err(e.message));
    }
  },

  /** GET /api/tutor-evaluation/summary/:sessionId — Fetch a saved summary for a session */
  async getReview(req, res) {
    try {
      const sessionId = toInt(req.params.sessionId);
      if (!sessionId) {
        return res.status(400).json(err('sessionId is required', 400));
      }

      const options = {};
      if (req.query.reviewer_id != null && req.query.reviewer_id !== '') {
        options.reviewerId = toInt(req.query.reviewer_id);
      }
      if (req.query.flow) {
        options.flow = req.query.flow === 'update' ? 'update' : 'submit';
      }

      const review = await TutorEvaluationModel.getReviewBySession(sessionId, options);
      // "No saved summary yet" is an expected state on a fresh scoring form — return 200
      // with a null summary (not 404) so the browser console stays clean. The UI already
      // treats a falsy summary as "no record".
      if (!review) {
        return res.json(ok({ summary: null, categories: [] }, 'No saved summary for this session yet.'));
      }

      res.json(ok({ summary: review, categories: review.categories }, 'Review summary loaded.'));
    } catch (e) {
      res.status(500).json(err(e.message));
    }
  },
  /** GET /api/tutor-evaluation/sessions — Sessions assigned to the reviewer for the scoring UI */
  async getSessions(req, res) {
    try {
      const sessions = await TutorEvaluationModel.getSessionsForReviewer(req.user.id);
      res.json(ok({ sessions }));
    } catch (e) { res.status(500).json(err(e.message)); }
  },

  /** GET /api/tutor-evaluation/rubric — Rubric template (categories + criteria) for the scoring UI */
  async getRubric(req, res) {
    try {
      const categories = await TutorEvaluationModel.getRubricTemplate();
      res.json(ok({ categories }));
    } catch (e) { res.status(500).json(err(e.message)); }
  }
};

module.exports = controller;