/**
 * root/models/HeaderMenuItemsModel.js
 */
const { db } = require('../../database/db');
const { logger } = require('../../utils/logger');

class HeaderMenuItemsModel {
  
  static listByRole(roleId) {
    return new Promise((resolve, reject) =>
      db.all(
        `SELECT *
         FROM header_menu_items
         WHERE role_id = ?
           AND is_active = 1
           AND deleted_at IS NULL
         ORDER BY display_order ASC`,
        [roleId],
        (err, rows) => err ? reject(err) : resolve(rows || [])
      )
    );
  }

  static create(item) {
    return new Promise((resolve, reject) => {
      const sql = `INSERT INTO header_menu_items (role_id, menu_id, parent_id, label, icon, href, display_order, is_active, created_by, updated_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`;
      db.run(sql, [item.role_id, item.menu_id, item.parent_id || null, item.label, item.icon || null, item.href || null, item.display_order || 0, item.is_active ? 1 : 1, item.created_by || null, item.updated_by || null], function(err) {
        if (err) { logger.error('[HeaderMenuItemsModel] create error', err); return reject(err); }
        resolve({ id: this.lastID });
      });
    });
  }

  static update(id, changes) {
    const keys = Object.keys(changes);
    if (!keys.length) return Promise.resolve({ updated: false });
    const set = keys.map(k => `${k} = ?`).join(', ');
    const params = keys.map(k => changes[k]);
    params.push(id);
    return new Promise((resolve, reject) => {
      db.run(`UPDATE header_menu_items SET ${set}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, params, function(err) {
        if (err) return reject(err);
        resolve({ updated: this.changes > 0 });
      });
    });
  }
}

module.exports = HeaderMenuItemsModel;
