/**
 * root/models/HeaderRoleConfigsModel.js
 */
const { db } = require('../../database/db');
const { logger } = require('../../utils/logger');

class HeaderRoleConfigsModel {
  static getByRole(roleId) {
    return new Promise((resolve, reject) => db.get('SELECT * FROM header_role_configs WHERE role_id = ? AND deleted_at IS NULL', [roleId], (err, row) => err ? reject(err) : resolve(row || null)));
  }

  static upsert(data) {
    return new Promise((resolve, reject) => {
      const sql = `INSERT INTO header_role_configs (role_id, home_href, home_label, events_href, events_label, archives_href, archives_label, profile_href, profile_label, settings_href, settings_label, is_active, created_by, updated_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON DUPLICATE KEY UPDATE home_href=VALUES(home_href), home_label=VALUES(home_label), events_href=VALUES(events_href), events_label=VALUES(events_label), archives_href=VALUES(archives_href), archives_label=VALUES(archives_label), profile_href=VALUES(profile_href), profile_label=VALUES(profile_label), settings_href=VALUES(settings_href), settings_label=VALUES(settings_label), is_active=VALUES(is_active), updated_by=VALUES(updated_by), updated_at=CURRENT_TIMESTAMP`;
      const params = [data.role_id, data.home_href || '/dashboard.html', data.home_label || 'Home', data.events_href || '/events.html', data.events_label || 'Events', data.archives_href || '/archives.html', data.archives_label || 'Archives', data.profile_href || '/profile.html', data.profile_label || 'Profile', data.settings_href || '/settings.html', data.settings_label || 'Settings', data.is_active ? 1 : 0, data.created_by || null, data.updated_by || null];
      db.run(sql, params, function(err) {
        if (err) { logger.error('[HeaderRoleConfigsModel] upsert error', err); return reject(err); }
        resolve({ id: this.lastID, changes: this.changes });
      });
    });
  }
}

module.exports = HeaderRoleConfigsModel;
