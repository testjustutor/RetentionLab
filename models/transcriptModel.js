/**
 * root/models/transcriptModel.js
 */
const { db } = require('../database/db');
const { logger } = require('../utils/logger');

class TranscriptModel {

  static createSession(meetingId) {
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('INSERT OR IGNORE INTO meeting_sessions (meeting_id) VALUES (?)', [meetingId], function(err) {
          if (err) {
            logger.error('Model(transcriptModel): Error creating session:', err);
            reject(err);
            return;
          }

          db.get('SELECT id, meeting_id, transcript_file_name FROM meeting_sessions WHERE meeting_id = ?', [meetingId], (selectErr, row) => {
            if (selectErr) {
              logger.error('Model(transcriptModel): Error selecting session after create:', selectErr);
              reject(selectErr);
            } else {
              resolve(row || { id: this.lastID, meeting_id: meetingId });
            }
          });
        });
      });
    });
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

