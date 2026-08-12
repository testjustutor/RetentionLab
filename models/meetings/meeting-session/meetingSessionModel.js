/**
 * root/models/meetings/meeting-session/meetingSessionModel.js
 * Meeting Session Model — all meeting_sessions database queries live here.
 */
const { db } = require('../../../database/db');
const { logger } = require('../../../utils/logger');

// Promisified run helper matching the MySQL shim's callback style
const run = (sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, function (err) {
    if (err) return reject(err);
    resolve({ lastID: this.lastID, changes: this.changes });
  });
});

// Promisified get helper returning a single row (or null)
const get = (sql, params = []) => new Promise((resolve, reject) => {
  db.get(sql, params, (err, row) => {
    if (err) return reject(err);
    resolve(row || null);
  });
});

class MeetingSessionModel {
  /**
   * Create (or reuse) a meeting session row and return it.
   * Uses INSERT IGNORE via ON DUPLICATE KEY for MySQL compatibility, then
   * reads back the latest session for the meeting.
   * @param {string} meetingId - meetings id
   * @returns {Promise<Object>} session row or { id: null, meeting_id }
   */
  static async createSession(meetingId) {
    await run(
      `INSERT INTO meeting_sessions (meeting_id, start_time) VALUES (?, CURRENT_TIMESTAMP)
       ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)`,
      [meetingId]
    );

    const row = await get(
      'SELECT id, meeting_id, transcript_file_name FROM meeting_sessions WHERE meeting_id = ? ORDER BY id DESC LIMIT 1',
      [meetingId]
    );
    return row || { id: null, meeting_id: meetingId };
  }
  /**
   * Fetch a single session row by its id.
   * @param {number} sessionId - meeting_sessions.id
   * @returns {Promise<Object|null>}
   */
  static getById(sessionId) {
    return new Promise((resolve, reject) => {
      db.get(
        `
        SELECT s.id, s.meeting_id, s.transcript_file_name, s.audio_file_name,
               s.start_time, s.end_time, s.status
        FROM meeting_sessions s
        WHERE s.id = ?
      `,
        [sessionId],
        (err, row) => {
          if (err) {
            logger.error('Model(MeetingSessionModel): Error fetching session by ID:', err);
            return reject(err);
          }
          resolve(row || null);
        }
      );
    });
  }

  /**
   * Persist the recorded audio file path on the session.
   * @param {number} sessionId - meeting_sessions.id
   * @param {string} filePath - audio file path
   * @returns {Promise<boolean>} true if a row was updated
   */
  static updateAudioPath(sessionId, filePath) {
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE meeting_sessions
         SET audio_file_name = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [filePath, sessionId],
        function (err) {
          if (err) {
            logger.error('Model(MeetingSessionModel): Error saving audio file path:', err);
            return reject(err);
          }
          resolve(this.changes > 0);
        }
      );
    });
  }

  /**
   * Update a session's status.
   * @param {number} sessionId - meeting_sessions.id
   * @param {string} status - e.g. 'completed'
   * @returns {Promise<boolean>} true if a row was updated
   */
  static updateStatus(sessionId, status) {
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE meeting_sessions
         SET status = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [status, sessionId],
        function (err) {
          if (err) {
            logger.error('Model(MeetingSessionModel): Error updating session status:', err);
            return reject(err);
          }
          resolve(this.changes > 0);
        }
      );
    });
  }
}

module.exports = MeetingSessionModel;
