/**
 * controllers/settings/notificationSettingsController.js
 * Business logic for notification preferences (admin/instructor/reviewer).
 * Controllers never write SQL - all DB access goes through Models.
 */
const NotificationSettingsModel = require('../../models/settings/NotificationSettingsModel');

function ok(data, msg) { return { success: true, message: msg || null, ...(data || {}) }; }
function err(msg, code) { return { success: false, error: msg, statusCode: code || 500 }; }

const controller = {
  /**
   * GET /api/admin/settings/notifications
   */
  async get(req) {
    try {
      const [settings, roleCounts] = await Promise.all([
        NotificationSettingsModel.getSettings(req.user),
        NotificationSettingsModel.getRoleCounts(req.user)
      ]);
      return ok({ settings, roleCounts });
    } catch (e) {
      return err(e.message);
    }
  },

  /**
   * PUT /api/admin/settings/notifications
   */
  async update(req) {
    try {
      if (!req.user.company_id) return err('No organization linked to this account', 400);
      const settings = req.body && req.body.settings ? req.body.settings : {};
      const updated = await NotificationSettingsModel.updateSettings(req.user, settings);
      return ok({ updated }, 'Notification settings saved');
    } catch (e) {
      return err(e.message);
    }
  }
};

module.exports = controller;