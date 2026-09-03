/**
 * controllers/reports/evaluationReportController.js
 * Business logic for evaluation reports dashboard.
 * Controllers never write SQL — all DB access goes through Models.
 */
const EvaluationReportModel = require('../../models/reports/EvaluationReportModel');
 

function ok(data, msg) { return { success: true, message: msg || null, ...(data || {}) }; }
function err(msg, code) { return { success: false, error: msg, statusCode: code || 500 }; }

const controller = {
  /**
   * GET /api/admin/evaluations/reports/summary
   * Accepts: from_date, to_date, instructor_id, active, days
   */
  async getSummary(req) {
    try {
      const { from_date, to_date, instructor_id, active, days } = req.body;
      const filters = { from_date, to_date, instructor_id, active, days };

      const [scores, meetings] = await Promise.all([
        EvaluationReportModel.getRecentScores(filters),
        EvaluationReportModel.getRecentMeetings(filters)
      ]);

      const aiScores = scores.filter(s => s.score_type === 'AI');
      const humanScores = scores.filter(s => s.score_type === 'HUMAN');

      const avgAi = aiScores.length
        ? (aiScores.reduce((sum, s) => sum + (+s.score || 0), 0) / aiScores.length).toFixed(1)
        : '0.0';
      const avgHuman = humanScores.length
        ? (humanScores.reduce((sum, s) => sum + (+s.score || 0), 0) / humanScores.length).toFixed(1)
        : '0.0';

      const rubricGroups = new Set(scores.map(s => s.category_id || s.rubric_id).filter(Boolean));
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
  },

  /**
   * GET /api/admin/evaluations/reports/instructors
   * Instructors who have evaluation scores (SQL lives in EvaluationReportModel).
   */
  async getInstructors(req) {
    try {
      const instructors = await EvaluationReportModel.getInstructors(req.user);
      return ok({ instructors });
    } catch (e) {
      return err(e.message);
    }
  }
};

module.exports = controller;
