/**
 * models/dashboard/DashboardModel.js
 * Model for dashboard statistics and aggregated data
 */
const { db } = require('../../database/db');
const { logger } = require('../../utils/logger');

class DashboardModel {
  /**
   * Get all companies
   * @returns {Promise<Array>} Array of companies
   */
  static async getAllCompanies() {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT id, company_name, status, created_at
        FROM companies
        WHERE deleted_at IS NULL
        ORDER BY created_at DESC
      `;

      db.all(sql, [], (err, rows) => {
        if (err) {
          logger.error('Model(DashboardModel): Error fetching companies:', err);
          return reject(err);
        }
        resolve(rows || []);
      });
    });
  }

  /**
   * Get all users with role and company details
   * @returns {Promise<Array>} Array of users with joined data
   */
  static async getAllUsersWithDetails() {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT u.id, u.first_name, u.last_name, u.email, u.status, u.created_at, u.company_id,
               r.role_name, c.company_name
        FROM users u
        LEFT JOIN roles r ON u.role_id = r.id
        LEFT JOIN companies c ON u.company_id = c.id
        WHERE u.deleted_at IS NULL
        ORDER BY u.created_at DESC
      `;

      db.all(sql, [], (err, rows) => {
        if (err) {
          logger.error('Model(DashboardModel): Error fetching users:', err);
          return reject(err);
        }
        resolve(rows || []);
      });
    });
  }

  /**
   * Get recent meetings with owner details
   * @param {number} limit - Maximum number of meetings to return
   * @returns {Promise<Array>} Array of meetings with owner information
   */
  static async getRecentMeetingsWithOwner(limit = 200) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT m.*, CONCAT(u.first_name, ' ', u.last_name) as owner_name
        FROM meetings m
        LEFT JOIN users u ON u.id = m.created_by
        ORDER BY m.scheduled_start_time DESC
        LIMIT ?
      `;

      db.all(sql, [limit], (err, rows) => {
        if (err) {
          logger.error('Model(DashboardModel): Error fetching meetings:', err);
          return reject(err);
        }
        resolve(rows || []);
      });
    });
  }
}

module.exports = DashboardModel;