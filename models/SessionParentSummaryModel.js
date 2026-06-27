/**
 * root/models/SessionParentSummaryModel.js
 */
const { db } = require('../database/db');
const { logger } = require('../utils/logger');

class SessionParentSummaryModel {
  static upsert(summary) {
    return new Promise((resolve, reject) => {
      const sql = `INSERT INTO session_parent_summary (meeting_id, what_was_covered, how_student_participated, progress_noticed, needs_more_practice, home_support_suggestions, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON DUPLICATE KEY UPDATE what_was_covered=VALUES(what_was_covered), how_student_participated=VALUES(how_student_participated), progress_noticed=VALUES(progress_noticed), needs_more_practice=VALUES(needs_more_practice), home_support_suggestions=VALUES(home_support_suggestions), updated_at=CURRENT_TIMESTAMP`;
      const params = [summary.meeting_id, summary.what_was_covered || null, summary.how_student_participated || null, summary.progress_noticed || null, summary.needs_more_practice || null, summary.home_support_suggestions || null];
      db.run(sql, params, function(err) {
        if (err) { logger.error('[SessionParentSummaryModel] upsert error', err); return reject(err); }
        resolve({ id: this.lastID, changes: this.changes });
      });
    });
  }

  static getByMeeting(meetingId) {
    return new Promise((resolve, reject) => db.get('SELECT * FROM session_parent_summary WHERE meeting_id = ? LIMIT 1', [meetingId], (err, row) => err ? reject(err) : resolve(row || null)));
  }
}

module.exports = SessionParentSummaryModel;
