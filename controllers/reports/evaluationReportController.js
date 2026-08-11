/**
 * controllers/evaluationReportController.js
 * Business logic for evaluation reports dashboard.
 */

const EvaluationReportModel = require('../../models/reports/EvaluationReportModel');

function ok(data, msg) { return { success: true, message: msg || null, ...(data || {}) }; }
function err(msg, code) { return { success: false, error: msg, statusCode: code || 500 }; }

const controller = {
  /**
   * GET /api/evaluations/reports/summary
   * Returns evaluation statistics for the reports dashboard
   */
  async getSummary(req) {
    try {
      const days = parseInt(req.query.days) || 30;
      const companyId = req.user?.company_id;

      // Get scores with meeting and reviewer info
      const scores = await EvaluationReportModel.getRecentScores(days);

      // Get meetings list
      const meetings = await EvaluationReportModel.getRecentMeetings(days);

      // Calculate stats
      const aiScores = scores.filter(s => s.score_type === 'AI');
      const humanScores = scores.filter(s => s.score_type === 'HUMAN');

      const avgAi = aiScores.length ? (aiScores.reduce((sum, s) => sum + (+s.score || 0), 0) / aiScores.length).toFixed(1) : '0.0';
      const avgHuman = humanScores.length ? (humanScores.reduce((sum, s) => sum + (+s.score || 0), 0) / humanScores.length).toFixed(1) : '0.0';

      // Count unique rubrics/categories
      const rubricGroups = new Set(scores.map(s => s.category_id || s.rubric_id).filter(Boolean));

      // Count unique reviewers
      const reviewerIds = new Set(scores.map(s => s.reviewer_id).filter(Boolean));

      return ok({
        scores,
        meetings,
        stats: {
          totalMeetings: meetings.length,
          totalScores: scores.length,
          avgAiScore: avgAi,
          avgHumanScore: avgHuman,
          totalRubrics: rubricGroups.size,
          totalReviewers: reviewerIds.size
        }
      });
    } catch (e) {
      return err(e.message);
    }
  }
};

module.exports = controller;
