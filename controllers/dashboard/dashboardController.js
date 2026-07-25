/**
 * controllers/dashboardController.js
 * Dashboard logic.
 */
const AdminModel = require('../../models/admin/AdminModel');

function ok(data, msg) { return { success: true, message: msg || null, ...(data || {}) }; }
function err(msg, code) { return { success: false, error: msg, statusCode: code || 500 }; }

const controller = {
  async getStats(req) {
    try {
      const stats = await AdminModel.getDashboardStats(req.user);
      return ok({ stats }, 'Dashboard stats fetched');
    } catch (e) {
      return err(e.message, 500);
    }
  }
};

module.exports = controller;
