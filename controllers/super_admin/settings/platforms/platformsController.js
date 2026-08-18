/**
 * controllers/super_admin/settings/platforms/platformsController.js
 * Platform settings controllers — no business logic/SQL here,
 * all data access goes through PlatformsModel.
 */
const PlatformsModel = require('../../../../models/super_admin/settings/platforms/PlatformsModel');

const controller = {
  /**
   * GET /api/super_admin/settings/platforms/settings
   */
  async getSettings(req, res) {
    try {
      const category = req.query.category || 'platforms';
      const rows = await PlatformsModel.listSettings(category);
      return res.json({ success: true, data: rows });
    } catch (err) {
      console.error('[Platforms] getSettings error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  },

  /**
   * POST /api/super_admin/settings/platforms/settings/bulk
   */
  async saveSettings(req, res) {
    try {
      const { settings } = req.body || {};
      if (!Array.isArray(settings)) {
        return res.status(400).json({ success: false, error: 'Settings must be an array' });
      }
      const result = await PlatformsModel.saveSettings(settings);
      return res.json({
        success: true,
        data: result.data,
        summary: result.summary,
        message: `Updated ${result.summary.success} of ${result.summary.total} settings`
      });
    } catch (err) {
      console.error('[Platforms] saveSettings error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }
};

module.exports = controller;
