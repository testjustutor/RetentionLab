/**
 * root/models/recordings/MeetingRecordingsModel.js
 * Model for meeting recordings, transcripts, summaries - only database queries
 */
const { db } = require('../../database/db');
const { logger } = require('../../utils/logger');
const CalendarUsersModel = require('../calendar/CalendarUsersModel');

class MeetingRecordingsModel {

  /**
   * Generic data fetcher for recordings, transcripts, summaries
   * @param {Object} options
   * @param {number|null} options.userId - Specific instructor user ID
   * @param {string} options.userRole - Current user role
   * @param {number} options.currentUserId - Current logged in user ID
   * @param {number} options.limit - Max records to return (default 50)
   * @param {string} options.startDate - Start date filter (YYYY-MM-DD)
   * @param {string} options.endDate - End date filter (YYYY-MM-DD)
   * @returns {Promise<Array>} Raw database rows
   */
  static async fetchMeetings({ userId, userRole, currentUserId, limit = 50, startDate, endDate }) {
    // Build base SQL for meetings + latest session (no meeting_assets join)
    // Use subquery to get only the latest session per meeting (since one meeting can have multiple sessions)
    // Note: meeting_sessions.meeting_id references meetings.id (internal ID), not external_meeting_id
    let sql = `
      SELECT m.id, m.external_meeting_id, m.title, m.description, m.scheduled_start_time, m.scheduled_end_time, 
             m.actual_start_time, m.actual_end_time, m.platform, m.calendar_account, m.meeting_link, 
             m.passcode, m.event_id, m.timezone, m.status as meeting_status, m.created_by, m.created_at, m.updated_at,
             ms.transcript_file_name as session_transcript_file, ms.audio_file_name as session_audio_file,
             ms.start_time as session_start_time, ms.end_time as session_end_time, ms.status as session_status,
             u.first_name as instructor_first_name, u.last_name as instructor_last_name,
             u.email as instructor_email
      FROM meetings m 
      LEFT JOIN meeting_sessions ms ON ms.id = (
        SELECT id FROM meeting_sessions ms2 
        WHERE ms2.meeting_id = m.id 
        ORDER BY ms2.created_at DESC 
        LIMIT 1
      )
      LEFT JOIN users u ON LOWER(u.email) = LOWER(m.calendar_account)
      WHERE 1=1
    `;
    const params = [];

    // If userId is provided, get recordings for that specific instructor
    if (userId) {
      // First try to get from calendar_connections
      const conns = await CalendarUsersModel.getAllUsers();
      const conn = (conns || []).find(c => (c.user_id || c.user_id_ref) == userId && c.connection_status === 'active');
      
      if (conn && conn.email) {
        sql += ` AND LOWER(m.calendar_account)=LOWER(?)`;
        params.push(conn.email);
      } else {
        // If not found in calendar_connections, try to get email from users table
        const user = await new Promise((resolve, reject) => {
          db.get('SELECT email FROM users WHERE id = ? AND deleted_at IS NULL', [userId], (err, row) => {
            if (err) reject(err);
            else resolve(row);
          });
        });
        
        if (user && user.email) {
          sql += ` AND LOWER(m.calendar_account)=LOWER(?)`;
          params.push(user.email);
        } else {
          // No email found, return empty result
          return [];
        }
      }
    } else if (userRole === 'admin') {

      // First try to get from calendar_connections
      const conns = await CalendarUsersModel.getAllUsers();
      const conn = (conns || []).find(c => (c.user_id || c.user_id_ref) == userId && c.connection_status === 'active');
      
      if (conn && conn.email) {
        sql += ` AND LOWER(m.calendar_account)=LOWER(?)`;
        params.push(conn.email);
      } else {
        // If not found in calendar_connections, try to get email from users table
        const user = await new Promise((resolve, reject) => {
          db.get('SELECT email FROM users WHERE id = ? AND deleted_at IS NULL', [userId], (err, row) => {
            if (err) reject(err);
            else resolve(row);
          });
        });
        
        if (user && user.email) {
          sql += ` AND LOWER(m.calendar_account)=LOWER(?)`;
          params.push(user.email);
        } else {
          // No email found, return empty result
          return [];
        }
      }
    }

    // Add date filters if provided
    if (startDate) {
      sql += ` AND DATE(m.scheduled_start_time) >= ?`;
      params.push(startDate);
    }
    if (endDate) {
      sql += ` AND DATE(m.scheduled_start_time) <= ?`;
      params.push(endDate);
    }

    sql += ` ORDER BY m.id DESC LIMIT ?`;
    params.push(limit);

    // Execute query for meetings + sessions
    const meetings = await new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) {
          logger.error('[MeetingRecordingsModel] Fetch meetings error:', err);
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });

    // Fetch meeting_assets separately for these meetings
    const meetingIds = meetings.map(m => m.external_meeting_id).filter(Boolean);
    let assetsMap = {};
    
    if (meetingIds.length > 0) {
      const placeholders = meetingIds.map(() => '?').join(',');
      const assetsSql = `
        SELECT meeting_id, audio_path,  transcript_path, summary_path, 
               oqi_score, audit_summary, audit_completed_at, status as asset_status, 
               processed_at, created_at as asset_created_at, updated_at as asset_updated_at
        FROM meeting_assets
        WHERE meeting_id IN (${placeholders})
      `;
      
      const assets = await new Promise((resolve, reject) => {
        db.all(assetsSql, meetingIds, (err, rows) => {
          if (err) {
            logger.error('[MeetingRecordingsModel] Fetch assets error:', err);
            reject(err);
          } else {
            resolve(rows || []);
          }
        });
      });

      // Create a map for quick lookup
      assets.forEach(a => {
        assetsMap[a.meeting_id] = a;
      });
    }

    // Merge meeting data with assets data
    return meetings.map(m => {
      const assets = assetsMap[m.external_meeting_id] || {};
      return { ...m, ...assets };
    });
  }

  /**
   * Get all instructors created by a specific admin
   * @param {number} adminId - Admin user ID
   * @returns {Promise<Array>} List of instructors with emails
   */
  static async getInstructorsByAdmin(adminId) {
    // First, try to get instructors from users table (more reliable)
    const instructors = await new Promise((resolve, reject) => {
      db.all(
        `SELECT u.email FROM users u 
         WHERE u.role_id = (SELECT id FROM roles WHERE role_name = 'instructor')
         AND u.deleted_at IS NULL 
         AND u.created_by = ?`,
        [adminId],
        (err, rows) => err ? reject(err) : resolve(rows || [])
      );
    });
    
    let emails = instructors
      .filter(u => u.email)
      .map(u => u.email.toLowerCase());
    
    // If no instructors found in users table, try calendar_connections as fallback
    if (emails.length === 0) {
      const conns = await CalendarUsersModel.getAllUsers({ createdBy: adminId, excludeSelf: true, adminId: adminId });
      emails = (conns || [])
        .filter(c => c.email && c.connection_status === 'active')
        .map(c => c.email.toLowerCase());
    }
    
    return emails;
  }

  /**
   * Get recordings for admin - gets all instructors' meetings that are completed or past scheduled_end_time
   * @param {number} adminId - Admin user ID
   * @param {number} limit - Max records to return
   * @returns {Promise<Array>} List of meetings with session data
   */
  static async getRecordingsForAdmin(adminId, limit = 50) {
    // Get all instructors created by this admin
    const instructorEmails = await this.getInstructorsByAdmin(adminId);
    
    if (instructorEmails.length === 0) {
      return [];
    }

    const placeholders = instructorEmails.map(() => '?').join(',');
    
    // Get meetings that are either completed OR have scheduled_end_time in the past
    // Query 1: Get meetings + latest session (no meeting_assets join)
    // Use subquery to get only the latest session per meeting
    // Note: meeting_sessions.meeting_id references meetings.id (internal ID), not external_meeting_id
    const meetingsSql = `
      SELECT m.id, m.external_meeting_id, m.title, m.description, m.scheduled_start_time, m.scheduled_end_time, 
             m.actual_start_time, m.actual_end_time, m.platform, m.calendar_account, m.meeting_link, 
             m.passcode, m.event_id, m.timezone, m.status as meeting_status, m.created_by, m.created_at, m.updated_at,
             ms.transcript_file_name as session_transcript_file, ms.audio_file_name as session_audio_file,
             ms.start_time as session_start_time, ms.end_time as session_end_time, ms.status as session_status,
             u.first_name as instructor_first_name, u.last_name as instructor_last_name,
             u.email as instructor_email
      FROM meetings m
      LEFT JOIN meeting_sessions ms ON ms.id = (
        SELECT id FROM meeting_sessions ms2 
        WHERE ms2.meeting_id = m.id 
        ORDER BY ms2.created_at DESC 
        LIMIT 1
      )
      LEFT JOIN users u ON LOWER(u.email) = LOWER(m.calendar_account)
      WHERE LOWER(m.calendar_account) IN (${placeholders})
      AND (
        m.status = 'completed'
        OR m.scheduled_end_time < NOW()
      )
      ORDER BY m.scheduled_start_time DESC
      LIMIT ?
    `;

    const meetingsParams = [...instructorEmails, limit];

    // Execute first query for meetings + sessions
    const meetings = await new Promise((resolve, reject) => {
      db.all(meetingsSql, meetingsParams, (err, rows) => {
        if (err) {
          logger.error('[MeetingRecordingsModel] Get recordings for admin error:', err);
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });

    // Query 2: Get meeting_assets separately
    const meetingIds = meetings.map(m => m.external_meeting_id).filter(Boolean);
    let assetsMap = {};
    
    if (meetingIds.length > 0) {
      const assetsPlaceholders = meetingIds.map(() => '?').join(',');
      const assetsSql = `
        SELECT meeting_id, audio_path,  transcript_path, summary_path, 
               oqi_score, audit_summary, audit_completed_at, status as asset_status, 
               processed_at, created_at as asset_created_at, updated_at as asset_updated_at
        FROM meeting_assets
        WHERE meeting_id IN (${assetsPlaceholders})
      `;
      
      const assets = await new Promise((resolve, reject) => {
        db.all(assetsSql, meetingIds, (err, rows) => {
          if (err) {
            logger.error('[MeetingRecordingsModel] Fetch assets error:', err);
            reject(err);
          } else {
            resolve(rows || []);
          }
        });
      });

      // Create a map for quick lookup
      assets.forEach(a => {
        assetsMap[a.meeting_id] = a;
      });
    }

    // Merge meeting data with assets data
    return meetings.map(m => {
      const assets = assetsMap[m.external_meeting_id] || {};
      return { ...m, ...assets };
    });
  }
}

module.exports = MeetingRecordingsModel;