/**
 * controllers/super_admin/settings/ai-providers/aiProvidersController.js
 * AI Providers controllers — no business logic/SQL here,
 * all data access goes through AiProvidersModel.
 */

const AiProvidersModel = require('../../../../models/super_admin/settings/ai-providers/AiProvidersModel');

const controller = {
  /**
   * GET /api/super_admin/settings/ai-providers/settings
   */
  async getSettings(req, res) {
    try {
      const category = req.query.category || 'ai';
      const settings = await AiProvidersModel.getProvidersByCategory(category);
      res.json({ success: true, data: settings });
    } catch (error) {
      console.error('Error fetching AI providers settings:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch settings' });
    }
  },

  /**
   * POST /api/super_admin/settings/ai-providers/settings/bulk
   */
  async saveSettings(req, res) {
    try {
      const settings = req.body;
      await AiProvidersModel.bulkUpsertSettings(settings);
      res.json({ success: true, summary: { success: settings.length } });
    } catch (error) {
      console.error('Error saving AI providers settings:', error);
      res.status(500).json({ success: false, error: 'Failed to save settings' });
    }
  }
};

module.exports = controller;