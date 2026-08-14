/**
 * models/reports/EvaluationReportModel.js
 * Data access for evaluation reports dashboard.
 * All SQL lives here; controllers only call these methods.
 */
const { db } = require('../../database/db');
const { logger } = require('../../utils/logger');

class EvaluationReportModel {
  /**
   * Get recent scores with meeting and reviewer info.
   * @param {object} filters - { from_date, to_date, instructor_id, active, days }
   * @returns {Promise<Array>}
   */
  static getRecentScores(filters = {}) {
    return new Promise((resolve, reject) => {
      const { from_date, to_date, instructor_id, active, days = 30 } = filters;
      let sql = `
        SELECT ms.*,
               m.title as meeting_title,
               m.platform,
               m.scheduled_start_time as meeting_date,
               CONCAT(u.first_name, ' ', u.last_name) as reviewer_name
        FROM meeting_scores ms
        LEFT JOIN meetings m ON m.id = ms.meeting_id
        LEFT JOIN users u ON u.id = ms.reviewer_id
        LEFT JOIN users ui ON ui.email = m.calendar_account
        WHERE 1=1
      `;
      const params = [];

      if (from_date && to_date) {
        sql += ' AND ms.scored_at >= ? AND ms.scored_at <= ?';
        params.push(from_date + ' 00:00:00', to_date + ' 23:59:59');
      } else {
        sql += ' AND (ms.scored_at >= DATE_SUB(NOW(), INTERVAL ? DAY) OR ms.scored_at IS NULL)';
        params.push(days);
      }
      if (instructor_id) {
        sql += ' AND ui.id = ?';
        params.push(parseInt(instructor_id, 10));
      }
      if (active) {
        sql += " AND m.status NOT IN ('completed', 'cancelled')";
      }

      sql += ' ORDER BY ms.scored_at DESC, ms.id DESC LIMIT 500';

      db.all(sql, params, (err, rows) => {
        if (err) {
          logger.error('Model(EvaluationReportModel): Error fetching scores:', err);
          return reject(err);
        }
        resolve(rows || []);
      });
    });
  }

  /**
   * Get recent meetings with owner info.
   * @param {object} filters - { from_date, to_date, instructor_id, active, days }
   * @returns {Promise<Array>}
   */
  static getRecentMeetings(filters = {}) {
    return new Promise((resolve, reject) => {
      const { from_date, to_date, instructor_id, active, days = 30 } = filters;
      let sql = `
        SELECT m.*,
               CONCAT(u.first_name, ' ', u.last_name) as owner_name,
               u.email as owner_email
        FROM meetings m
        LEFT JOIN users u ON u.email = m.calendar_account
        WHERE 1=1
      `;
      const params = [];

      if (from_date && to_date) {
        sql += ' AND m.scheduled_start_time >= ? AND m.scheduled_start_time <= ?';
        params.push(from_date + ' 00:00:00', to_date + ' 23:59:59');
      } else {
        sql += ' AND (m.scheduled_start_time >= DATE_SUB(NOW(), INTERVAL ? DAY) OR m.scheduled_start_time IS NULL)';
        params.push(days);
      }
      if (instructor_id) {
        sql += ' AND u.id = ?';
        params.push(parseInt(instructor_id, 10));
      }
      if (active) {
        sql += " AND m.status NOT IN ('completed', 'cancelled')";
      }

      sql += ' ORDER BY m.scheduled_start_time DESC LIMIT 100';

      db.all(sql, params, (err, rows) => {
        if (err) {
          logger.error('Model(EvaluationReportModel): Error fetching meetings:', err);
          return reject(err);
        }
        resolve(rows || []);
      });
    });
  }
  /**
   * Get distinct instructors who have evaluation scores (for filter dropdown).
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
          AND u.is_deleted = 0
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
          logger.error('Model(EvaluationReportModel): Error fetching instructors:', err);
          return reject(err);
        }
        resolve(rows || []);
      });
    });
  }

}

module.exports = EvaluationReportModel;


