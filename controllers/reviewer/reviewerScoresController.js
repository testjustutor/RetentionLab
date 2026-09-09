/**
 * root/controllers/reviewers/reviewerScoresController.js
 * Business logic for the reviewer scores report page.
 * Only the logged-in reviewer's own scores are returned.
 */
const ReviewerScoresModel = require('../../models/reviewer/ReviewerScoresModel');

function ok(data, msg) { return { success: true, message: msg || null, ...(data || {}) }; }
function err(msg, code) { return { success: false, error: msg, statusCode: code || 500 }; }

const controller = {
  /** GET /api/reviewer-scores/filter-options — Meetings + sessions for the reviewer's filters */
  async getFilterOptions(req) {
    try {
      const reviewerId = req.user.id;
      const options = await ReviewerScoresModel.getFilterOptions(reviewerId);
      return ok({ meetings: options.meetings, sessions: options.sessions });
    } catch (e) { return err(e.message); }
  },

  /** GET /api/reviewer-scores/report — Scores saved by the current reviewer, with filters */
  async getReport(req) {
    try {
      const reviewerId = req.user.id;
      const { from_date, to_date, meeting_id, session_id } = req.query || {};
      const result = await ReviewerScoresModel.getReport(reviewerId, {
        from_date: from_date || '',
        to_date: to_date || '',
        meeting_id: meeting_id || '',
        session_id: session_id || ''
      });
      return ok({ rows: result.rows, summary: result.summary }, result.rows.length ? 'Report loaded.' : 'No scores found for the selected filters.');
    } catch (e) { return err(e.message); }
  }
};

module.exports = controller;