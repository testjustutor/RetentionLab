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
   * @param {number} days - Number of days back to look
   * @returns {Promise<Array>}
   */
  static getRecentScores(days) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT ms.*,
               m.title as meeting_title,
               m.platform,
               m.scheduled_start_time as meeting_date,
               CONCAT(u.first_name, ' ', u.last_name) as reviewer_name
        FROM meeting_scores ms
        LEFT JOIN meetings m ON m.external_meeting_id = ms.meeting_id
        LEFT JOIN users u ON u.id = ms.reviewer_id
        WHERE ms.scored_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
           OR ms.scored_at IS NULL
        ORDER BY ms.scored_at DESC
        LIMIT 500
      `;
      db.all(sql, [days], (err, rows) => {
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
   * @param {number} days - Number of days back to look
   * @returns {Promise<Array>}
   */
  static getRecentMeetings(days) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT m.*,
               CONCAT(u.first_name, ' ', u.last_name) as owner_name,
               u.email as owner_email
        FROM meetings m
        LEFT JOIN users u ON u.email = m.calendar_account
        WHERE m.scheduled_start_time >= DATE_SUB(NOW(), INTERVAL ? DAY)
           OR m.scheduled_start_time IS NULL
        ORDER BY m.scheduled_start_time DESC
        LIMIT 100
      `;
      db.all(sql, [days], (err, rows) => {
        if (err) {
          logger.error('Model(EvaluationReportModel): Error fetching meetings:', err);
          return reject(err);
        }
        resolve(rows || []);
      });
    });
  }
}

module.exports = EvaluationReportModel;
