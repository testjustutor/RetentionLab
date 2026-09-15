/**
 * root/models/reviews/TutorEvaluationModel.js
 *
 * Stores the tutor-evaluation review-calculation values documented in
 * review_calculation_logic.txt:
 *   - per-category Met / Not Met / Not Applicable counts
 *   - per-category score (%)
 *   - category weightage snapshot (weight / cat_score)
 *   - overall final score (%)
 *   - red_flag
 *
 * Two normalized tables:
 *   tutor_evaluation_summary        -> one row per (session, reviewer, flow)
 *   tutor_evaluation_category_score -> one row per category per summary
 */
const { db } = require('../../database/db');
const { logger } = require('../../utils/logger');

class TutorEvaluationModel {
  /**
   * Upsert a full review summary (parent + category rows).
   * Replaces the category rows for the matched (session, reviewer, flow).
   * @param {Object} payload
   *   {
   *     session_id: number,
   *     reviewer_id: number|null,
   *     flow: 'submit'|'update',
   *     total_criteria_all: number,
   *     final_score_pct: number,
   *     red_flag: 0|1,
   *     categories: Array<{
   *       category_id, category_code, category_name, weight,
   *       total_criteria, count_met, count_not_met,
   *       count_not_applicable, category_score_pct
   *     }>
   *   }
   */
  static upsertReview(payload) {
    return new Promise((resolve, reject) => {
      const categories = Array.isArray(payload.categories) ? payload.categories : [];

      const upsertSql = `
        INSERT INTO tutor_evaluation_summary
          (session_id, reviewer_id, flow, total_criteria_all, final_score_pct, red_flag, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON DUPLICATE KEY UPDATE
          flow = VALUES(flow),
          total_criteria_all = VALUES(total_criteria_all),
          final_score_pct = VALUES(final_score_pct),
          red_flag = VALUES(red_flag),
          updated_at = CURRENT_TIMESTAMP
      `;

      const upsertParams = [
        payload.session_id,
        payload.reviewer_id || null,
        payload.flow || 'submit',
        payload.total_criteria_all || 0,
        payload.final_score_pct || 0,
        payload.red_flag ? 1 : 0
      ];

      db.run(upsertSql, upsertParams, (err) => {
        if (err) {
          logger.error('[TutorEvaluationModel] upsertReview parent error', err);
          return reject(err);
        }

        // Resolve the summary id (mysql2 insertId is unreliable after an
        // ON DUPLICATE KEY UPDATE path).
        const findSql = `
          SELECT id FROM tutor_evaluation_summary
          WHERE session_id = ? AND reviewer_id <=> ? AND flow = ?
          LIMIT 1
        `;
        const findParams = [
          payload.session_id,
          payload.reviewer_id || null,
          payload.flow || 'submit'
        ];

        db.get(findSql, findParams, (findErr, row) => {
          if (findErr) {
            logger.error('[TutorEvaluationModel] upsertReview find summary error', findErr);
            return reject(findErr);
          }
          if (!row) {
            return reject(new Error('Failed to resolve tutor_evaluation_summary id after upsert'));
          }

          const summaryId = row.id;
          const deleteSql = `DELETE FROM tutor_evaluation_category_score WHERE summary_id = ?`;

          db.run(deleteSql, [summaryId], (delErr) => {
            if (delErr) {
              logger.error('[TutorEvaluationModel] upsertReview delete category rows error', delErr);
              return reject(delErr);
            }

            if (categories.length === 0) {
              return resolve({ id: summaryId, categoriesInserted: 0 });
            }

            const insertSql = `
              INSERT INTO tutor_evaluation_category_score
                (summary_id, category_id, category_code, category_name, weight,
                 total_criteria, count_met, count_not_met, count_not_applicable, category_score_pct)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            let completed = 0;
            const errors = [];
            const results = [];

            categories.forEach((cat, index) => {
              const catParams = [
                summaryId,
                cat.category_id || null,
                cat.category_code || null,
                cat.category_name || '',
                cat.weight || 0,
                cat.total_criteria || 0,
                cat.count_met || 0,
                cat.count_not_met || 0,
                cat.count_not_applicable || 0,
                cat.category_score_pct || 0
              ];

              db.run(insertSql, catParams, (insertErr) => {
                if (insertErr) {
                  errors.push({ index, category_id: cat.category_id, error: insertErr });
                } else {
                  results.push({ category_id: cat.category_id, inserted: true });
                }
                completed++;
                if (completed === categories.length) {
                  if (errors.length > 0) {
                    logger.error('[TutorEvaluationModel] upsertReview insert category rows errors', errors);
                  }
                  resolve({ id: summaryId, categoriesInserted: results.length, errors, total: categories.length });
                }
              });
            });
          });
        });
      });
    });
  }
  /**
   * Get a review summary for a session, with its category rows.
   * @param {number} sessionId
   * @param {Object} [options]
   *   { reviewerId?: number, flow?: 'submit'|'update' }
   * @returns {Promise<Object|null>} summary + categories
   */
  static getReviewBySession(sessionId, options = {}) {
    return new Promise((resolve, reject) => {
      const conditions = ['s.session_id = ?'];
      const params = [sessionId];

      if (options.reviewerId != null) {
        conditions.push('s.reviewer_id = ?');
        params.push(options.reviewerId);
      }
      if (options.flow) {
        conditions.push('s.flow = ?');
        params.push(options.flow);
      }

      const summarySql = `
        SELECT
          s.*,
          CONCAT(u.first_name, ' ', u.last_name) AS reviewer_name
        FROM tutor_evaluation_summary s
        LEFT JOIN users u ON u.id = s.reviewer_id
        WHERE ${conditions.join(' AND ')}
        ORDER BY s.updated_at DESC, s.id DESC
        LIMIT 1
      `;

      db.get(summarySql, params, (err, summary) => {
        if (err) {
          logger.error('[TutorEvaluationModel] getReviewBySession summary error', err);
          return reject(err);
        }
        if (!summary) return resolve(null);

        const catSql = `
          SELECT * FROM tutor_evaluation_category_score
          WHERE summary_id = ?
          ORDER BY id ASC
        `;

        db.all(catSql, [summary.id], (catErr, rows) => {
          if (catErr) {
            logger.error('[TutorEvaluationModel] getReviewBySession category error', catErr);
            return reject(catErr);
          }
          resolve({ ...summary, categories: rows || [] });
        });
      });
    });
  }

  /**
   * List sessions available to a reviewer (only meetings they've been assigned).
   * @param {number} reviewerId
   * @returns {Promise<Array>}
   */
  static getSessionsForReviewer(reviewerId) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT ms.id AS session_id,
               ms.meeting_id,
               m.external_meeting_id,
               m.title AS meeting_title,
               m.scheduled_start_time AS start_time,
               m.status AS meeting_status,
               ms.status AS session_status,
               mr.review_status
        FROM meeting_sessions ms
        JOIN meetings m ON m.id = ms.meeting_id
        JOIN meeting_reviewers mr ON mr.meeting_id = m.id AND mr.reviewer_id = ?
        ORDER BY ms.id DESC
      `;
      db.all(sql, [reviewerId], (err, rows) => {
        if (err) {
          logger.error('[TutorEvaluationModel] getSessionsForReviewer error', err);
          return reject(err);
        }
        resolve(rows || []);
      });
    });
  }

  /**
   * Rubric template for the scoring UI: categories (with weight snapshot)
   * + their indicators (criteria), both active only.
   * @returns {Promise<Array>} [{ id, category_code, name, weight, indicators: [] }]
   */
  static getRubricTemplate() {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT c.id AS category_id,
               c.category_code,
               c.name AS category_name,
               c.weight,
               i.id AS indicator_id,
               i.indicator_code,
               i.name AS indicator_name,
               i.type,
               i.is_gate
        FROM admin_rubric_categories c
        LEFT JOIN admin_rubric_indicators i ON i.admin_category_id = c.id
        WHERE c.status = 'active' AND (i.id IS NULL OR i.status = 'active')
        ORDER BY c.category_code, i.indicator_code
      `;
      db.all(sql, [], (err, rows) => {
        if (err) {
          logger.error('[TutorEvaluationModel] getRubricTemplate error', err);
          return reject(err);
        }
        const byCat = {};
        (rows || []).forEach((r) => {
          if (!byCat[r.category_id]) {
            byCat[r.category_id] = {
              id: r.category_id,
              category_code: r.category_code,
              name: r.category_name,
              weight: r.weight,
              indicators: []
            };
          }
          if (r.indicator_id) {
            byCat[r.category_id].indicators.push({
              id: r.indicator_id,
              indicator_code: r.indicator_code,
              name: r.indicator_name,
              type: r.type,
              is_gate: !!r.is_gate
            });
          }
        });
        resolve(Object.values(byCat));
      });
    });
  }

  /**
   * Resolve the internal meetings.id for a session. Used to mark the assigned
   * review complete after a summary is saved.
   * @param {number} sessionId
   * @returns {Promise<number|null>}
   */
  static getMeetingIdBySessionId(sessionId) {
    return new Promise((resolve, reject) => {
      db.get('SELECT meeting_id FROM meeting_sessions WHERE id = ?', [sessionId], (err, row) => {
        if (err) {
          logger.error('[TutorEvaluationModel] getMeetingIdBySessionId error', err);
          return reject(err);
        }
        resolve(row ? row.meeting_id : null);
      });
    });
  }

  /**
   * Mark the reviewer's assignment for a meeting as completed.
   * @param {number} meetingId - internal meetings.id
   * @param {number} reviewerId
   * @param {string|null} comments
   * @returns {Promise<{updated: boolean}>}
   */
  static markReviewCompleted(meetingId, reviewerId, comments = null) {
    return new Promise((resolve, reject) => {
      const sql = `
        UPDATE meeting_reviewers
        SET review_status = 'completed',
            reviewed_at = CURRENT_TIMESTAMP,
            comments = COALESCE(?, comments)
        WHERE meeting_id = ? AND reviewer_id = ?
      `;
      db.run(sql, [comments, meetingId, reviewerId], function (err) {
        if (err) {
          logger.error('[TutorEvaluationModel] markReviewCompleted error', err);
          return reject(err);
        }
        resolve({ updated: this.changes > 0 });
      });
    });
  }
}

module.exports = TutorEvaluationModel;