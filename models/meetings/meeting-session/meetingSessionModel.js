/**
 * root/models/meetings/meeting-session/meetingSessionModel.js
 * Meeting Session Model — all meeting_sessions database queries live here.
 */
const { db } = require('../../../database/db');
const { logger } = require('../../../utils/logger');
const { normalizeStorageRef } = require('../../../utils/storagePaths');

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
   * Create a NEW meeting_sessions row for one human/conversation segment and
   * return the created row (by its id). Every call inserts a fresh row - a new
   * conversation segment must never reuse an old row, and bot waiting-room
   * states intentionally do NOT create sessions.
   * @param {string} meetingId - meetings id (internal PK)
   * @param {string} initialStatus - starting session status (default 'human_detected')
   * @returns {Promise<Object>} created session row or { id: null, meeting_id }
   */
  static async createSession(meetingId, initialStatus = 'human_detected') {
    const result = await run(
      `INSERT INTO meeting_sessions (meeting_id, start_time, status) VALUES (?, CURRENT_TIMESTAMP, ?)`,
      [meetingId, initialStatus]
    );

    const row = await get(
      'SELECT id, meeting_id, transcript_file_name, audio_file_name, start_time, end_time, status FROM meeting_sessions WHERE id = ?',
      [result.lastID]
    );
    return row || { id: null, meeting_id: meetingId, status: initialStatus };
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
         SET audio_file_name = ?, end_time = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [normalizeStorageRef('audio', filePath), sessionId],
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
    // Terminal statuses also stamp end_time so the session keeps a clear
    // start/end window for history/auditing purposes.
    // 'no_activity' = a human was detected and a session row was created,
    // but no real speech/transcript content was ever captured before the
    // session ended — distinct from 'completed' (real conversation content
    // was processed) so the status always reflects what actually happened.
    const TERMINAL_STATUSES = ['completed', 'failed', 'no_activity'];
    const endClause = TERMINAL_STATUSES.includes(status) ? ', end_time = CURRENT_TIMESTAMP' : '';
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE meeting_sessions
         SET status = ?, updated_at = CURRENT_TIMESTAMP${endClause}
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
