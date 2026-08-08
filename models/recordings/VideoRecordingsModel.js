/**
 * root/models/recordings/VideoRecordingsModel.js
 * Model for video recordings - only database queries
 */
const { db } = require('../../database/db');
const { logger } = require('../../utils/logger');

class VideoRecordingsModel {

  /**
   * Get all recordings with filters
   * @param {Object} filters - { startDate, endDate, instructorId }
   * @param {number} userId - Current user ID for company scoping
   * @param {string} userRole - User role for permission check
   * @returns {Array} List of recordings
   */
  static getRecordings(filters, userId, userRole) {
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
          ma.audio_path,
          ma.wav_audio_path,
          ma.transcript_path,
          ma.oqi_score,
          ma.audit_summary,
          ma.status as asset_status
        FROM meetings m
        LEFT JOIN users u ON m.created_by = u.id
        LEFT JOIN meeting_sessions ms ON ms.meeting_id = m.id
        LEFT JOIN meeting_assets ma ON ma.meeting_id = m.id
        WHERE (ma.audio_path IS NOT NULL OR ma.wav_audio_path IS NOT NULL)
      `;

      const params = [];

      // Admin can only see their own created meetings
      if (userRole === 'admin') {
        sql += ` AND m.created_by = ?`;
        params.push(userId);
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
          logger.error('[VideoRecordingsModel] Get recordings error:', err);
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
          ma.wav_audio_path,
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
          logger.error('[VideoRecordingsModel] Get recording by ID error:', err);
          reject(err);
        } else {
          resolve(row || null);
        }
      });
    });
  }
}

module.exports = VideoRecordingsModel;