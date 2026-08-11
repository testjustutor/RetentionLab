/**
 * models/insights/EngagementModel.js
 * Data access for insights/engagement dashboard.
 * All SQL lives here; controllers only call these methods.
 */
const { db } = require('../../database/db');
const { logger } = require('../../utils/logger');

class EngagementModel {
  /**
   * Get engagement reports with meeting and instructor info.
   * @param {object} user - { role_name, company_id }
   * @param {object} filters - { from_date, to_date, instructor_id }
   * @returns {Promise<Array>}
   */
  static getEngagementReports(user, filters = {}) {
    return new Promise((resolve, reject) => {
      const { from_date, to_date, instructor_id } = filters;
      let sql = `
        SELECT
          sqr.meeting_id,
          sqr.student_engagement,
          sqr.learning_impact,
          sqr.overall_rating,
          sqr.percentage_score,
          sqr.confidence_level,
          sqr.executive_summary,
          m.title as meeting_title,
          m.scheduled_start_time as meeting_date,
          m.calendar_account as instructor_email,
          CONCAT(u.first_name, ' ', u.last_name) as instructor_name,
          u.id as instructor_id
        FROM session_quality_reports sqr
        JOIN meetings m ON m.id = sqr.meeting_id
        JOIN users u ON LOWER(u.email) = LOWER(m.calendar_account)
        WHERE 1=1
      `;
      const params = [];

      if (user.role_name === 'admin') {
        sql += ' AND u.company_id = ?';
        params.push(user.company_id);
      }

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
        params.push(parseInt(instructor_id));
      }

      sql += ' AND sqr.student_engagement IS NOT NULL';
      sql += ' ORDER BY m.scheduled_start_time DESC LIMIT 100';

      db.all(sql, params, (err, rows) => {
        if (err) {
          logger.error('Model(EngagementModel): Error fetching engagement reports:', err);
          return reject(err);
        }
        resolve(rows || []);
      });
    });
  }
}

module.exports = EngagementModel;
