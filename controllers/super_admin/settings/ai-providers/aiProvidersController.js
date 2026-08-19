/**
 * controllers/super_admin/settings/ai-providers/aiProvidersController.js
 * AI Providers controllers — no business logic/SQL here,
 * all data access goes through AiProvidersModel.
 */

const AiProvidersModel = require('../../../../models/super_admin/settings/ai-providers/AiProvidersModel');

const controller = {
  /**
   * GET/POST /api/super_admin/settings/ai-providers/settings
   * POST /api/super_admin/settings/ai-providers/settings/system
   * Returns every AI provider from the ai_providers table.
   */
  async getSettings(req, res) {
    try {
      const providers = await AiProvidersModel.getAllProviders();
      res.json({ success: true, data: providers });
    } catch (error) {
      console.error('Error fetching AI providers:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch providers' });
    }
  },

  /**
   * POST /api/super_admin/settings/ai-providers/settings/bulk
   * Body: { settings: [{ provider_key, enabled, default_model,
   *   default_temperature, default_max_tokens, base_url }] }
   */
  async saveSettings(req, res) {
    try {
      const settings = (req.body && req.body.settings) || req.body;
      if (!Array.isArray(settings) || settings.length === 0) {
        return res.status(400).json({ success: false, error: 'No provider settings provided' });
      }
      await AiProvidersModel.bulkUpdateProviders(settings);
      res.json({ success: true, summary: { success: settings.length } });
    } catch (error) {
      console.error('Error saving AI providers:', error);
      res.status(500).json({ success: false, error: 'Failed to save providers' });
    }
  }
};

module.exports = controller;