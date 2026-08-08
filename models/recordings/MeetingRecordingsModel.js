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
    let sql = `
      SELECT m.*, ma.*, ms.transcript_file_name as session_transcript_file
      FROM meetings m 
      LEFT JOIN meeting_assets ma ON ma.meeting_id = m.external_meeting_id
      LEFT JOIN meeting_sessions ms ON ms.meeting_id = m.external_meeting_id
      WHERE 1=1
    `;
    const params = [];

    // If userId is provided, get recordings for that specific instructor
    if (userId) {
      // First try to get from calendar_integrations
      const conns = await CalendarUsersModel.getAllUsers();
      const conn = (conns || []).find(c => (c.user_id || c.user_id_ref) == userId && c.status === 'active');
      
      if (conn && conn.email) {
        sql += ` AND LOWER(m.calendar_account)=LOWER(?)`;
        params.push(conn.email);
      } else {
        // If not found in calendar_integrations, try to get email from users table
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

      // First try to get from calendar_integrations
      const conns = await CalendarUsersModel.getAllUsers();
      const conn = (conns || []).find(c => (c.user_id || c.user_id_ref) == userId && c.status === 'active');
      
      if (conn && conn.email) {
        sql += ` AND LOWER(m.calendar_account)=LOWER(?)`;
        params.push(conn.email);
      } else {
        // If not found in calendar_integrations, try to get email from users table
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

    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) {
          logger.error('[MeetingRecordingsModel] Fetch meetings error:', err);
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
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
    
    // If no instructors found in users table, try calendar_integrations as fallback
    if (emails.length === 0) {
      const conns = await CalendarUsersModel.getAllUsers({ createdBy: adminId, excludeSelf: true, adminId: adminId });
      emails = (conns || [])
        .filter(c => c.email && c.status === 'active')
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
    const sql = `
      SELECT m.*, ma.*, ms.transcript_file_name, ms.audio_file_name
      FROM meetings m
      LEFT JOIN meeting_assets ma ON ma.meeting_id = m.external_meeting_id
      LEFT JOIN meeting_sessions ms ON ms.meeting_id = m.external_meeting_id
      WHERE LOWER(m.calendar_account) IN (${placeholders})
      AND (
        m.status = 'completed'
        OR m.scheduled_end_time < NOW()
      )
      ORDER BY m.scheduled_start_time DESC
      LIMIT ?
    `;

    const params = [...instructorEmails, limit];

    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) {
          logger.error('[MeetingRecordingsModel] Get recordings for admin error:', err);
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }
}

module.exports = MeetingRecordingsModel;