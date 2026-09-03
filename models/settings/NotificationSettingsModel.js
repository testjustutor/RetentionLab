/**
 * models/settings/NotificationSettingsModel.js
 * Data access for notification preferences (by role + channel).
 * All SQL lives here; controllers only call these methods.
 */
const { db } = require('../../database/db');
const { logger } = require('../../utils/logger');
const SystemSettingsModel = require('./SystemSettingsModel');

const ROLES = ['admin', 'instructor', 'reviewer'];
const CHANNELS = ['email', 'push', 'sms'];

class NotificationSettingsModel {
  static getSettingKey(channel, role) {
    return 'notif.' + channel + '.' + role;
  }

  static defaultSettings() {
    const s = {};
    CHANNELS.forEach((ch) => {
      s[ch] = {};
      ROLES.forEach((role) => { s[ch][role] = true; });
    });
    return s;
  }

  /**
   * Get notification settings for the current company (defaults to all enabled).
   * @param {object} user - { role_name, company_id }
   * @returns {Promise<object>} { email: {admin,instructor,reviewer}, push: {...}, sms: {...} }
   */
  static getSettings(user) {
    return new Promise((resolve, reject) => {
      if (!user.company_id) return resolve(NotificationSettingsModel.defaultSettings());
      const sql = "SELECT setting_key, setting_value FROM system_settings WHERE company_id = ? AND setting_key LIKE 'notif.%'";
      db.all(sql, [user.company_id], (err, rows) => {
        if (err) {
          logger.error('Model(NotificationSettingsModel): Error fetching settings:', err);
          return reject(err);
        }
        const s = NotificationSettingsModel.defaultSettings();
        (rows || []).forEach((r) => {
          const parts = r.setting_key.split('.');
          const ch = parts[1];
          const role = parts[2];
          if (CHANNELS.includes(ch) && ROLES.includes(role)) {
            s[ch][role] = (String(r.setting_value) === '1');
          }
        });
        resolve(s);
      });
    });
  }

  /**
   * Count users by role (admin, instructor incl. solo_instructor, reviewer).
   * @param {object} user - { role_name, company_id }
   * @returns {Promise<object>} { admin, instructor, reviewer }
   */
  static getRoleCounts(user) {
    return new Promise((resolve, reject) => {
      const isAdmin = user.role_name === 'admin' && user.company_id;
      let sql = "SELECT r.role_name, COUNT(*) c FROM users u JOIN roles r ON r.id = u.role_id WHERE u.is_deleted = 0 AND r.role_name IN ('admin','instructor','solo_instructor','reviewer')";
      const params = [];
      if (isAdmin) {
        sql += ' AND u.company_id = ?';
        params.push(user.company_id);
      }
      sql += ' GROUP BY r.role_name';
      db.all(sql, params, (err, rows) => {
        if (err) {
          logger.error('Model(NotificationSettingsModel): Error fetching role counts:', err);
          return reject(err);
        }
        const counts = rows || [];
        const sum = (names) => counts.filter((r) => names.includes(r.role_name)).reduce((a, r) => a + (r.c || 0), 0);
        resolve({
          admin: sum(['admin']),
          instructor: sum(['instructor', 'solo_instructor']),
          reviewer: sum(['reviewer'])
        });
      });
    });
  }

  /**
   * Persist notification settings (upsert each notif.<channel>.<role>).
   * @param {object} user - { company_id }
   * @param {object} settings - { email: {...}, push: {...}, sms: {...} }
   * @returns {Promise<object>} { updated }
   */
  static async updateSettings(user, settings) {
    if (!user.company_id) return { updated: false };
    const updates = [];
    CHANNELS.forEach((ch) => {
      ROLES.forEach((role) => {
        const val = (settings && settings[ch] && settings[ch][role]) ? '1' : '0';
        updates.push(SystemSettingsModel.upsertSetting(user.company_id, NotificationSettingsModel.getSettingKey(ch, role), val, 'string'));
      });
    });
    await Promise.all(updates);
    return { updated: true };
  }
}

module.exports = NotificationSettingsModel;