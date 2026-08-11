/**
 * root/models/SessionParentSummaryModel.js
 *
 * Session parent summary (session_parent_summary table).
 * Supports both meeting_id (legacy) and session_id (current) lookups.
 */
const { db } = require('../../database/db');
const { logger } = require('../../utils/logger');

class SessionParentSummaryModel {
  // ── Legacy meeting_id API ──────────────────────────────────────────────────
  static upsertByMeeting(summary) {
    return new Promise((resolve, reject) => {
      const sql = `INSERT INTO session_parent_summary (meeting_id, what_was_covered, how_student_participated, progress_noticed, needs_more_practice, home_support_suggestions, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON DUPLICATE KEY UPDATE what_was_covered=VALUES(what_was_covered), how_student_participated=VALUES(how_student_participated), progress_noticed=VALUES(progress_noticed), needs_more_practice=VALUES(needs_more_practice), home_support_suggestions=VALUES(home_support_suggestions), updated_at=CURRENT_TIMESTAMP`;
      const params = [summary.meeting_id, summary.what_was_covered || null, summary.how_student_participated || null, summary.progress_noticed || null, summary.needs_more_practice || null, summary.home_support_suggestions || null];
      db.run(sql, params, function(err) {
        if (err) { logger.error('[SessionParentSummaryModel] upsertByMeeting error', err); return reject(err); }
        resolve({ id: this.lastID, changes: this.changes });
      });
    });
  }

  static getByMeeting(meetingId) {
    return new Promise((resolve, reject) => db.get('SELECT * FROM session_parent_summary WHERE meeting_id = ? LIMIT 1', [meetingId], (err, row) => err ? reject(err) : resolve(row || null)));
  }

  // ── Current session_id API ─────────────────────────────────────────────────
  static upsert(data) {
    return new Promise((resolve, reject) => {
      const sql = `INSERT INTO session_parent_summary 
        (session_id, covered_text, participation_text, progress_text, needs_practice_text, home_support_tips, created_at, updated_at) 
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) 
        ON DUPLICATE KEY UPDATE 
        covered_text=VALUES(covered_text), 
        participation_text=VALUES(participation_text), 
        progress_text=VALUES(progress_text), 
        needs_practice_text=VALUES(needs_practice_text), 
        home_support_tips=VALUES(home_support_tips), 
        updated_at=CURRENT_TIMESTAMP`;
      
      const params = [
        data.session_id,
        data.covered_text || '',
        data.participation_text || '',
        data.progress_text || '',
        data.needs_practice_text || '',
        JSON.stringify(data.home_support_tips || [])
      ];
      
      db.run(sql, params, function(err) {
        if (err) { 
          logger.error('[SessionParentSummaryModel] upsert error', err); 
          return reject(err); 
        }
        resolve({ id: this.lastID, changes: this.changes });
      });
    });
  }

  static findBySessionId(sessionId) {
    return new Promise((resolve, reject) => {
      const sql = `SELECT * FROM session_parent_summary WHERE session_id = ? LIMIT 1`;
      
      db.get(sql, [sessionId], (err, row) => {
        if (err) { 
          logger.error('[SessionParentSummaryModel] findBySessionId error', err); 
          return reject(err); 
        }
        if (row) {
          try {
            row.home_support_tips = typeof row.home_support_tips === 'string' 
              ? JSON.parse(row.home_support_tips) : row.home_support_tips;
          } catch (e) {
            logger.warn('[SessionParentSummaryModel] JSON parse warning', e);
          }
        }
        resolve(row || null);
      });
    });
  }

  static deleteBySession(sessionId) {
    return new Promise((resolve, reject) => {
      const sql = `DELETE FROM session_parent_summary WHERE session_id = ?`;
      
      db.run(sql, [sessionId], function(err) {
        if (err) { 
          logger.error('[SessionParentSummaryModel] deleteBySession error', err); 
          return reject(err); 
        }
        resolve({ changes: this.changes });
      });
    });
  }
}

module.exports = SessionParentSummaryModel;
