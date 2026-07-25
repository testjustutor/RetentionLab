/**
 * root/models/SessionAnalysisModel.js
 */
const { db } = require('../../database/db');
const { logger } = require('../../utils/logger');

class SessionAnalysisModel {
  static create(item) {
    return new Promise((resolve, reject) => {
      const sql = `INSERT INTO session_analysis (meeting_id, analysis_type, description, evidence, created_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`;
      db.run(sql, [item.meeting_id, item.analysis_type, item.description, item.evidence || null], function(err) {
        if (err) { logger.error('[SessionAnalysisModel] create error', err); return reject(err); }
        resolve({ id: this.lastID });
      });
    });
  }

  static listByMeeting(meetingId) {
    return new Promise((resolve, reject) => db.all('SELECT * FROM session_analysis WHERE meeting_id = ? ORDER BY created_at ASC', [meetingId], (err, rows) => err ? reject(err) : resolve(rows || [])));
  }

  static delete(id) {
    return new Promise((resolve, reject) => db.run('DELETE FROM session_analysis WHERE id = ?', [id], function(err) { if (err) return reject(err); resolve({ deleted: this.changes > 0 }); }));
  }
}

module.exports = SessionAnalysisModel;
