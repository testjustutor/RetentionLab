/**
 * root/models/SessionFinalEvaluationModel.js
 */
const { db } = require('../database/db');
const { logger } = require('../utils/logger');

class SessionFinalEvaluationModel {
  static upsert(evalData) {
    return new Promise((resolve, reject) => {
      const sql = `INSERT INTO session_final_evaluation (meeting_id, overall_session_rating, teacher_performance, student_engagement, learning_impact, parent_communication_readiness, recommended_action, aq_team_summary, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT(meeting_id) DO UPDATE SET overall_session_rating=excluded.overall_session_rating, teacher_performance=excluded.teacher_performance, student_engagement=excluded.student_engagement, learning_impact=excluded.learning_impact, parent_communication_readiness=excluded.parent_communication_readiness, recommended_action=excluded.recommended_action, aq_team_summary=excluded.aq_team_summary, updated_at=CURRENT_TIMESTAMP`;
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
