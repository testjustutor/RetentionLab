/**
 * root/models/SystemSettingsModel.js
 */
const { db } = require('../../database/db');

class SystemSettingsModel {
  /**
   * List system settings, optionally filtered by category (setting_key
   * prefix) and/or a search term matched against key or value.
   * @param {{category?: string, search?: string}} [filters]
   * @returns {Promise<Array>}
   */
  static listSettings({ category, search } = {}) {
    return new Promise((resolve, reject) => {
      let sql = 'SELECT *, (is_static = 1) as is_editable FROM system_settings WHERE 1=1';
      const params = [];

      if (category) {
        sql += ' AND setting_key LIKE ?';
        params.push(`${category}%`);
      }

      if (search) {
        sql += ' AND (setting_key LIKE ? OR setting_value LIKE ?)';
        params.push(`%${search}%`, `%${search}%`);
      }

      sql += ' ORDER BY setting_key ASC';

      db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows || []));
    });
  }

  /**
   * All system settings, unfiltered (used for export/backup).
   * @returns {Promise<Array>}
   */
  static getAllSettings() {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM system_settings', [], (err, rows) => err ? reject(err) : resolve(rows || []));
    });
  }

  /**
   * Distinct setting categories (the first `.`-segment of setting_key) with counts.
   * @returns {Promise<Array<{category: string, count: number}>>}
   */
  static getCategories() {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT DISTINCT
          SUBSTRING_INDEX(setting_key, '.', 1) as category,
          COUNT(*) as count
        FROM system_settings
        GROUP BY category
        ORDER BY category ASC
      `;
      db.all(sql, [], (err, rows) => err ? reject(err) : resolve(rows || []));
    });
  }

  /**
   * Delete a system setting by company_id + key.
   * @param {number|null} companyId
   * @param {string} key
   * @returns {Promise<{deleted: boolean}>}
   */
  static deleteSetting(companyId, key) {
    return new Promise((resolve, reject) => {
      db.run('DELETE FROM system_settings WHERE company_id = ? AND setting_key = ?', [companyId, key], function (err) {
        if (err) return reject(err);
        resolve({ deleted: this.changes > 0 });
      });
    });
  }

  /**
   * Setting rows whose key starts with `prefix` (e.g. the `table_controls.` namespace).
   * @param {string} prefix
   * @returns {Promise<Array<{setting_key: string, setting_value: string}>>}
   */
  static getByKeyPrefix(prefix) {
    return new Promise((resolve, reject) => {
      db.all(
        'SELECT setting_key, setting_value FROM system_settings WHERE setting_key LIKE ?',
        [`${prefix}%`],
        (err, rows) => err ? reject(err) : resolve(rows || [])
      );
    });
  }

  static getSetting(companyId, key) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM system_settings WHERE company_id = ? AND setting_key = ? LIMIT 1', [companyId, key], (err, row) => err ? reject(err) : resolve(row || null));
    });
  }

  /**
   * Look up a single setting by key only, regardless of company_id.
   * getSetting() above binds `company_id = ?` — when the row was saved with a
   * NULL company_id (as every global/super-admin setting is, via
   * upsertSetting(null, ...)), passing null back in produces
   * `company_id = NULL`, which SQL never matches (not even NULL rows), so
   * getSetting(null, key) silently returns nothing for these rows. This is
   * the key-only lookup for global settings, matching how listSettings()
   * elsewhere in this codebase already queries by setting_key alone.
   * @param {string} key - exact setting_key
   * @returns {Promise<Object|null>}
   */
  static getSettingByKey(key) {
    return new Promise((resolve, reject) => {
      // ORDER BY id DESC: in case duplicate rows exist for this key (see the
      // note on upsertSetting() below), always return the most recent one.
      db.get('SELECT * FROM system_settings WHERE setting_key = ? ORDER BY id DESC LIMIT 1', [key], (err, row) => err ? reject(err) : resolve(row || null));
    });
  }

  /**
   * Create-or-update a single setting.
   *
   * NOTE: this used to be a single `INSERT ... ON DUPLICATE KEY UPDATE`
   * relying on the `unique_setting (company_id, setting_key)` key. That
   * silently never updated anything for global settings (every super-admin
   * settings page, including Platforms, calls this with companyId = null):
   * in MySQL/InnoDB a UNIQUE index treats every NULL as distinct from every
   * other NULL, so two rows with the same setting_key both having
   * company_id = NULL are NOT considered a duplicate — the INSERT always
   * succeeded as a brand-new row and the UPDATE clause never fired. Each
   * save silently piled up another row instead of overwriting the existing
   * one, which is why toggles could appear to "revert" after a refresh
   * (whichever duplicate row the SELECT happened to return first would win,
   * not necessarily the latest save). Replaced with an explicit
   * find-then-update-or-insert that uses `IS NULL` for a null companyId, so
   * it actually matches the existing global row.
   */
  static upsertSetting(companyId, key, value, type = 'string') {
    return new Promise((resolve, reject) => {
      const isNullCompany = companyId === null || companyId === undefined;
      const whereClause = isNullCompany
        ? 'company_id IS NULL AND setting_key = ?'
        : 'company_id = ? AND setting_key = ?';
      const whereParams = isNullCompany ? [key] : [companyId, key];

      // ORDER BY id DESC: if duplicate rows already exist from the old bug,
      // update the most recent one rather than an arbitrary/stale one.
      db.get(
        `SELECT id FROM system_settings WHERE ${whereClause} ORDER BY id DESC LIMIT 1`,
        whereParams,
        (selErr, row) => {
          if (selErr) return reject(selErr);

          if (row) {
            db.run(
              'UPDATE system_settings SET setting_value = ?, setting_type = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
              [value, type, row.id],
              function (updErr) {
                if (updErr) return reject(updErr);
                resolve({ saved: this.changes > 0, updated: true });
              }
            );
            return;
          }

          db.run(
            'INSERT INTO system_settings (company_id, setting_key, setting_value, setting_type, created_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)',
            [companyId, key, value, type],
            function (insErr) {
              if (insErr) return reject(insErr);
              resolve({ saved: this.changes > 0, created: true });
            }
          );
        }
      );
    });
  }
}

module.exports = SystemSettingsModel;
