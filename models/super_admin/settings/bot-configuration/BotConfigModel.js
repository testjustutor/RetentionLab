/**
 * models/super_admin/settings/bot-configuration/BotConfigModel.js
 * Data access for the Super Admin "Bot Configuration" feature.
 * All SQL lives in models — never in controllers/routes.
 */
const { db } = require('../../../../database/db');
const SystemSettingsModel = require('../../../settings/SystemSettingsModel');

class BotConfigModel {
  /**
   * List bot system settings (category = 'bot'), with editable flag.
   * @param {string} category - setting_key prefix (default 'bot')
   * @returns {Promise<Array>}
   */
  static listSettings(category = 'bot') {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT *, (is_static = 1) as is_editable
        FROM system_settings
        WHERE setting_key LIKE ?
        ORDER BY setting_key ASC
      `;
      db.all(sql, [`${category}%`], (err, rows) => {
        if (err) return reject(err);
        resolve(rows || []);
      });
    });
  }

  /**
   * Bulk upsert bot settings.
   * @param {Array<{key,value,type}>} settings
   * @returns {Promise<{data,summary}>}
   */
  static async saveSettings(settings) {
    const results = [];
    for (const setting of settings || []) {
      const { key, value, type = 'string' } = setting;
      if (!key || value === undefined) {
        results.push({ key, success: false, error: 'Key and value required' });
        continue;
      }
      try {
        const data = await SystemSettingsModel.upsertSetting(null, key, value, type);
        results.push({ key, success: true, data });
      } catch (e) {
        results.push({ key, success: false, error: e.message });
      }
    }
    const successCount = results.filter(r => r.success).length;
    return {
      data: results,
      summary: { total: results.length, success: successCount, failed: results.length - successCount }
    };
  }
}

module.exports = BotConfigModel;
