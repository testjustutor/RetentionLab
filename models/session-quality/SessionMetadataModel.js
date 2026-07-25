/**
 * root/models/SessionMetadataModel.js
 */
const { db } = require('../../database/db');
const { logger } = require('../../utils/logger');

class SessionMetadataModel {
  static upsert(metadata) {
    return new Promise((resolve, reject) => {
      const sql = `INSERT INTO session_metadata (meeting_id, student_grade, curriculum, student_location, subject, topic, session_objective, session_type, teacher_user_id, student_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON DUPLICATE KEY UPDATE student_grade=VALUES(student_grade), curriculum=VALUES(curriculum), student_location=VALUES(student_location), subject=VALUES(subject), topic=VALUES(topic), session_objective=VALUES(session_objective), session_type=VALUES(session_type), teacher_user_id=VALUES(teacher_user_id), student_name=VALUES(student_name), updated_at=CURRENT_TIMESTAMP`;
      const params = [metadata.meeting_id, metadata.student_grade || null, metadata.curriculum || null, metadata.student_location || null, metadata.subject || null, metadata.topic || null, metadata.session_objective || null, metadata.session_type || 'one-to-one', metadata.teacher_user_id || null, metadata.student_name || null];
      db.run(sql, params, function(err) {
        if (err) { logger.error('[SessionMetadataModel] upsert error', err); return reject(err); }
        resolve({ id: this.lastID, changes: this.changes });
      });
    });
  }

  static getByMeeting(meetingId) {
    return new Promise((resolve, reject) => db.get('SELECT * FROM session_metadata WHERE meeting_id = ? LIMIT 1', [meetingId], (err, row) => err ? reject(err) : resolve(row || null)));
  }
}

module.exports = SessionMetadataModel;
