/**
 * root/models/transcriptModel.js
 */
const { db } = require('../database/db');
const { logger } = require('../utils/logger');

// Promisified run helper matching the MySQL shim's callback style
const run = (sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, function (err) {
    if (err) return reject(err);
    resolve({ lastID: this.lastID, changes: this.changes });
  });
});

const get = (sql, params = []) => new Promise((resolve, reject) => {
  db.get(sql, params, (err, row) => {
    if (err) return reject(err);
    resolve(row || null);
  });
});

class TranscriptModel {

  static async createSession(meetingId) {
    // Use INSERT IGNORE via ON DUPLICATE KEY for MySQL compatibility
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

  static saveTranscriptFile(sessionId, fileName) {
    return new Promise((resolve, reject) => {
      if (!sessionId || !fileName) {
        resolve(false);
        return;
      }

      db.run('UPDATE meeting_sessions SET transcript_file_name = ? WHERE id = ?', [fileName, sessionId], function(err) {
        if (err) {
          logger.error('Model(transcriptModel): Error saving transcript file name:', err);
          reject(err);
        } else {
          resolve(this.changes > 0);
        }
      });
    });
  }

  static saveAudioFile(sessionId, filePath) {
    return new Promise((resolve, reject) => {
      if (!sessionId || !filePath) {
        resolve(false);
        return;
      }

      db.run('UPDATE meeting_sessions SET audio_file_name = ? WHERE id = ?', [filePath, sessionId], function(err) {
        if (err) {
          logger.error('Model(transcriptModel): Error saving audio file path:', err);
          reject(err);
        } else {
          resolve(this.changes > 0);
        }
      });
    });
  }

  static getTranscriptFilePathByMeeting(meetingId) {
    return new Promise((resolve, reject) => {
      db.get('SELECT transcript_file_name FROM meeting_sessions WHERE meeting_id = ? ORDER BY id DESC LIMIT 1', [meetingId], (err, row) => {
        if (err) {
          logger.error('Model(transcriptModel): Error fetching transcript file from DB:', err);
          reject(err);
        } else {
          resolve(row ? row.transcript_file_name : null);
        }
      });
    });
  }

  static updateSessionEnd(sessionId) {
    return new Promise((resolve, reject) => {
      db.run('UPDATE meeting_sessions SET end_time = CURRENT_TIMESTAMP WHERE id = ?', [sessionId], function(err) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });
  }

  static getSessionByMeetingId(meetingId) {
    return new Promise((resolve, reject) => {
      db.get(`
        SELECT s.id, s.meeting_id, s.transcript_file_name, s.audio_file_name, s.start_time, s.end_time
        FROM meeting_sessions s
        WHERE s.meeting_id = ?
        GROUP BY s.id
        ORDER BY s.id DESC
        LIMIT 1
      `, [meetingId], (err, row) => {
        if (err) {
          logger.error('Model(transcriptModel): Error fetching session by meeting ID:', err);
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  static getSessionById(sessionId) {
    return new Promise((resolve, reject) => {
      db.get(`
        SELECT s.id, s.meeting_id, s.transcript_file_name, s.start_time, s.end_time
        FROM meeting_sessions s
        WHERE s.id = ?
        GROUP BY s.id
      `, [sessionId], (err, row) => {
        if (err) {
          logger.error('Model(transcriptModel): Error fetching session by ID:', err);
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }
}

module.exports = TranscriptModel;