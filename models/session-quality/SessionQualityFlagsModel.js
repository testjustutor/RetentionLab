/**
 * root/models/SessionQualityFlagsModel.js
 */
const { db } = require('../../database/db');
const { logger } = require('../../utils/logger');

class SessionQualityFlagsModel {
  static create(flag) {
    return new Promise((resolve, reject) => {
      const sql = `INSERT INTO session_quality_flags (meeting_id, flag_description, severity, evidence, recommended_fix, created_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`;
      db.run(sql, [flag.meeting_id, flag.flag_description, flag.severity, flag.evidence || null, flag.recommended_fix || null], function(err) {
        if (err) { logger.error('[SessionQualityFlagsModel] create error', err); return reject(err); }
        resolve({ id: this.lastID });
      });
    });
  }

  static listByMeeting(meetingId) {
    return new Promise((resolve, reject) => db.all('SELECT * FROM session_quality_flags WHERE meeting_id = ? ORDER BY created_at DESC', [meetingId], (err, rows) => err ? reject(err) : resolve(rows || [])));
  }

  static delete(id) {
    return new Promise((resolve, reject) => db.run('DELETE FROM session_quality_flags WHERE id = ?', [id], function(err) { if (err) return reject(err); resolve({ deleted: this.changes > 0 }); }));
  }
}

module.exports = SessionQualityFlagsModel;
