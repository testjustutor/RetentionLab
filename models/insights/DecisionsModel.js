/**
 * models/insights/DecisionsModel.js
 * Data access for insights/decisions dashboard.
 * All SQL lives here; controllers only call these methods.
 */
const { db } = require('../../database/db');
const { logger } = require('../../utils/logger');

class DecisionsModel {
  /**
   * Get decisions from session final evaluations.
   * @param {object} user - { role_name, company_id }
   * @param {object} filters - { from_date, to_date, instructor_id, decision_type }
   * @returns {Promise<Array>}
   */
  static getEvaluationDecisions(user, filters = {}) {
    return new Promise((resolve, reject) => {
      const { from_date, to_date, instructor_id, decision_type } = filters;
      let sql = `
        SELECT
          sfe.id,
          sfe.session_id,
          sfe.recommended_action as decision_text,
          sfe.summary_narrative as context,
          sfe.overall_session_rating,
          sfe.teacher_performance,
          sfe.student_engagement,
          sfe.learning_impact,
          sfe.parent_communication_readiness,
          m.title as meeting_title,
          m.scheduled_start_time as meeting_date,
          CONCAT(u.first_name, ' ', u.last_name) as instructor_name,
          u.id as instructor_id
        FROM session_final_evaluation sfe
        JOIN meeting_sessions ms ON ms.id = sfe.session_id
        JOIN meetings m ON m.id = ms.meeting_id
        JOIN users u ON LOWER(u.email) = LOWER(m.calendar_account)
        WHERE 1=1
          AND sfe.recommended_action IS NOT NULL
          AND sfe.recommended_action != ''
      `;
      const params = [];

      if (user.role_name === 'admin') {
        sql += ' AND u.company_id = ?';
        params.push(user.company_id);
      }

      if (from_date) {
        sql += ' AND m.scheduled_start_time >= ?';
        params.push(from_date + ' 00:00:00');
      }
      if (to_date) {
        sql += ' AND m.scheduled_start_time <= ?';
        params.push(to_date + ' 23:59:59');
      }
      if (instructor_id) {
        sql += ' AND u.id = ?';
        params.push(parseInt(instructor_id));
      }

      if (decision_type === 'positive') {
        sql += " AND sfe.overall_session_rating IN ('Excellent', 'Good')";
      } else if (decision_type === 'improvement') {
        sql += " AND sfe.overall_session_rating IN ('Average', 'Needs Improvement')";
      }

      sql += ' ORDER BY m.scheduled_start_time DESC LIMIT 100';

      db.all(sql, params, (err, rows) => {
        if (err) {
          logger.error('Model(DecisionsModel): Error fetching evaluation decisions:', err);
          return reject(err);
        }
        resolve(rows || []);
      });
    });
  }

  /**
   * Get decisions from teacher coaching feedback.
   * @param {object} user - { role_name, company_id }
   * @param {object} filters - { from_date, to_date, instructor_id }
   * @returns {Promise<Array>}
   */
  static getCoachingDecisions(user, filters = {}) {
    return new Promise((resolve, reject) => {
      const { from_date, to_date, instructor_id } = filters;
      let sql = `
        SELECT
          tcf.id,
          tcf.meeting_id,
          tcf.recommended_action as decision_text,
          'coaching' as decision_source,
          'medium' as priority,
          'pending' as status,
          m.title as meeting_title,
          m.scheduled_start_time as meeting_date,
          CONCAT(u.first_name, ' ', u.last_name) as instructor_name,
          u.id as instructor_id
        FROM teacher_coaching_feedback tcf
        JOIN meetings m ON m.id = tcf.meeting_id
        JOIN users u ON LOWER(u.email) = LOWER(m.calendar_account)
        WHERE 1=1
          AND tcf.recommended_action IS NOT NULL
          AND tcf.recommended_action != ''
      `;
      const params = [];

      if (user.role_name === 'admin') {
        sql += ' AND u.company_id = ?';
        params.push(user.company_id);
      }
      if (from_date) {
        sql += ' AND m.scheduled_start_time >= ?';
        params.push(from_date + ' 00:00:00');
      }
      if (to_date) {
        sql += ' AND m.scheduled_start_time <= ?';
        params.push(to_date + ' 23:59:59');
      }
      if (instructor_id) {
        sql += ' AND u.id = ?';
        params.push(parseInt(instructor_id));
      }

      sql += ' ORDER BY m.scheduled_start_time DESC LIMIT 100';

      db.all(sql, params, (err, rows) => {
        if (err) {
          logger.error('Model(DecisionsModel): Error fetching coaching decisions:', err);
          return reject(err);
        }
        resolve(rows || []);
      });
    });
  }
}

module.exports = DecisionsModel;
