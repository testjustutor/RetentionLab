/**
 * models/insights/RisksModel.js
 * Data access for insights/risks dashboard.
 * All SQL lives here; controllers only call these methods.
 */
const { db } = require('../../database/db');
const { logger } = require('../../utils/logger');

class RisksModel {
  /**
   * Get risks from session quality flags.
   * @param {object} user - { role_name, company_id }
   * @param {object} filters - { from_date, to_date, instructor_id }
   * @returns {Promise<Array>}
   */
  static getQualityFlagRisks(user, filters = {}) {
    return new Promise((resolve, reject) => {
      const { from_date, to_date, instructor_id } = filters;
      let sql = `
        SELECT
          sqf.id,
          sqf.session_id,
          sqf.flags,
          sqf.created_at,
          sqf.updated_at,
          m.title as meeting_title,
          m.scheduled_start_time as meeting_date,
          CONCAT(u.first_name, ' ', u.last_name) as instructor_name,
          u.id as instructor_id
        FROM session_quality_flags sqf
        JOIN meeting_sessions ms ON ms.id = sqf.session_id
        JOIN meetings m ON m.id = ms.meeting_id
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

      sql += ' ORDER BY sqf.created_at DESC LIMIT 100';

      db.all(sql, params, (err, rows) => {
        if (err) {
          logger.error('Model(RisksModel): Error fetching quality flag risks:', err);
          return reject(err);
        }
        resolve(rows || []);
      });
    });
  }

  /**
   * Get risks from low session quality scores.
   * @param {object} user - { role_name, company_id }
   * @param {object} filters - { from_date, to_date, instructor_id }
   * @returns {Promise<Array>}
   */
  static getQualityScoreRisks(user, filters = {}) {
    return new Promise((resolve, reject) => {
      const { from_date, to_date, instructor_id } = filters;
      let sql = `
        SELECT
          sqr.meeting_id,
          sqr.percentage_score,
          sqr.confidence_level,
          sqr.confidence_reason,
          sqr.executive_summary,
          m.title as meeting_title,
          m.scheduled_start_time as meeting_date,
          CONCAT(u.first_name, ' ', u.last_name) as instructor_name,
          u.id as instructor_id
        FROM session_quality_reports sqr
        JOIN meetings m ON m.id = sqr.meeting_id
        JOIN users u ON LOWER(u.email) = LOWER(m.calendar_account)
        WHERE 1=1
          AND sqr.percentage_score < 60
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

      sql += ' ORDER BY sqr.percentage_score ASC LIMIT 50';

      db.all(sql, params, (err, rows) => {
        if (err) {
          logger.error('Model(RisksModel): Error fetching quality score risks:', err);
          return reject(err);
        }
        resolve(rows || []);
      });
    });
  }
}

module.exports = RisksModel;
