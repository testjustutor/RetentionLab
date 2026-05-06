const { db } = require('../database/db');
const { logger } = require('../utils/logger');

class TranscriptModel {
  static createTranscript(sessionId, speaker, text, timestamp) {
    return new Promise((resolve, reject) => {
      const stmt = db.prepare('INSERT INTO transcripts (meeting_session_id, speaker, text, timestamp) VALUES (?, ?, ?, ?)');
      stmt.run(sessionId, speaker || 'Unknown', text.trim(), timestamp, function(err) {
        stmt.finalize();
        if (err) {
          logger.error('Error creating transcript:', err);
          reject(err);
        } else {
          logger.info(`Transcript saved: ${speaker || 'Unknown'} - ${text.substring(0, 50)}...`);
          resolve({ id: this.lastID, speaker, text, timestamp });
        }
      });
    });
  }

  static getTranscriptsBySession(sessionId) {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM transcripts WHERE meeting_session_id = ? ORDER BY timestamp ASC', [sessionId], (err, rows) => {
        if (err) {
          logger.error('Error fetching transcripts:', err);
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  static getTranscriptsByMeeting(meetingId) {
    return new Promise((resolve, reject) => {
      db.all(`
        SELECT t.*, s.meeting_id 
        FROM transcripts t 
        JOIN meeting_sessions s ON t.meeting_session_id = s.id 
        WHERE s.meeting_id = ? 
        ORDER BY t.timestamp ASC
      `, [meetingId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  static createSession(meetingId) {
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('INSERT OR IGNORE INTO meeting_sessions (meeting_id) VALUES (?)', [meetingId], function(err) {
          if (err) {
            logger.error('Error creating session:', err);
            reject(err);
            return;
          }

          db.get('SELECT id, meeting_id, transcript_file_name FROM meeting_sessions WHERE meeting_id = ?', [meetingId], (selectErr, row) => {
            if (selectErr) {
              logger.error('Error selecting session after create:', selectErr);
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
          logger.error('Error saving transcript file name:', err);
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
          logger.error('Error saving audio file path:', err);
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
          logger.error('Error fetching transcript file from DB:', err);
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

  static getAllTranscripts() {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM transcripts ORDER BY timestamp DESC', (err, rows) => {
        if (err) {
          logger.error('Error fetching all transcripts:', err);
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  static getSessionByMeetingId(meetingId) {
    return new Promise((resolve, reject) => {
      db.get(`
        SELECT s.id, s.meeting_id, s.transcript_file_name, s.start_time, s.end_time, 
               COUNT(t.id) as transcript_count
        FROM meeting_sessions s
        LEFT JOIN transcripts t ON s.id = t.meeting_session_id
        WHERE s.meeting_id = ?
        GROUP BY s.id
        ORDER BY s.id DESC
        LIMIT 1
      `, [meetingId], (err, row) => {
        if (err) {
          logger.error('Error fetching session by meeting ID:', err);
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
        SELECT s.id, s.meeting_id, s.transcript_file_name, s.start_time, s.end_time,
               COUNT(t.id) as transcript_count
        FROM meeting_sessions s
        LEFT JOIN transcripts t ON s.id = t.meeting_session_id
        WHERE s.id = ?
        GROUP BY s.id
      `, [sessionId], (err, row) => {
        if (err) {
          logger.error('Error fetching session by ID:', err);
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }
}

module.exports = TranscriptModel;

