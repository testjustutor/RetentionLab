/**
 * root/models/NextSessionPlanModel.js
 */
const { db } = require('../../database/db');
const { logger } = require('../../utils/logger');

class NextSessionPlanModel {
  static upsert(plan) {
    return new Promise((resolve, reject) => {
      const sql = `INSERT INTO next_session_plan (meeting_id, recap_warmup, concept_reinforcement, guided_practice, independent_practice, review_homework, priority_focus, concepts_to_revise, suggested_practice_questions, suggested_homework, misconception_to_address, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON DUPLICATE KEY UPDATE recap_warmup=VALUES(recap_warmup), concept_reinforcement=VALUES(concept_reinforcement), guided_practice=VALUES(guided_practice), independent_practice=VALUES(independent_practice), review_homework=VALUES(review_homework), priority_focus=VALUES(priority_focus), concepts_to_revise=VALUES(concepts_to_revise), suggested_practice_questions=VALUES(suggested_practice_questions), suggested_homework=VALUES(suggested_homework), misconception_to_address=VALUES(misconception_to_address), updated_at=CURRENT_TIMESTAMP`;
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
