/**
 * root/models/SessionFinalEvaluationModel.js
 */
const { db } = require('../database/db');
const { logger } = require('../utils/logger');

class SessionFinalEvaluationModel {
  static upsert(evalData) {
    return new Promise((resolve, reject) => {
      const sql = `INSERT INTO session_final_evaluation (meeting_id, overall_session_rating, teacher_performance, student_engagement, learning_impact, parent_communication_readiness, recommended_action, aq_team_summary, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON DUPLICATE KEY UPDATE overall_session_rating=VALUES(overall_session_rating), teacher_performance=VALUES(teacher_performance), student_engagement=VALUES(student_engagement), learning_impact=VALUES(learning_impact), parent_communication_readiness=VALUES(parent_communication_readiness), recommended_action=VALUES(recommended_action), aq_team_summary=VALUES(aq_team_summary), updated_at=CURRENT_TIMESTAMP`;
      const params = [evalData.meeting_id, evalData.overall_session_rating || null, evalData.teacher_performance || null, evalData.student_engagement || null, evalData.learning_impact || null, evalData.parent_communication_readiness || null, evalData.recommended_action || null, evalData.aq_team_summary || null];
      db.run(sql, params, function(err) {
        if (err) { logger.error('[SessionFinalEvaluationModel] upsert error', err); return reject(err); }
        resolve({ id: this.lastID, changes: this.changes });
      });
    });
  }

  static getByMeeting(meetingId) {
    return new Promise((resolve, reject) => db.get('SELECT * FROM session_final_evaluation WHERE meeting_id = ? LIMIT 1', [meetingId], (err, row) => err ? reject(err) : resolve(row || null)));
  }
}

module.exports = SessionFinalEvaluationModel;
