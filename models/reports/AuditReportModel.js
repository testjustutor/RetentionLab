/**
 * models/reports/AuditReportModel.js
 * Data access for audit reports dashboard.
 * All SQL lives here; controllers only call these methods.
 */
const { db } = require('../../database/db');
const { logger } = require('../../utils/logger');

class AuditReportModel {
  /**
   * Get recent meeting scores with meeting and reviewer info, with date range and instructor filtering.
   * @param {Date|string} startDate - Start date
   * @param {Date|string} endDate - End date
   * @param {Array<number>} instructorIds - Optional array of instructor IDs to filter
   * @returns {Promise<Array>}
   */
  static getScoresByDateRange(startDate, endDate, instructorIds = null) {
    return new Promise((resolve, reject) => {
      let sql = `
        SELECT ms.*, m.title as meeting_title, m.platform, m.scheduled_start_time as meeting_date,
               CONCAT(u.first_name, ' ', u.last_name) as reviewer_name, m.created_by as instructor_id
        FROM meeting_scores ms
        LEFT JOIN meetings m ON m.external_meeting_id = ms.meeting_id
        LEFT JOIN users u ON u.id = ms.reviewer_id
        WHERE ms.scored_at >= ? AND ms.scored_at <= ?
      `;
      
      const params = [startDate, endDate];
      
      if (instructorIds && instructorIds.length > 0) {
        sql += ` AND m.created_by IN (${instructorIds.map(() => '?').join(',')})`;
        params.push(...instructorIds);
      }
      
      sql += ` ORDER BY ms.scored_at DESC LIMIT 500`;
      
      db.all(sql, params, (err, rows) => {
        if (err) {
          logger.error('Model(AuditReportModel): Error fetching scores:', err);
          return reject(err);
        }
        resolve(rows || []);
      });
    });
  }

  /**
   * Get recent AI audit results with meeting info, with date range and instructor filtering.
   * @param {Date|string} startDate - Start date
   * @param {Date|string} endDate - End date
   * @param {Array<number>} instructorIds - Optional array of instructor IDs to filter
   * @returns {Promise<Array>}
   */
  static getAuditResultsByDateRange(startDate, endDate, instructorIds = null) {
    return new Promise((resolve, reject) => {
      let sql = `
        SELECT aar.*, m.title as meeting_title, m.scheduled_start_time as meeting_date, m.created_by as instructor_id
        FROM ai_audit_results aar
        LEFT JOIN meetings m ON m.external_meeting_id = aar.meeting_id
        WHERE aar.scored_at >= ? AND aar.scored_at <= ?
      `;
      
      const params = [startDate, endDate];
      
      if (instructorIds && instructorIds.length > 0) {
        sql += ` AND m.created_by IN (${instructorIds.map(() => '?').join(',')})`;
        params.push(...instructorIds);
      }
      
      sql += ` ORDER BY aar.scored_at DESC LIMIT 200`;
      
      db.all(sql, params, (err, rows) => {
        if (err) {
          logger.error('Model(AuditReportModel): Error fetching audit results:', err);
          return reject(err);
        }
        resolve(rows || []);
      });
    });
  }

  /**
   * Get active instructors, optionally filtered by calendar connection status
   * @param {number} companyId - Company ID
   * @param {boolean} calendarConnectedOnly - If true, only return instructors with active calendar connections
   * @returns {Promise<Array>}
   */
  static getActiveInstructors(companyId, calendarConnectedOnly = false) {
    return new Promise((resolve, reject) => {
      let sql = `
        SELECT DISTINCT u.id, CONCAT(u.first_name, ' ', u.last_name) as name, u.email
        FROM users u
        WHERE u.company_id = ? AND u.status = 'active' AND u.role_id IN (
          SELECT id FROM roles WHERE role_name IN ('instructor', 'solo_instructor')
        )
      `;
      
      const params = [companyId];
      
      if (calendarConnectedOnly) {
        sql += ` AND EXISTS (
          SELECT 1 FROM calendar_connections cc 
          WHERE cc.user_id = u.id AND cc.connection_status = 'active'
        )`;
      }
      
      sql += ` ORDER BY u.first_name, u.last_name`;
      
      db.all(sql, params, (err, rows) => {
        if (err) {
          logger.error('Model(AuditReportModel): Error fetching instructors:', err);
          return reject(err);
        }
        resolve(rows || []);
      });
    });
  }

  /**
   * Legacy method: Get recent meeting scores (days-based)
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
   * Legacy method: Get recent AI audit results (days-based)
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
