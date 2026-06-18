/**
 * root/models/TeacherCoachingFeedbackModel.js
 */
const { db } = require('../database/db');
const { logger } = require('../utils/logger');

class TeacherCoachingFeedbackModel {
  static create(item) {
    return new Promise((resolve, reject) => {
      const sql = `INSERT INTO teacher_coaching_feedback (meeting_id, feedback_type, area, evidence, why_it_matters, recommended_action, created_at) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`;
      db.run(sql, [item.meeting_id, item.feedback_type, item.area, item.evidence || null, item.why_it_matters || null, item.recommended_action || null], function(err) {
        if (err) { logger.error('[TeacherCoachingFeedbackModel] create error', err); return reject(err); }
        resolve({ id: this.lastID });
      });
    });
  }

  static listByMeeting(meetingId) {
    return new Promise((resolve, reject) => db.all('SELECT * FROM teacher_coaching_feedback WHERE meeting_id = ? ORDER BY id ASC', [meetingId], (err, rows) => err ? reject(err) : resolve(rows || [])));
  }

  static delete(id) {
    return new Promise((resolve, reject) => db.run('DELETE FROM teacher_coaching_feedback WHERE id = ?', [id], function(err) { if (err) return reject(err); resolve({ deleted: this.changes > 0 }); }));
  }
}

module.exports = TeacherCoachingFeedbackModel;
