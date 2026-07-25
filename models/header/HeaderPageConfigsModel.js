/**
 * root/models/HeaderPageConfigsModel.js
 */
const { db } = require('../../database/db');
const { logger } = require('../../utils/logger');

class HeaderPageConfigsModel {
  static getByRoleAndPage(roleId, pageKey) {
    return new Promise((resolve, reject) => db.get('SELECT * FROM header_page_configs WHERE role_id = ? AND page_key = ? AND deleted_at IS NULL', [roleId, pageKey], (err, row) => err ? reject(err) : resolve(row || null)));
  }

  static upsert(data) {
    return new Promise((resolve, reject) => {
      const sql = `INSERT INTO header_page_configs (role_id, page_key, title, description, role_title, show_stats, buttons_json, is_active, created_by, updated_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON DUPLICATE KEY UPDATE title=VALUES(title), description=VALUES(description), role_title=VALUES(role_title), show_stats=VALUES(show_stats), buttons_json=VALUES(buttons_json), is_active=VALUES(is_active), updated_by=VALUES(updated_by), updated_at=CURRENT_TIMESTAMP`;
      const params = [data.role_id, data.page_key, data.title || '', data.description || '', data.role_title || 'Console', data.show_stats ? 1 : 0, data.buttons_json || '[]', data.is_active ? 1 : 1, data.created_by || null, data.updated_by || null];
      db.run(sql, params, function(err) {
        if (err) { logger.error('[HeaderPageConfigsModel] upsert error', err); return reject(err); }
        resolve({ id: this.lastID, changes: this.changes });
      });
    });
  }
}

module.exports = HeaderPageConfigsModel;
