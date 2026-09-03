/**
 * models/reports/MeetingReportModel.js
 * Data access for meeting reports dashboard.
 * All SQL lives here; controllers only call these methods.
 */
const { db } = require('../../database/db');
const { logger } = require('../../utils/logger');

class MeetingReportModel {
  /**
   * Get recent meetings with owner info for the reports dashboard.
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
          logger.error('Model(MeetingReportModel): Error fetching recent meetings:', err);
          return reject(err);
        }
        resolve(rows || []);
      });
    });
  }
}

module.exports = MeetingReportModel;
