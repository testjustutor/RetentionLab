/**
 * root/models/SessionBetterAlternativesModel_v2.js
 *
 * Single-row-per-session better alternatives (session_better_alternatives table).
 */
const { db } = require('../database/db');
const { logger } = require('../utils/logger');

class SessionBetterAlternativesModel_v2 {
  static upsert(data) {
    return new Promise((resolve, reject) => {
      const sql = `INSERT INTO session_better_alternatives 
        (session_id, items, created_at, updated_at) 
        VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) 
        ON DUPLICATE KEY UPDATE 
        items=VALUES(items), 
        updated_at=CURRENT_TIMESTAMP`;
      
      const params = [
        data.session_id,
        JSON.stringify(data.items || [])
      ];
      
      db.run(sql, params, function(err) {
        if (err) { 
          logger.error('[SessionBetterAlternativesModel_v2] upsert error', err); 
          return reject(err); 
        }
        resolve({ id: this.lastID, changes: this.changes });
      });
    });
  }

  static findBySessionId(sessionId) {
    return new Promise((resolve, reject) => {
      const sql = `SELECT * FROM session_better_alternatives WHERE session_id = ? LIMIT 1`;
      
      db.get(sql, [sessionId], (err, row) => {
        if (err) { 
          logger.error('[SessionBetterAlternativesModel_v2] findBySessionId error', err); 
          return reject(err); 
        }
        if (row) {
          try {
            row.items = typeof row.items === 'string' 
              ? JSON.parse(row.items) : row.items;
          } catch (e) {
            logger.warn('[SessionBetterAlternativesModel_v2] JSON parse warning', e);
          }
        }
        resolve(row || null);
      });
    });
  }

  static deleteBySession(sessionId) {
    return new Promise((resolve, reject) => {
      const sql = `DELETE FROM session_better_alternatives WHERE session_id = ?`;
      
      db.run(sql, [sessionId], function(err) {
        if (err) { 
          logger.error('[SessionBetterAlternativesModel_v2] deleteBySession error', err); 
          return reject(err); 
        }
        resolve({ changes: this.changes });
      });
    });
  }
}

module.exports = SessionBetterAlternativesModel_v2;