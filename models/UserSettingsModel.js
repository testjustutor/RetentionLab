/**
 * root/models/UserSettingsModel.js
 */
const { db } = require('../database/db');

class UserSettingsModel {
  static getSetting(userId, key) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM user_settings WHERE user_id = ? AND setting_key = ? LIMIT 1', [userId, key], (err, row) => err ? reject(err) : resolve(row || null));
    });
  }

  static upsertSetting(userId, key, value) {
    return new Promise((resolve, reject) => {
      const sql = `INSERT INTO user_settings (user_id, setting_key, setting_value, created_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = CURRENT_TIMESTAMP`;
      db.run(sql, [userId, key, value], function(err) {
        if (err) return reject(err);
        resolve({ saved: this.changes > 0 });
      });
    });
  }
}

module.exports = UserSettingsModel;
