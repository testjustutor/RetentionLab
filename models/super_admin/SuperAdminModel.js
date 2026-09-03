/**
 * controllers/super_admin/SuperAdminModel.js
 * Data access for the Super Admin panel (MVC Model layer).
 * All SQL belongs in this model — never in controllers or routes.
 *
 * Scaffold only: add Super Admin model methods here as features are built.
 */
const { db } = require('../../database/db');
const { logger } = require('../../utils/logger');

class SuperAdminModel {
  /**
   * Placeholder scaffold method. Replace with real Super Admin data access.
   * @returns {Promise<Object>}
   */
  static ping() {
    return Promise.resolve({ service: 'super-admin', ready: true });
  }

  /**
   * Counts per-company stats from the users table.
   * Example of how model methods should be shaped (no SQL in controllers).
   * @param {string} [roleName] - optional role filter, e.g. 'admin'
   * @returns {Promise<Array>} [{ company_id, total }]
   */
  static countUsersByCompany(roleName) {
    return new Promise((resolve, reject) => {
      let sql = `SELECT company_id, COUNT(*) AS total FROM users`;
      const params = [];
      if (roleName) {
        sql += ` WHERE role_id = (SELECT id FROM roles WHERE role_name = ?)`;
        params.push(roleName);
      }
      sql += ` GROUP BY company_id ORDER BY total DESC`;
      db.all(sql, params, (err, rows) => {
        if (err) {
          logger.error('Model(SuperAdminModel): Error counting users by company:', err);
          return reject(err);
        }
        resolve(rows || []);
      });
    });
  }
}

module.exports = SuperAdminModel;