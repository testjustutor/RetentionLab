/**
 * root/models/recordings/SummariesModel.js
 * Model for summaries - only database queries
 * Follows same pattern as VideoRecordingsModel
 */
const { db } = require('../../database/db');
const { logger } = require('../../utils/logger');

class SummariesModel {

  /**
   * Get all summaries with filters
   * @param {Object} filters - { startDate, endDate, instructorId }
   * @param {number} userId - Current user ID
   * @param {string} userRole - User role for permission check
   * @param {number} companyId - Company ID for admin scoping
   * @returns {Array} List of summaries
   */
  static getSummaries(filters, userId, userRole, companyId) {
    return new Promise((resolve, reject) => {
      let sql = `
        SELECT 
          m.id as meeting_id,
          m.title,
          m.description,
          m.platform,
          m.meeting_link,
          m.scheduled_start_time,
          m.scheduled_end_time,
          m.actual_start_time,
          m.actual_end_time,
          m.status as meeting_status,
          m.created_by as instructor_id,
          u.first_name as instructor_first_name,
          u.last_name as instructor_last_name,
          u.email as instructor_email,
          ms.id as session_id,
          ms.transcript_file_name,
          ms.audio_file_name,
          ms.start_time as session_start_time,
          ms.end_time as session_end_time,
          ms.status as session_status,
          ma.summary_path,
          ma.transcript_path,
          ma.audio_path,
          ma.oqi_score,
          ma.audit_summary,
          ma.status as asset_status
        FROM meetings m
        LEFT JOIN users u ON m.created_by = u.id
        LEFT JOIN meeting_sessions ms ON ms.meeting_id = m.id
        LEFT JOIN meeting_assets ma ON ma.meeting_id = m.id
        WHERE ma.summary_path IS NOT NULL
      `;

      const params = [];

      // Admin sees meetings from all instructors in their company
      if (userRole === 'admin') {
        sql += ` AND m.created_by IN (SELECT id FROM users WHERE company_id = ? AND role_id = (SELECT id FROM roles WHERE role_name = 'instructor'))`;
        params.push(companyId);
      }

      // Apply date filters
      if (filters.startDate) {
        sql += ` AND m.scheduled_start_time >= ?`;
        params.push(filters.startDate + ' 00:00:00');
      }

      if (filters.endDate) {
        sql += ` AND m.scheduled_end_time <= ?`;
        params.push(filters.endDate + ' 23:59:59');
      }

      // Apply instructor filter
      if (filters.instructorId) {
        sql += ` AND m.created_by = ?`;
        params.push(filters.instructorId);
      }

      sql += ` ORDER BY m.scheduled_start_time DESC`;

      db.all(sql, params, (err, rows) => {
        if (err) {
          logger.error('[SummariesModel] Get summaries error:', err);
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  /**
   * Get all instructors for filter dropdown
   * @param {number} userId - Current user ID
   * @param {string} userRole - User role
   * @returns {Array} List of instructors
   */
  static getInstructors(userId, userRole) {
    return new Promise((resolve, reject) => {
      let sql = `
        SELECT DISTINCT
          u.id,
          u.first_name,
          u.last_name,
          u.email
        FROM users u
        WHERE u.role_id = (SELECT id FROM roles WHERE role_name = 'instructor')
          AND u.deleted_at IS NULL
      `;

      const params = [];

      // If admin, only show instructors from their company
      if (userRole === 'admin') {
        sql += ` AND u.company_id = (SELECT company_id FROM users WHERE id = ?)`;
        params.push(userId);
      }

      sql += ` ORDER BY u.first_name, u.last_name`;

      db.all(sql, params, (err, rows) => {
        if (err) {
          logger.error('[SummariesModel] Get instructors error:', err);
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }
}

module.exports = SummariesModel;
