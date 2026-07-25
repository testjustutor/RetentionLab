/**
 * root/models/SessionNextPlanModel_v2.js
 *
 * Single-row-per-session next plan (session_next_plan table).
 */
const { db } = require('../../database/db');
const { logger } = require('../../utils/logger');

class SessionNextPlanModel_v2 {
  static upsert(data) {
    return new Promise((resolve, reject) => {
      const sql = `INSERT INTO session_next_plan 
        (session_id, segments, priority_focus, gaps_to_address, created_at, updated_at) 
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) 
        ON DUPLICATE KEY UPDATE 
        segments=VALUES(segments), 
        priority_focus=VALUES(priority_focus), 
        gaps_to_address=VALUES(gaps_to_address), 
        updated_at=CURRENT_TIMESTAMP`;
      
      const params = [
        data.session_id,
        JSON.stringify(data.segments || []),
        JSON.stringify(data.priority_focus || []),
        JSON.stringify(data.gaps_to_address || [])
      ];
      
      db.run(sql, params, function(err) {
        if (err) { 
          logger.error('[SessionNextPlanModel_v2] upsert error', err); 
          return reject(err); 
        }
        resolve({ id: this.lastID, changes: this.changes });
      });
    });
  }

  static findBySessionId(sessionId) {
    return new Promise((resolve, reject) => {
      const sql = `SELECT * FROM session_next_plan WHERE session_id = ? LIMIT 1`;
      
      db.get(sql, [sessionId], (err, row) => {
        if (err) { 
          logger.error('[SessionNextPlanModel_v2] findBySessionId error', err); 
          return reject(err); 
        }
        if (row) {
          try {
            row.segments = typeof row.segments === 'string' 
              ? JSON.parse(row.segments) : row.segments;
            row.priority_focus = typeof row.priority_focus === 'string' 
              ? JSON.parse(row.priority_focus) : row.priority_focus;
            row.gaps_to_address = typeof row.gaps_to_address === 'string' 
              ? JSON.parse(row.gaps_to_address) : row.gaps_to_address;
          } catch (e) {
            logger.warn('[SessionNextPlanModel_v2] JSON parse warning', e);
          }
        }
        resolve(row || null);
      });
    });
  }

  static deleteBySession(sessionId) {
    return new Promise((resolve, reject) => {
      const sql = `DELETE FROM session_next_plan WHERE session_id = ?`;
      
      db.run(sql, [sessionId], function(err) {
        if (err) { 
          logger.error('[SessionNextPlanModel_v2] deleteBySession error', err); 
          return reject(err); 
        }
        resolve({ changes: this.changes });
      });
    });
  }
}

module.exports = SessionNextPlanModel_v2;