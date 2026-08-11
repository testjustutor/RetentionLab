/**
 * root/models/SessionCoachingFeedbackModel_v2.js
 *
 * Single-row-per-session coaching feedback (session_coaching_feedback table).
 */
const { db } = require('../../database/db');
const { logger } = require('../../utils/logger');

class SessionCoachingFeedbackModel {
  static upsert(data) {
    return new Promise((resolve, reject) => {
      const sql = `INSERT INTO session_coaching_feedback 
        (session_id, strengths, areas_to_improve, created_at, updated_at) 
        VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) 
        ON DUPLICATE KEY UPDATE 
        strengths=VALUES(strengths), 
        areas_to_improve=VALUES(areas_to_improve), 
        updated_at=CURRENT_TIMESTAMP`;
      
      const params = [
        data.session_id,
        JSON.stringify(data.strengths || []),
        JSON.stringify(data.areas_to_improve || [])
      ];
      
      db.run(sql, params, function(err) {
        if (err) { 
          logger.error('[SessionCoachingFeedbackModel] upsert error', err); 
          return reject(err); 
        }
        resolve({ id: this.lastID, changes: this.changes });
      });
    });
  }

  static findBySessionId(sessionId) {
    return new Promise((resolve, reject) => {
      const sql = `SELECT * FROM session_coaching_feedback WHERE session_id = ? LIMIT 1`;
      
      db.get(sql, [sessionId], (err, row) => {
        if (err) { 
          logger.error('[SessionCoachingFeedbackModel] findBySessionId error', err); 
          return reject(err); 
        }
        if (row) {
          try {
            row.strengths = typeof row.strengths === 'string' 
              ? JSON.parse(row.strengths) : row.strengths;
            row.areas_to_improve = typeof row.areas_to_improve === 'string' 
              ? JSON.parse(row.areas_to_improve) : row.areas_to_improve;
          } catch (e) {
            logger.warn('[SessionCoachingFeedbackModel] JSON parse warning', e);
          }
        }
        resolve(row || null);
      });
    });
  }

  static deleteBySession(sessionId) {
    return new Promise((resolve, reject) => {
      const sql = `DELETE FROM session_coaching_feedback WHERE session_id = ?`;
      
      db.run(sql, [sessionId], function(err) {
        if (err) { 
          logger.error('[SessionCoachingFeedbackModel] deleteBySession error', err); 
          return reject(err); 
        }
        resolve({ changes: this.changes });
      });
    });
  }
}

module.exports = SessionCoachingFeedbackModel;
