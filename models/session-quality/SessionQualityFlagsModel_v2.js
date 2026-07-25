/**
 * root/models/SessionQualityFlagsModel_v2.js
 *
 * Single-row-per-session quality flags (session_quality_flags table).
 */
const { db } = require('../../database/db');
const { logger } = require('../../utils/logger');

class SessionQualityFlagsModel_v2 {
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
          logger.error('[SessionQualityFlagsModel_v2] upsert error', err); 
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
          logger.error('[SessionQualityFlagsModel_v2] findBySessionId error', err); 
          return reject(err); 
        }
        if (row) {
          try {
            row.flags = typeof row.flags === 'string' 
              ? JSON.parse(row.flags) : row.flags;
          } catch (e) {
            logger.warn('[SessionQualityFlagsModel_v2] JSON parse warning', e);
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
          logger.error('[SessionQualityFlagsModel_v2] deleteBySession error', err); 
          return reject(err); 
        }
        resolve({ changes: this.changes });
      });
    });
  }
}

module.exports = SessionQualityFlagsModel_v2;