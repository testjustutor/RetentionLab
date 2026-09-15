/**
 * controllers/student/studentController.js
 * Business logic for the Student portal (MVC Controller layer).
 * No SQL here — all data access lives in models.
 * Mirrors controllers/super_admin/superAdminController.js.
 */
const StudentModel = require('../../models/student/StudentModel');

function ok(data, msg) { return { success: true, message: msg || null, ...(data || {}) }; }
function err(msg, code) { return { success: false, error: msg, statusCode: code || 500 }; }

const controller = {
  /**
   * GET /api/student/ping
   * Simple health check confirming the Student MVC scaffold is mounted.
   */
  async ping(req) {
    try {
      await StudentModel.ping();
      return ok({ status: 'ok', role: (req.user && req.user.role_name) || null, service: 'student', time: new Date().toISOString() });
    } catch (e) {
      return err(e.message);
    }
  }
};

module.exports = controller;
