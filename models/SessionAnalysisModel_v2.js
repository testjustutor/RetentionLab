/**
 * root/models/SessionAnalysisModel_v2.js
 *
 * Single-row-per-session analysis block (session_analysis table).
 * Mirrors the pattern of RubricEvaluationModel but for the aggregated analysis section.
 */
const { db } = require('../database/db');
const { logger } = require('../utils/logger');

class SessionAnalysisModel_v2 {
  /**
   * Upsert — insert or update since there is one row per session_id
   */
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
          logger.error('[SessionAnalysisModel_v2] upsert error', err); 
          return reject(err); 
        }
        resolve({ id: this.lastID, changes: this.changes });
      });
    });
  }

  /**
   * Find by session_id — returns null if no row exists
   */
  static findBySessionId(sessionId) {
    return new Promise((resolve, reject) => {
      const sql = `SELECT * FROM session_analysis WHERE session_id = ? LIMIT 1`;
      
      db.get(sql, [sessionId], (err, row) => {
        if (err) { 
          logger.error('[SessionAnalysisModel_v2] findBySessionId error', err); 
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
            logger.warn('[SessionAnalysisModel_v2] JSON parse warning', e);
          }
        }
        resolve(row || null);
      });
    });
  }

  /**
   * Delete by session_id
   */
  static deleteBySession(sessionId) {
    return new Promise((resolve, reject) => {
      const sql = `DELETE FROM session_analysis WHERE session_id = ?`;
      
      db.run(sql, [sessionId], function(err) {
        if (err) { 
          logger.error('[SessionAnalysisModel_v2] deleteBySession error', err); 
          return reject(err); 
        }
        resolve({ changes: this.changes });
      });
    });
  }
}

module.exports = SessionAnalysisModel_v2;