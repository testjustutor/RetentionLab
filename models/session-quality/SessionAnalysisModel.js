/**
 * root/models/SessionAnalysisModel.js
 *
 * Session analysis block (session_analysis table).
 * Supports both meeting_id (legacy) and session_id (current) lookups.
 */
const { db } = require('../../database/db');
const { logger } = require('../../utils/logger');

class SessionAnalysisModel {
  // ── Legacy meeting_id API ──────────────────────────────────────────────────
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

  // ── Current session_id API ─────────────────────────────────────────────────
  static upsert(data) {
    return new Promise((resolve, reject) => {
      const sql = `INSERT INTO session_analysis 
        (session_id, what_worked_well, what_needs_improvement, missed_opportunities, created_at, updated_at) 
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) 
        ON DUPLICATE KEY UPDATE 
        what_worked_well=VALUES(what_worked_well), 
        what_needs_improvement=VALUES(what_needs_improvement), 
        missed_opportunities=VALUES(missed_opportunities), 
        updated_at=CURRENT_TIMESTAMP`;
      
      const params = [
        data.session_id,
        JSON.stringify(data.what_worked_well || []),
        JSON.stringify(data.what_needs_improvement || []),
        JSON.stringify(data.missed_opportunities || [])
      ];
      
      db.run(sql, params, function(err) {
        if (err) { 
          logger.error('[SessionAnalysisModel] upsert error', err); 
          return reject(err); 
        }
        resolve({ id: this.lastID, changes: this.changes });
      });
    });
  }

  static findBySessionId(sessionId) {
    return new Promise((resolve, reject) => {
      const sql = `SELECT * FROM session_analysis WHERE session_id = ? LIMIT 1`;
      
      db.get(sql, [sessionId], (err, row) => {
        if (err) { 
          logger.error('[SessionAnalysisModel] findBySessionId error', err); 
          return reject(err); 
        }
        if (row) {
          try {
            row.what_worked_well = typeof row.what_worked_well === 'string' 
              ? JSON.parse(row.what_worked_well) : row.what_worked_well;
            row.what_needs_improvement = typeof row.what_needs_improvement === 'string' 
              ? JSON.parse(row.what_needs_improvement) : row.what_needs_improvement;
            row.missed_opportunities = typeof row.missed_opportunities === 'string' 
              ? JSON.parse(row.missed_opportunities) : row.missed_opportunities;
          } catch (e) {
            logger.warn('[SessionAnalysisModel] JSON parse warning', e);
          }
        }
        resolve(row || null);
      });
    });
  }

  static deleteBySession(sessionId) {
    return new Promise((resolve, reject) => {
      const sql = `DELETE FROM session_analysis WHERE session_id = ?`;
      
      db.run(sql, [sessionId], function(err) {
        if (err) { 
          logger.error('[SessionAnalysisModel] deleteBySession error', err); 
          return reject(err); 
        }
        resolve({ changes: this.changes });
      });
    });
  }
}

module.exports = SessionAnalysisModel;
