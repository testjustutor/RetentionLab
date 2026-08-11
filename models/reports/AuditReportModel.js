/**
 * models/reports/AuditReportModel.js
 * Data access for audit reports dashboard.
 * All SQL lives here; controllers only call these methods.
 */
const { db } = require('../../database/db');
const { logger } = require('../../utils/logger');

class AuditReportModel {
  /**
   * Get recent meeting scores with meeting and reviewer info.
   * @param {number} days - Number of days back to look
   * @returns {Promise<Array>}
   */
  static getRecentScores(days) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT ms.*, m.title as meeting_title, m.platform, m.scheduled_start_time as meeting_date,
               CONCAT(u.first_name, ' ', u.last_name) as reviewer_name
        FROM meeting_scores ms
        LEFT JOIN meetings m ON m.external_meeting_id = ms.meeting_id
        LEFT JOIN users u ON u.id = ms.reviewer_id
        WHERE ms.scored_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        ORDER BY ms.scored_at DESC
        LIMIT 500
      `;
      db.all(sql, [days], (err, rows) => {
        if (err) {
          logger.error('Model(AuditReportModel): Error fetching scores:', err);
          return reject(err);
        }
        resolve(rows || []);
      });
    });
  }

  /**
   * Get recent AI audit results with meeting info.
   * @param {number} days - Number of days back to look
   * @returns {Promise<Array>}
   */
  static getRecentAuditResults(days) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT aar.*, m.title as meeting_title, m.scheduled_start_time as meeting_date
        FROM ai_audit_results aar
        LEFT JOIN meetings m ON m.external_meeting_id = aar.meeting_id
        WHERE aar.scored_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        ORDER BY aar.scored_at DESC
        LIMIT 200
      `;
      db.all(sql, [days], (err, rows) => {
        if (err) {
          logger.error('Model(AuditReportModel): Error fetching audit results:', err);
          return reject(err);
        }
        resolve(rows || []);
      });
    });
  }
}

module.exports = AuditReportModel;
