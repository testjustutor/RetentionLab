/**
 * models/meetings/MeetingReportModel.js
 * Data access for meeting reports dashboard.
 * All SQL lives here; controllers only call these methods.
 */
const { db } = require('../../database/db');
const { logger } = require('../../utils/logger');

class MeetingReportModel {
  /**
   * Get meetings with owner info for the reports dashboard.
   * @param {object} filters - { from_date, to_date, instructor_id }
   * @returns {Promise<Array>}
   */
  static getMeetings(filters = {}) {
    return new Promise((resolve, reject) => {
      const { from_date, to_date, instructor_id } = filters;
      let sql = `
        SELECT m.*,
               CONCAT(u.first_name, ' ', u.last_name) as owner_name,
               u.email as owner_email
        FROM meetings m
        LEFT JOIN users u ON u.email = m.calendar_account
        WHERE 1=1
      `;
      const params = [];

      if (from_date) {
        sql += ' AND m.scheduled_start_time >= ?';
        params.push(from_date + ' 00:00:00');
      }
      if (to_date) {
        sql += ' AND m.scheduled_start_time <= ?';
        params.push(to_date + ' 23:59:59');
      }
      if (instructor_id) {
        sql += ' AND u.id = ?';
        params.push(parseInt(instructor_id, 10));
      }

      sql += ' ORDER BY m.scheduled_start_time DESC LIMIT 100';

      db.all(sql, params, (err, rows) => {
        if (err) {
          logger.error('Model(MeetingReportModel): Error fetching meetings:', err);
          return reject(err);
        }
        resolve(rows || []);
      });
    });
  }

  /**
   * Get active instructors with connected calendars for the filter dropdown.
   * @param {object} user - { role_name, company_id }
   * @returns {Promise<Array>} [{ id, name, email }]
   */
  static getInstructors(user) {
    return new Promise((resolve, reject) => {
      let sql = `
        SELECT DISTINCT
          u.id,
          CONCAT(u.first_name, ' ', u.last_name) as name,
          u.email
        FROM users u
        JOIN roles r ON r.id = u.role_id
        LEFT JOIN calendar_connections cc ON cc.user_id = u.id
        WHERE r.role_name = 'instructor'
          AND u.status = 'active'
          AND cc.id IS NOT NULL
      `;
      const params = [];

      if (user.role_name === 'admin') {
        sql += ' AND u.company_id = ?';
        params.push(user.company_id);
      }

      sql += ' ORDER BY u.first_name, u.last_name';

      db.all(sql, params, (err, rows) => {
        if (err) {
          logger.error('Model(MeetingReportModel): Error fetching instructors:', err);
          return reject(err);
        }
        resolve(rows || []);
      });
    });
  }
}

module.exports = MeetingReportModel;
