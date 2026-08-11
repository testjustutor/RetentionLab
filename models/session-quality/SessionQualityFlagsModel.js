/**
 * root/models/SessionQualityFlagsModel.js
 *
 * Session quality flags (session_quality_flags table).
 * Supports both meeting_id (legacy) and session_id (current) lookups.
 */
const { db } = require('../../database/db');
const { logger } = require('../../utils/logger');

class SessionQualityFlagsModel {
  // ── Legacy meeting_id API ──────────────────────────────────────────────────
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

  // ── Current session_id API ─────────────────────────────────────────────────
  static upsert(data) {
    return new Promise((resolve, reject) => {
      const sql = `INSERT INTO session_quality_flags 
        (session_id, flags, created_at, updated_at) 
        VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) 
        ON DUPLICATE KEY UPDATE 
        flags=VALUES(flags), 
        updated_at=CURRENT_TIMESTAMP`;
      
      const params = [
        data.session_id,
        JSON.stringify(data.flags || [])
      ];
      
      db.run(sql, params, function(err) {
        if (err) { 
          logger.error('[SessionQualityFlagsModel] upsert error', err); 
          return reject(err); 
        }
        resolve({ id: this.lastID, changes: this.changes });
      });
    });
  }

  static findBySessionId(sessionId) {
    return new Promise((resolve, reject) => {
      const sql = `SELECT * FROM session_quality_flags WHERE session_id = ? LIMIT 1`;
      
      db.get(sql, [sessionId], (err, row) => {
        if (err) { 
          logger.error('[SessionQualityFlagsModel] findBySessionId error', err); 
          return reject(err); 
        }
        if (row) {
          try {
            row.flags = typeof row.flags === 'string' 
              ? JSON.parse(row.flags) : row.flags;
          } catch (e) {
            logger.warn('[SessionQualityFlagsModel] JSON parse warning', e);
          }
        }
        resolve(row || null);
      });
    });
  }

  static deleteBySession(sessionId) {
    return new Promise((resolve, reject) => {
      const sql = `DELETE FROM session_quality_flags WHERE session_id = ?`;
      
      db.run(sql, [sessionId], function(err) {
        if (err) { 
          logger.error('[SessionQualityFlagsModel] deleteBySession error', err); 
          return reject(err); 
        }
        resolve({ changes: this.changes });
      });
    });
  }
}

module.exports = SessionQualityFlagsModel;
