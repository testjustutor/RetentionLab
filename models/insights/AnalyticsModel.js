/**
 * models/insights/AnalyticsModel.js
 * Data access for insights/analytics dashboard.
 * All SQL lives here; controllers only call these methods.
 */
const { db } = require('../../database/db');
const { logger } = require('../../utils/logger');

class AnalyticsModel {
  /**
   * Meeting trends: meeting count per month (last 6 months).
   * @param {object} user - { role_name, company_id }
   * @param {object} filters - { from_date, to_date }
   * @returns {Promise<Array>} [{ month, meeting_count }]
   */
  static getMeetingTrends(user, filters = {}) {
    return new Promise((resolve, reject) => {
      const { from_date, to_date } = filters;
      let sql = `
        SELECT
          DATE_FORMAT(m.scheduled_start_time, '%Y-%m') as month,
          COUNT(*) as meeting_count
        FROM meetings m
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

      sql += " GROUP BY DATE_FORMAT(m.scheduled_start_time, '%Y-%m')";
      sql += " ORDER BY month ASC LIMIT 12";

      db.all(sql, params, (err, rows) => {
        if (err) {
          logger.error('Model(AnalyticsModel): Error fetching meeting trends:', err);
          return reject(err);
        }
        resolve(rows || []);
      });
    });
  }

  /**
   * Score distribution: percentage_score bands from session quality reports.
   * @param {object} user - { role_name, company_id }
   * @param {object} filters - { from_date, to_date }
   * @returns {Promise<Array>} [{ score_band, band_count }]
   */
  static getScoreDistribution(user, filters = {}) {
    return new Promise((resolve, reject) => {
      const { from_date, to_date } = filters;
      let sql = `
        SELECT
          CASE
            WHEN sqr.percentage_score >= 90 THEN '9-10'
            WHEN sqr.percentage_score >= 70 THEN '7-8'
            WHEN sqr.percentage_score >= 50 THEN '5-6'
            ELSE '<5'
          END as score_band,
          COUNT(*) as band_count
        FROM session_quality_reports sqr
        JOIN meetings m ON m.id = sqr.meeting_id
        JOIN users u ON LOWER(u.email) = LOWER(m.calendar_account)
        WHERE sqr.percentage_score IS NOT NULL
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

      sql += ' GROUP BY score_band';
      sql += ' ORDER BY score_band';

      db.all(sql, params, (err, rows) => {
        if (err) {
          logger.error('Model(AnalyticsModel): Error fetching score distribution:', err);
          return reject(err);
        }
        resolve(rows || []);
      });
    });
  }

  /**
   * Overall metrics: total sessions, avg score, avg engagement, avg learning impact.
   * @param {object} user - { role_name, company_id }
   * @param {object} filters - { from_date, to_date }
   * @returns {Promise<object|null>} Single aggregated row or null
   */
  static getOverallMetrics(user, filters = {}) {
    return new Promise((resolve, reject) => {
      const { from_date, to_date } = filters;
      let sql = `
        SELECT
          COUNT(DISTINCT m.id) as total_sessions,
          ROUND(AVG(sqr.percentage_score), 1) as avg_score,
          ROUND(AVG(sqr.student_engagement), 1) as avg_engagement,
          ROUND(AVG(sqr.learning_impact), 1) as avg_learning_impact
        FROM session_quality_reports sqr
        JOIN meetings m ON m.id = sqr.meeting_id
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

      db.get(sql, params, (err, row) => {
        if (err) {
          logger.error('Model(AnalyticsModel): Error fetching overall metrics:', err);
          return reject(err);
        }
        resolve(row || null);
      });
    });
  }
}

module.exports = AnalyticsModel;
