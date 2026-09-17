/**
 * root/models/UserSettingsModel.js
 */
const { db } = require('../../database/db');

class UserSettingsModel {
  /**
   * List a user's settings, optionally filtered by category (setting_key prefix).
   * @param {number} userId
   * @param {string} [category]
   * @returns {Promise<Array>}
   */
  static listSettings(userId, category) {
    return new Promise((resolve, reject) => {
      let sql = 'SELECT * FROM user_settings WHERE user_id = ?';
      const params = [userId];

      if (category) {
        sql += ' AND setting_key LIKE ?';
        params.push(`${category}%`);
      }

      sql += ' ORDER BY setting_key ASC';

      db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows || []));
    });
  }

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
