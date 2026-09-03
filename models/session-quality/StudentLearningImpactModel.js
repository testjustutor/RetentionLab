/**
 * root/models/StudentLearningImpactModel.js
 */
const { db } = require('../../database/db');
const { logger } = require('../../utils/logger');

class StudentLearningImpactModel {
  static create(record) {
    return new Promise((resolve, reject) => {
      const sql = `INSERT INTO student_learning_impact (meeting_id, impact_area, observation, evidence, impact_level, created_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`;
      db.run(sql, [record.meeting_id, record.impact_area, record.observation || null, record.evidence || null, record.impact_level || null], function(err) {
        if (err) { logger.error('[StudentLearningImpactModel] create error', err); return reject(err); }
        resolve({ id: this.lastID });
      });
    });
  }

  static listByMeeting(meetingId) {
    return new Promise((resolve, reject) => db.all('SELECT * FROM student_learning_impact WHERE meeting_id = ? ORDER BY id ASC', [meetingId], (err, rows) => err ? reject(err) : resolve(rows || [])));
  }

  static delete(id) {
    return new Promise((resolve, reject) => db.run('DELETE FROM student_learning_impact WHERE id = ?', [id], function(err) { if (err) return reject(err); resolve({ deleted: this.changes > 0 }); }));
  }
}

module.exports = StudentLearningImpactModel;
