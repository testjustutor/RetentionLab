/**
 * root/models/SystemSettingsModel.js
 */
const { db } = require('../database/db');

class SystemSettingsModel {
  static getSetting(companyId, key) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM system_settings WHERE company_id = ? AND setting_key = ? LIMIT 1', [companyId, key], (err, row) => err ? reject(err) : resolve(row || null));
    });
  }

  static upsertSetting(companyId, key, value, type = 'string') {
    return new Promise((resolve, reject) => {
      const sql = `INSERT INTO system_settings (company_id, setting_key, setting_value, setting_type, created_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), setting_type = VALUES(setting_type), updated_at = CURRENT_TIMESTAMP`;
      db.run(sql, [companyId, key, value, type], function(err) {
        if (err) return reject(err);
        resolve({ saved: this.changes > 0 });
      });
    });
  }
}

module.exports = SystemSettingsModel;
