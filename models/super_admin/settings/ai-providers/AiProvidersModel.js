/**
 * models/super_admin/settings/ai-providers/AiProvidersModel.js
 * Data access for the Super Admin AI Providers feature.
 * All SQL lives in models — never in controllers/routes.
 */

const db = require('../../../../database');

class AiProvidersModel {
  /**
   * Get all AI providers settings grouped by category
   */
  static async getProvidersByCategory(category = 'ai') {
    const [rows] = await db.query(
      `SELECT setting_key, setting_value, is_editable, category 
       FROM system_settings 
       WHERE category = ? 
       ORDER BY setting_key`,
      [category]
    );
    return rows;
  }

  /**
   * Bulk upsert settings
   */
  static async bulkUpsertSettings(settings) {
    const queries = settings.map(setting => {
      const { setting_key, setting_value, is_editable } = setting;
      return db.query(
        `INSERT INTO system_settings (setting_key, setting_value, is_editable, category, updated_at) 
         VALUES (?, ?, ?, 'ai', NOW())
         ON DUPLICATE KEY UPDATE setting_value = ?, is_editable = ?, updated_at = NOW()`,
        [setting_key, setting_value, is_editable, setting_value]
      );
    });
    await Promise.all(queries);
  }
}

module.exports = AiProvidersModel;