/**
 * controllers/settings/meetingSettingsController.js
 * Business logic for the meetings settings page.
 * Controllers never write SQL - all DB access goes through Models.
 */
const MeetingSettingsModel = require('../../models/settings/MeetingSettingsModel');

function ok(data, msg) { return { success: true, message: msg || null, ...(data || {}) }; }
function err(msg, code) { return { success: false, error: msg, statusCode: code || 500 }; }

const controller = {
  /**
   * GET /api/admin/settings/meetings
   */
  async get(req) {
    try {
      const [settings, stats] = await Promise.all([
        MeetingSettingsModel.getSettings(req.user),
        MeetingSettingsModel.getStats(req.user)
      ]);
      return ok({ settings, stats });
    } catch (e) {
      return err(e.message);
    }
  },

  /**
   * PUT /api/admin/settings/meetings
   */
  async update(req) {
    try {
      if (!req.user.company_id) return err('No organization linked to this account', 400);
      const settings = req.body && req.body.settings ? req.body.settings : {};
      const updated = await MeetingSettingsModel.updateSettings(req.user, settings);
      return ok({ updated }, 'Meeting settings saved');
    } catch (e) {
      return err(e.message);
    }
  }
};

module.exports = controller;