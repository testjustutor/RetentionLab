/**
 * root/models/RolesModel.js
 */
const { db } = require('../../../database/db');
const { logger } = require('../../../utils/logger');

class RolesModel {
  static getAllRoles() {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM roles ORDER BY role_name', [], (err, rows) => err ? reject(err) : resolve(rows || []));
    });
  }

  static getRoleByName(name) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM roles WHERE role_name = ?', [name], (err, row) => err ? reject(err) : resolve(row || null));
    });
  }

  static getRoleById(id) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM roles WHERE id = ?', [id], (err, row) => err ? reject(err) : resolve(row || null));
    });
  }

  static createRole(role_name, description) {
    return new Promise((resolve, reject) => {
      db.run('INSERT IGNORE INTO roles (role_name, description, created_at) VALUES (?, ?, CURRENT_TIMESTAMP)', [role_name, description || null], function(err) {
        if (err) return reject(err);
        resolve({ id: this.lastID });
      });
    });
  }
}

module.exports = RolesModel;
