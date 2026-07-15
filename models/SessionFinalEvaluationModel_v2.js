/**
 * root/models/SessionFinalEvaluationModel_v2.js
 *
 * Single-row-per-session final evaluation (session_final_evaluation table).
 */
const { db } = require('../database/db');
const { logger } = require('../utils/logger');

class SessionFinalEvaluationModel_v2 {
  static upsert(data) {
    return new Promise((resolve, reject) => {
      const sql = `INSERT INTO session_final_evaluation 
        (session_id, overall_session_rating, teacher_performance, student_engagement, 
         learning_impact, parent_communication_readiness, recommended_action, summary_narrative, 
         created_at, updated_at) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) 
        ON DUPLICATE KEY UPDATE 
        overall_session_rating=VALUES(overall_session_rating), 
        teacher_performance=VALUES(teacher_performance), 
        student_engagement=VALUES(student_engagement), 
        learning_impact=VALUES(learning_impact), 
        parent_communication_readiness=VALUES(parent_communication_readiness), 
        recommended_action=VALUES(recommended_action), 
        summary_narrative=VALUES(summary_narrative), 
        updated_at=CURRENT_TIMESTAMP`;
      
      const params = [
        data.session_id,
        data.overall_session_rating || '',
        data.teacher_performance || '',
        data.student_engagement || '',
        data.learning_impact || '',
        data.parent_communication_readiness || '',
        data.recommended_action || '',
        data.summary_narrative || ''
      ];
      
      db.run(sql, params, function(err) {
        if (err) { 
          logger.error('[SessionFinalEvaluationModel_v2] upsert error', err); 
          return reject(err); 
        }
        resolve({ id: this.lastID, changes: this.changes });
      });
    });
  }

  static findBySessionId(sessionId) {
    return new Promise((resolve, reject) => {
      const sql = `SELECT * FROM session_final_evaluation WHERE session_id = ? LIMIT 1`;
      
      db.get(sql, [sessionId], (err, row) => {
        if (err) { 
          logger.error('[SessionFinalEvaluationModel_v2] findBySessionId error', err); 
          return reject(err); 
        }
        resolve(row || null);
      });
    });
  }

  static deleteBySession(sessionId) {
    return new Promise((resolve, reject) => {
      const sql = `DELETE FROM session_final_evaluation WHERE session_id = ?`;
      
      db.run(sql, [sessionId], function(err) {
        if (err) { 
          logger.error('[SessionFinalEvaluationModel_v2] deleteBySession error', err); 
          return reject(err); 
        }
        resolve({ changes: this.changes });
      });
    });
  }
}

module.exports = SessionFinalEvaluationModel_v2;