/**
 * controllers/super_admin/superAdminController.js
 * Business logic for the Super Admin panel (MVC Controller layer).
 * No SQL here — all data access lives in models.
 */
const SuperAdminModel = require('../../models/super_admin/SuperAdminModel');

function ok(data, msg) { return { success: true, message: msg || null, ...(data || {}) }; }
function err(msg, code) { return { success: false, error: msg, statusCode: code || 500 }; }

const controller = {
  /**
   * GET /api/super_admin/ping
   * Simple health check confirming the Super Admin MVC scaffold is mounted.
   */
  async ping(req) {
    try {
      return ok({ status: 'ok', role: (req.user && req.user.role_name) || null, service: 'super-admin', time: new Date().toISOString() });
    } catch (e) {
      return err(e.message);
    }
  },

  /**
   * GET /api/super_admin/users-by-company
   * Example endpoint demonstrating the Controller -> Model flow.
   */
  async usersByCompany(req) {
    try {
      const roleName = req.query.role || null;
      const rows = await SuperAdminModel.countUsersByCompany(roleName);
      return ok({ rows, count: rows.length });
    } catch (e) {
      return err(e.message);
    }
  },

  /**
   * Deprecated Sidebar Menu Admin endpoints.
   * They no longer contain logic in the route file; the controller owns
   * the (static) response so routes stay thin.
   */
  async deprecatedMenu(req, res) {
    return { success: false, statusCode: 400, error: 'This endpoint is deprecated. Use /api/menu/admin/menu-permissions' };
  }
};

module.exports = controller;