/**
 * root/models/recordings/VideoRecordingsModel.js
 * Model for video recordings - only database queries
 */
const { db } = require('../../database/db');
const { logger } = require('../../utils/logger');

class VideoRecordingsModel {

  /**
   * Get all assets (video/audio/summary) with filters.
   * One shared query used by both the "videos" and "summaries" endpoints —
   * only the WHERE-clause asset condition changes based on assetType.
   *
   * @param {Object} filters - { startDate, endDate, instructorId, limit }
   * @param {number} userId - Current user ID
   * @param {string} userRole - User role for permission check
   * @param {number} companyId - Company ID for admin scoping
   * @param {string} assetType - 'video' (default) or 'summary'
   * @returns {Array} List of meeting rows with joined asset data
   */
  static getAssets(filters, userId, userRole, companyId, assetType = 'video') {
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
          u.id as user_id,
          u.first_name as instructor_first_name,
          u.last_name as instructor_last_name,
          u.email as instructor_email,
          ms.id as session_id,
          ms.transcript_file_name,
          ms.audio_file_name,
          ms.start_time as session_start_time,
          ms.end_time as session_end_time,
          ms.status as session_status,
          ma.audio_path,
          ma.video_path,
          ma.summary_path,
          ma.transcript_path,
          ma.oqi_score,
          ma.audit_summary,
          ma.status as asset_status
        FROM meetings m
        LEFT JOIN users u ON LOWER(u.email) = LOWER(m.calendar_account)
        LEFT JOIN meeting_assets ma ON ma.meeting_id = m.id
        LEFT JOIN meeting_sessions ms ON ms.id = ma.session_id
      `;

      const params = [];
      const conditions = [];

      // Asset-type specific condition
      if (assetType === 'summary') {
        conditions.push(`ma.summary_path IS NOT NULL`);
      } else {
        conditions.push(`(ma.audio_path IS NOT NULL OR ma.video_path IS NOT NULL)`);
      }

      // Admin sees meetings from all instructors in their company
      if (userRole === 'admin') {
        conditions.push(`LOWER(m.calendar_account) IN (SELECT LOWER(email) FROM users WHERE company_id = ? AND role_id IN (SELECT id FROM roles WHERE role_name IN ('instructor', 'solo_instructor')))`);
        params.push(companyId);
      }

      // Apply date filters
      if (filters.startDate) {
        conditions.push(`m.scheduled_start_time >= ?`);
        params.push(filters.startDate + ' 00:00:00');
      }

      if (filters.endDate) {
        conditions.push(`m.scheduled_start_time <= ?`);
        params.push(filters.endDate + ' 23:59:59');
      }

      // Apply instructor filter (resolve by user email)
      if (filters.instructorId) {
        conditions.push(`LOWER(m.calendar_account) = (SELECT LOWER(email) FROM users WHERE id = ?)`);
        params.push(filters.instructorId);
      }

      if (conditions.length) {
        sql += ` WHERE ` + conditions.join(' AND ');
      }

      sql += ` ORDER BY m.scheduled_start_time DESC`;

      if (filters.limit) {
        sql += ` LIMIT ?`;
        params.push(filters.limit);
      }
      db.all(sql, params, (err, rows) => {
        if (err) {
          logger.error('[VideoRecordingsModel] Get assets error:', err);
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
        SELECT DISTINCT u.id, u.first_name, u.last_name, u.email
        FROM users u
        WHERE u.role_id = (SELECT id FROM roles WHERE role_name = 'instructor')
        AND u.status = 'active'
        AND u.deleted_at IS NULL
      `;

      const params = [];

      // Admin can only see their own instructors
      if (userRole === 'admin') {
        sql += ` AND u.created_by = ?`;
        params.push(userId);
      }

      sql += ` ORDER BY u.first_name, u.last_name`;

      db.all(sql, params, (err, rows) => {
        if (err) {
          logger.error('[VideoRecordingsModel] Get instructors error:', err);
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  /**
   * Get recording by meeting ID
   * @param {number} meetingId - Meeting ID
   * @returns {Object} Recording details
   */
  static getRecordingByMeetingId(meetingId) {
    return new Promise((resolve, reject) => {
      const sql = `
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
          u.first_name as instructor_first_name,
          u.last_name as instructor_last_name,
          u.email as instructor_email,
          ms.id as session_id,
          ms.transcript_file_name,
          ms.audio_file_name,
          ms.start_time as session_start_time,
          ms.end_time as session_end_time,
          ma.audio_path,
          ma.video_path,
          ma.transcript_path,
          ma.oqi_score,
          ma.audit_summary,
          ma.status as asset_status
        FROM meetings m
        LEFT JOIN users u ON m.created_by = u.id
        LEFT JOIN meeting_sessions ms ON ms.meeting_id = m.id
        LEFT JOIN meeting_assets ma ON ma.meeting_id = m.id
        WHERE m.id = ?
        LIMIT 1
      `;

      db.get(sql, [meetingId], (err, row) => {
        if (err) {
          logger.error('[VideoRecordingsModel] Get Video recording by ID error:', err);
          reject(err);
        } else {
          resolve(row || null);
        }
      });
    });
  }
}

module.exports = VideoRecordingsModel;