/**
 * models/insights/ActionsModel.js
 * Data access for insights/actions dashboard.
 * All SQL lives here; controllers only call these methods.
 */
const { db } = require('../../database/db');
const { logger } = require('../../utils/logger');

class ActionsModel {
  /**
   * Get action items from teacher coaching feedback.
   * @param {object} user - { role_name, company_id }
   * @param {object} filters - { from_date, to_date, instructor_id, status }
   * @returns {Promise<Array>}
   */
  static getCoachingActionItems(user, filters = {}) {
    return new Promise((resolve, reject) => {
      const { from_date, to_date, instructor_id, status } = filters;
      let sql = `
        SELECT
          tcf.id,
          tcf.meeting_id,
          tcf.recommended_action as action_text,
          'medium' as priority,
          'pending' as status,
          tcf.created_at,
          m.title as meeting_title,
          m.scheduled_start_time as meeting_date,
          CONCAT(u.first_name, ' ', u.last_name) as instructor_name,
          u.id as instructor_id
        FROM teacher_coaching_feedback tcf
        JOIN meetings m ON m.id = tcf.meeting_id
        JOIN users u ON LOWER(u.email) = LOWER(m.calendar_account)
        WHERE 1=1
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

      if (status && status !== 'pending') {
        sql += ' AND 1=0';
      }

      sql += ' ORDER BY tcf.created_at DESC LIMIT 100';

      db.all(sql, params, (err, rows) => {
        if (err) {
          logger.error('Model(ActionsModel): Error fetching coaching action items:', err);
          return reject(err);
        }
        resolve(rows || []);
      });
    });
  }

  /**
   * Get action items from teacher better alternatives.
   * @param {object} user - { role_name, company_id }
   * @param {object} filters - { from_date, to_date, instructor_id, status }
   * @returns {Promise<Array>}
   */
  static getBetterAlternatives(user, filters = {}) {
    return new Promise((resolve, reject) => {
      const { from_date, to_date, instructor_id, status } = filters;
      let sql = `
        SELECT
          tba.id,
          tba.meeting_id,
          tba.better_alternative as action_text,
          'medium' as priority,
          'pending' as status,
          tba.created_at,
          m.title as meeting_title,
          m.scheduled_start_time as meeting_date,
          CONCAT(u.first_name, ' ', u.last_name) as instructor_name,
          u.id as instructor_id
        FROM teacher_better_alternatives tba
        JOIN meetings m ON m.id = tba.meeting_id
        JOIN users u ON LOWER(u.email) = LOWER(m.calendar_account)
        WHERE 1=1
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

      if (status && status !== 'pending') {
        sql += ' AND 1=0';
      }

      sql += ' ORDER BY tba.created_at DESC LIMIT 100';

      db.all(sql, params, (err, rows) => {
        if (err) {
          logger.error('Model(ActionsModel): Error fetching better alternatives:', err);
          return reject(err);
        }
        resolve(rows || []);
      });
    });
  }
}

module.exports = ActionsModel;
