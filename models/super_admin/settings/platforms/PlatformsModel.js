/**
 * models/super_admin/settings/platforms/PlatformsModel.js
 * Data access for the Super Admin platform settings feature.
 */
const { db } = require('../../../../database/db');
const SystemSettingsModel = require('../../../settings/SystemSettingsModel');

class PlatformsModel {
  /**
   * List platform system settings (category = 'platforms').
   * @param {string} category - setting_key prefix (default 'platforms')
   * @returns {Promise<Array>}
   */
  static listSettings(category = 'platforms') {
    return new Promise((resolve, reject) => {
      // Joined to the MAX(id) per setting_key rather than a plain
      // `WHERE setting_key LIKE ?`: a prior bug in
      // SystemSettingsModel.upsertSetting() (see its own comment) could
      // leave more than one row for the same key when company_id is NULL.
      // Always surface only the latest row per key so a stale duplicate
      // never shows or saves over the real current value.
      const sql = `
        SELECT s.*, (s.is_static = 1) as is_editable
        FROM system_settings s
        INNER JOIN (
          SELECT setting_key, MAX(id) AS max_id
          FROM system_settings
          WHERE setting_key LIKE ?
          GROUP BY setting_key
        ) latest ON latest.setting_key = s.setting_key AND latest.max_id = s.id
        ORDER BY s.setting_key ASC
      `;
      db.all(sql, [`${category}%`], (err, rows) => {
        if (err) return reject(err);
        resolve(rows || []);
      });
    });
  }

  /**
   * Bulk upsert platform settings.
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

  /**
   * Whether a single platform's bot-launch toggle is enabled.
   * Reads system_settings key `platforms.<platformKey>.enabled`, written by
   * the Super Admin > Settings > Platform Integrations page (stored as the
   * string 'true'/'false' — see public/js/super_admin/settings/platforms.js).
   * No row yet ⇒ defaults to enabled, so platforms keep working until an
   * admin explicitly disables one via that toggle.
   * @param {string} platformKey - canonical lowercase key: 'zoom' | 'teams' | 'google-meet'
   * @returns {Promise<boolean>}
   */
  static async isPlatformEnabled(platformKey) {
    if (!platformKey) return true;
    const row = await SystemSettingsModel.getSettingByKey(`platforms.${platformKey}.enabled`);
    if (!row) return true;
    return PlatformsModel._isTruthySetting(row.setting_value);
  }

  /**
   * Bulk version of isPlatformEnabled() for hot paths (e.g. the bot polling
   * loop) that need to check several meetings/platforms per pass without
   * issuing one query per meeting.
   * @returns {Promise<Object>} e.g. { zoom: true, teams: false, 'google-meet': true }
   */
  static getEnabledPlatformsMap() {
    return new Promise((resolve, reject) => {
      // Same latest-row-per-key join as listSettings() above, for the same
      // pre-existing-duplicate-row reason — this one feeds the bot-launch
      // gate directly, so it especially can't read a stale duplicate.
      db.all(
        `SELECT s.setting_key, s.setting_value
         FROM system_settings s
         INNER JOIN (
           SELECT setting_key, MAX(id) AS max_id
           FROM system_settings
           WHERE setting_key LIKE 'platforms.%.enabled'
           GROUP BY setting_key
         ) latest ON latest.setting_key = s.setting_key AND latest.max_id = s.id`,
        [],
        (err, rows) => {
          if (err) return reject(err);
          const map = {};
          for (const row of rows || []) {
            const m = /^platforms\.(.+)\.enabled$/.exec(row.setting_key);
            if (m) map[m[1]] = PlatformsModel._isTruthySetting(row.setting_value);
          }
          resolve(map);
        }
      );
    });
  }

  static _isTruthySetting(value) {
    return value === 'true' || value === true || value === 1 || value === '1';
  }
}

module.exports = PlatformsModel;
