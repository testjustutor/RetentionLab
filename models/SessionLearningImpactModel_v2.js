/**
 * root/models/SessionLearningImpactModel_v2.js
 *
 * Single-row-per-session learning impact (session_learning_impact table).
 */
const { db } = require('../database/db');
const { logger } = require('../utils/logger');

class SessionLearningImpactModel_v2 {
  static upsert(data) {
    return new Promise((resolve, reject) => {
      const sql = `INSERT INTO session_learning_impact 
        (session_id, impact_areas, created_at, updated_at) 
        VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) 
        ON DUPLICATE KEY UPDATE 
        impact_areas=VALUES(impact_areas), 
        updated_at=CURRENT_TIMESTAMP`;
      
      const params = [
        data.session_id,
        JSON.stringify(data.impact_areas || [])
      ];
      
      db.run(sql, params, function(err) {
        if (err) { 
          logger.error('[SessionLearningImpactModel_v2] upsert error', err); 
          return reject(err); 
        }
        resolve({ id: this.lastID, changes: this.changes });
      });
    });
  }

  static findBySessionId(sessionId) {
    return new Promise((resolve, reject) => {
      const sql = `SELECT * FROM session_learning_impact WHERE session_id = ? LIMIT 1`;
      
      db.get(sql, [sessionId], (err, row) => {
        if (err) { 
          logger.error('[SessionLearningImpactModel_v2] findBySessionId error', err); 
          return reject(err); 
        }
        if (row) {
          try {
            row.impact_areas = typeof row.impact_areas === 'string' 
              ? JSON.parse(row.impact_areas) : row.impact_areas;
          } catch (e) {
            logger.warn('[SessionLearningImpactModel_v2] JSON parse warning', e);
          }
        }
        resolve(row || null);
      });
    });
  }

  static deleteBySession(sessionId) {
    return new Promise((resolve, reject) => {
      const sql = `DELETE FROM session_learning_impact WHERE session_id = ?`;
      
      db.run(sql, [sessionId], function(err) {
        if (err) { 
          logger.error('[SessionLearningImpactModel_v2] deleteBySession error', err); 
          return reject(err); 
        }
        resolve({ changes: this.changes });
      });
    });
  }
}

module.exports = SessionLearningImpactModel_v2;