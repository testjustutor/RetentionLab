/**
 * root/models/SessionFinalEvaluationModel.js
 *
 * Session final evaluation (session_final_evaluation table).
 * Supports both meeting_id (legacy) and session_id (current) lookups.
 */
const { db } = require('../../database/db');
const { logger } = require('../../utils/logger');

class SessionFinalEvaluationModel {
  // ── Legacy meeting_id API ──────────────────────────────────────────────────
  static upsertByMeeting(evalData) {
    return new Promise((resolve, reject) => {
      const sql = `INSERT INTO session_final_evaluation (meeting_id, overall_session_rating, teacher_performance, student_engagement, learning_impact, parent_communication_readiness, recommended_action, aq_team_summary, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON DUPLICATE KEY UPDATE overall_session_rating=VALUES(overall_session_rating), teacher_performance=VALUES(teacher_performance), student_engagement=VALUES(student_engagement), learning_impact=VALUES(learning_impact), parent_communication_readiness=VALUES(parent_communication_readiness), recommended_action=VALUES(recommended_action), aq_team_summary=VALUES(aq_team_summary), updated_at=CURRENT_TIMESTAMP`;
      const params = [evalData.meeting_id, evalData.overall_session_rating || null, evalData.teacher_performance || null, evalData.student_engagement || null, evalData.learning_impact || null, evalData.parent_communication_readiness || null, evalData.recommended_action || null, evalData.aq_team_summary || null];
      db.run(sql, params, function(err) {
        if (err) { logger.error('[SessionFinalEvaluationModel] upsertByMeeting error', err); return reject(err); }
        resolve({ id: this.lastID, changes: this.changes });
      });
    });
  }

  static getByMeeting(meetingId) {
    return new Promise((resolve, reject) => db.get('SELECT * FROM session_final_evaluation WHERE meeting_id = ? LIMIT 1', [meetingId], (err, row) => err ? reject(err) : resolve(row || null)));
  }

  // ── Current session_id API ─────────────────────────────────────────────────
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
          logger.error('[SessionFinalEvaluationModel] upsert error', err); 
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
          logger.error('[SessionFinalEvaluationModel] findBySessionId error', err); 
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
          logger.error('[SessionFinalEvaluationModel] deleteBySession error', err); 
          return reject(err); 
        }
        resolve({ changes: this.changes });
      });
    });
  }
}

module.exports = SessionFinalEvaluationModel;
