/**
 * root/models/TeacherBetterAlternativesModel.js
 */
const { db } = require('../database/db');
const { logger } = require('../utils/logger');

class TeacherBetterAlternativesModel {
  static create(item) {
    return new Promise((resolve, reject) => {
      const sql = `INSERT INTO teacher_better_alternatives (meeting_id, transcript_situation, current_approach, better_alternative, purpose, created_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`;
      db.run(sql, [item.meeting_id, item.transcript_situation, item.current_approach || null, item.better_alternative || null, item.purpose || null], function(err) {
        if (err) { logger.error('[TeacherBetterAlternativesModel] create error', err); return reject(err); }
        resolve({ id: this.lastID });
      });
    });
  }

  static listByMeeting(meetingId) {
    return new Promise((resolve, reject) => db.all('SELECT * FROM teacher_better_alternatives WHERE meeting_id = ? ORDER BY id ASC', [meetingId], (err, rows) => err ? reject(err) : resolve(rows || [])));
  }

  static delete(id) {
    return new Promise((resolve, reject) => db.run('DELETE FROM teacher_better_alternatives WHERE id = ?', [id], function(err) { if (err) return reject(err); resolve({ deleted: this.changes > 0 }); }));
  }
}

module.exports = TeacherBetterAlternativesModel;
