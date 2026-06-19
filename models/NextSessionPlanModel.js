/**
 * root/models/NextSessionPlanModel.js
 */
const { db } = require('../database/db');
const { logger } = require('../utils/logger');

class NextSessionPlanModel {
  static upsert(plan) {
    return new Promise((resolve, reject) => {
      const sql = `INSERT INTO next_session_plan (meeting_id, recap_warmup, concept_reinforcement, guided_practice, independent_practice, review_homework, priority_focus, concepts_to_revise, suggested_practice_questions, suggested_homework, misconception_to_address, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT(meeting_id) DO UPDATE SET recap_warmup=excluded.recap_warmup, concept_reinforcement=excluded.concept_reinforcement, guided_practice=excluded.guided_practice, independent_practice=excluded.independent_practice, review_homework=excluded.review_homework, priority_focus=excluded.priority_focus, concepts_to_revise=excluded.concepts_to_revise, suggested_practice_questions=excluded.suggested_practice_questions, suggested_homework=excluded.suggested_homework, misconception_to_address=excluded.misconception_to_address, updated_at=CURRENT_TIMESTAMP`;
      const params = [plan.meeting_id, plan.recap_warmup || null, plan.concept_reinforcement || null, plan.guided_practice || null, plan.independent_practice || null, plan.review_homework || null, plan.priority_focus || null, plan.concepts_to_revise || null, plan.suggested_practice_questions || null, plan.suggested_homework || null, plan.misconception_to_address || null];
      db.run(sql, params, function(err) {
        if (err) { logger.error('[NextSessionPlanModel] upsert error', err); return reject(err); }
        resolve({ id: this.lastID, changes: this.changes });
      });
    });
  }

  static getByMeeting(meetingId) {
    return new Promise((resolve, reject) => db.get('SELECT * FROM next_session_plan WHERE meeting_id = ? LIMIT 1', [meetingId], (err, row) => err ? reject(err) : resolve(row || null)));
  }
}

module.exports = NextSessionPlanModel;
