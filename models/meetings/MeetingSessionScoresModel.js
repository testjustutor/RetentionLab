/**
 * root/models/MeetingSessionScoresModel.js
 */
const { db } = require('../../database/db');
const { logger } = require('../../utils/logger');

class MeetingSessionScoresModel {
  /**
   * Upsert a granular evaluation score for an indicator during a specific session
   * @param {Object} data - Score details containing meeting_id, session_id, indicator_id, score, score_type, comment, and reviewer_id
   */
  static upsertScore(data) {
    return new Promise((resolve, reject) => {
      if (!data || !data.meeting_id || data.session_id === undefined || !data.indicator_id) {
        return reject(new Error('Missing required unique identifiers for session score upsert'));
      }

      const sql = `
        INSERT INTO meeting_session_scores (
          meeting_id, session_id, indicator_id, score, score_type, comment, reviewer_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          score = VALUES(score),
          comment = VALUES(comment),
          score_type = VALUES(score_type),
          reviewer_id = VALUES(reviewer_id),
          scored_at = CURRENT_TIMESTAMP
      `;

      const params = [
        data.meeting_id,
        Number(data.session_id),
        data.indicator_id,
        Number(data.score ?? 0),
        data.score_type || 'AI',
        data.comment || null,
        data.reviewer_id ? Number(data.reviewer_id) : null
      ];

      db.run(sql, params, function (err) {
        if (err) {
          logger.error(`Error upserting session score: ${err.message}`);
          return reject(err);
        }
        resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  }

  /**
   * Retrieve all granular indicator evaluations linked to a matching session
   * @param {string} meetingId - Target meeting unique tracking ID
   * @param {number|string} sessionId - Specific internal session tracking reference counter
   */
  static getScoresBySession(meetingId, sessionId) {
    return new Promise((resolve, reject) => {
      if (!meetingId || sessionId === undefined) {
        return reject(new Error('Both meetingId and sessionId are required parameters'));
      }

      const sql = `
        SELECT s.*, i.name AS indicator_name, c.name AS category_name, c.weight AS category_weight 
        FROM meeting_session_scores s
        JOIN admin_rubric_indicators i ON s.indicator_id = i.id
        JOIN admin_rubric_categories c ON i.admin_category_id = c.id
        WHERE s.meeting_id = ? AND s.session_id = ?
        ORDER BY c.name ASC, i.name ASC
      `;

      db.all(sql, [meetingId, Number(sessionId)], (err, rows) => {
        if (err) {
          logger.error(`Error fetching scores by session: ${err.message}`);
          return reject(err);
        }
        resolve(rows || []);
      });
    });
  }

  /**
   * Wipe all session scores linked to an individual meeting record
   * @param {string} meetingId - Meeting UUID reference string
   */
  static clearSessionScoresByMeeting(meetingId) {
    return new Promise((resolve, reject) => {
      if (!meetingId) return reject(new Error('Meeting ID required for clear action'));
      
      db.run('DELETE FROM meeting_session_scores WHERE meeting_id = ?', [meetingId], function (err) {
        if (err) {
          logger.error(`Error clearing scores for meeting ${meetingId}: ${err.message}`);
          return reject(err);
        }
        resolve({ changes: this.changes });
      });
    });
  }

  /**
   * Wipe all session scores for a specific session in a meeting
   * @param {string} meetingId - Meeting UUID reference string
   * @param {number|string} sessionId - Session identifier
   */
  static clearSessionScoresBySession(meetingId, sessionId) {
    return new Promise((resolve, reject) => {
      if (!meetingId || sessionId === undefined) {
        return reject(new Error('Meeting ID and session ID required for clear action'));
      }
      
      db.run(
        'DELETE FROM meeting_session_scores WHERE meeting_id = ? AND session_id = ?', 
        [meetingId, Number(sessionId)],
        function (err) {
          if (err) {
            logger.error(`Error clearing scores for meeting ${meetingId} session ${sessionId}: ${err.message}`);
            return reject(err);
          }
          resolve({ changes: this.changes });
        }
      );
    });
  }

  /**
   * Get all scores with meeting and reviewer details for reports
   * @param {number} days - Number of days to look back
   * @returns {Promise<Array>} Array of scores with meeting and reviewer information
   */
  static async getAllScoresWithDetails(days = 90) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT ms.*, m.title as meeting_title, m.scheduled_start_time as meeting_date,
               CONCAT(u.first_name, ' ', u.last_name) as reviewer_name
        FROM meeting_scores ms
        LEFT JOIN meetings m ON m.external_meeting_id = ms.meeting_id
        LEFT JOIN users u ON u.id = ms.reviewer_id
        WHERE ms.scored_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        ORDER BY ms.scored_at DESC
        LIMIT 200
      `;

      db.all(sql, [days], (err, rows) => {
        if (err) {
          logger.error('Model(MeetingSessionScoresModel): Error fetching all scores:', err);
          return reject(err);
        }
        resolve(rows || []);
      });
    });
  }
}

module.exports = MeetingSessionScoresModel;