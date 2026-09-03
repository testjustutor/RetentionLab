/**
 * controllers/reports/teamReportController.js
 * Business logic for the team performance report.
 * Controllers never write SQL - all DB access goes through Models.
 */
const TeamReportModel = require('../../models/reports/TeamReportModel');

function ok(data, msg) { return { success: true, message: msg || null, ...(data || {}) }; }
function err(msg, code) { return { success: false, error: msg, statusCode: code || 500 }; }

const controller = {
  /**
   * GET /api/admin/reports/teams/summary
   * Accepts query params: from_date, to_date, instructor_id
   */
  async getSummary(req) {
    try {
      const { from_date, to_date, instructor_id } = req.query;
      const result = await TeamReportModel.getTeamPerformance(req.user, { from_date, to_date, instructor_id });
      return ok(result);
    } catch (e) {
      return err(e.message);
    }
  },

  /**
   * GET /api/admin/reports/teams/instructors
   */
  async getInstructors(req) {
    try {
      const instructors = await TeamReportModel.getInstructors(req.user);
      return ok({ instructors });
    } catch (e) {
      return err(e.message);
    }
  }
};

module.exports = controller;
