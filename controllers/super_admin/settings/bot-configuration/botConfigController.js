/**
 * controllers/super_admin/settings/bot-configuration/botConfigController.js
 * Bot Configuration controllers — no business logic/SQL here,
 * all data access goes through BotConfigModel.
 */
const BotConfigModel = require('../../../../models/super_admin/settings/bot-configuration/BotConfigModel');

const controller = {
  /**
   * GET /api/super_admin/settings/bot-configuration/settings
   */
  async getSettings(req, res) {
    try {
      const category = req.query.category || 'bot';
      const rows = await BotConfigModel.listSettings(category);
      return res.json({ success: true, data: rows });
    } catch (err) {
      console.error('[BotConfig] getSettings error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  },

  /**
   * POST /api/super_admin/settings/bot-configuration/settings/bulk
   */
  async saveSettings(req, res) {
    try {
      const { settings } = req.body || {};
      if (!Array.isArray(settings)) {
        return res.status(400).json({ success: false, error: 'Settings must be an array' });
      }
      const result = await BotConfigModel.saveSettings(settings);
      return res.json({
        success: true,
        data: result.data,
        summary: result.summary,
        message: `Updated ${result.summary.success} of ${result.summary.total} settings`
      });
    } catch (err) {
      console.error('[BotConfig] saveSettings error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }
};

module.exports = controller;
