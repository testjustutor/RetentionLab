/**
 * models/super_admin/reports/MeetingAiEvaluationReportModel.js
 * Data access for the Super Admin Meeting AI Evaluation report.
 * All SQL lives here; controllers only call these methods.
 */
const { db } = require('../../../database/db');
const { logger } = require('../../../utils/logger');

class MeetingAiEvaluationReportModel {
  /**
   * Get active instructor users for the filter dropdown (across all companies for super admin).
   * @param {object} user - { role_name, company_id }
   * @returns {Promise<Array>} [{ id, name, email }]
   */
  static getInstructors(user = {}) {
    return new Promise((resolve, reject) => {
      let sql = `
        SELECT DISTINCT
          u.id,
          CONCAT(u.first_name, ' ', u.last_name) AS name,
          u.email
        FROM users u
        JOIN roles r ON r.id = u.role_id
        WHERE r.role_name IN ('instructor', 'solo_instructor')
          AND u.status = 'active'
          AND u.is_deleted = 0
      `;
      const params = [];

      if (user.role_name === 'admin') {
        sql += ' AND u.company_id = ?';
        params.push(user.company_id);
      }

      sql += ' ORDER BY u.first_name, u.last_name';

      db.all(sql, params, (err, rows) => {
        if (err) {
          logger.error('Model(MeetingAiEvaluationReportModel): Error fetching instructors:', err);
          return reject(err);
        }
        resolve(rows || []);
      });
    });
  }

  /**
   * Get meetings for a given instructor (or all) with their sessions and an audit summary.
   * Each row = one session under a meeting; ai_* cols summarize the session's AI audit existence.
   * @param {object} filters - { from_date, to_date, instructor_id }
   * @returns {Promise<Array>}
   */
  static getMeetingSessions(filters = {}) {
    return new Promise((resolve, reject) => {
      const { from_date, to_date, instructor_id } = filters;
      let sql = `
        SELECT
          m.id AS meeting_id,
          m.title AS meeting_title,
          m.platform,
          m.scheduled_start_time AS meeting_date,
          m.status AS meeting_status,
          CONCAT(ui.first_name, ' ', ui.last_name) AS instructor_name,
          ui.id AS instructor_id,
          ui.email AS instructor_email,
          ms.id AS session_id,
          ms.start_time AS session_start,
          ms.end_time AS session_end,
          ms.status AS session_status,
          ms.transcript_file_name,
          ms.audio_file_name
        FROM meetings m
        LEFT JOIN users ui ON ui.id = m.created_by
        JOIN meeting_sessions ms ON ms.meeting_id = m.id
        WHERE 1=1
      `;
      const params = [];

      if (from_date) {
        sql += ' AND m.scheduled_start_time >= ?';
        params.push(from_date + ' 00:00:00');
      }
      if (to_date) {
        sql += ' AND m.scheduled_start_time <= ?';
        params.push(to_date + ' 23:59:59');
      }
      if (instructor_id) {
        sql += ' AND ui.id = ?';
        params.push(parseInt(instructor_id, 10));
      }

      db.all(sql, params, (err, rows) => {
        if (err) {
          logger.error('Model(MeetingAiEvaluationReportModel): Error fetching meeting sessions:', err);
          return reject(err);
        }
        resolve(rows || []);
      });
    });
  }
/**
   * Aggregate AI audit stats per session (indicator count + average score pct + latest scored_at).
   * @returns {Promise<Array>} [{ session_id, ai_indicator_count, ai_avg_score_pct, ai_scored_at }]
   */
  static getSessionAuditSummary() {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT
          aar.session_id,
          COUNT(aar.id) AS ai_indicator_count,
          ROUND(COALESCE(AVG(aar.ai_score * 100.0 / NULLIF(aar.ai_max_score, 0)), 0), 1) AS ai_avg_score_pct,
          MAX(aar.scored_at) AS ai_scored_at
        FROM ai_audit_results aar
        WHERE aar.session_id IS NOT NULL
        GROUP BY aar.session_id
      `;
      db.all(sql, [], (err, rows) => {
        if (err) {
          logger.error('Model(MeetingAiEvaluationReportModel): Error fetching session audit summary:', err);
          return reject(err);
        }
        resolve(rows || []);
      });
    });
  }
/**
   * Get a single session's metadata (with meeting + instructor info).
   * @param {number} sessionId - meeting_sessions.id
   * @returns {Promise<object|null>}
   */
  static getSessionMeta(sessionId) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT
          ms.id AS session_id,
          ms.meeting_id,
          ms.start_time AS session_start,
          ms.end_time AS session_end,
          ms.transcript_file_name,
          ms.audio_file_name,
          ms.status AS session_status,
          m.title AS meeting_title,
          m.platform,
          m.scheduled_start_time AS meeting_date,
          CONCAT(ui.first_name, ' ', ui.last_name) AS instructor_name,
          ui.email AS instructor_email
        FROM meeting_sessions ms
        JOIN meetings m ON m.id = ms.meeting_id
        LEFT JOIN users ui ON ui.id = m.created_by
        WHERE ms.id = ?
      `;
      db.get(sql, [parseInt(sessionId, 10)], (err, row) => {
        if (err) {
          logger.error('Model(MeetingAiEvaluationReportModel): Error fetching session meta:', err);
          return reject(err);
        }
        resolve(row || null);
      });
    });
  }

  /**
   * Get all AI audit result rows for a given session, joined to rubric names when available.
   * @param {number} sessionId - meeting_sessions.id (also stored in ai_audit_results.session_id)
   * @returns {Promise<Array>}
   */
  static getSessionAuditResults(sessionId) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT
          aar.id,
          aar.meeting_id,
          aar.session_id,
          aar.category_id,
          aar.indicator_id,
          aar.ai_score,
          aar.ai_max_score,
          aar.ai_raw_response,
          aar.oqi_score,
          aar.evidence_quote,
          aar.talk_ratio,
          aar.scored_at,
          COALESCE(aar.category_name, rc.name) AS category_name,
          COALESCE(aar.category_weight, rc.weight) AS category_weight,
          COALESCE(aar.indicator_name, ri.name) AS indicator_name,
          COALESCE(aar.indicator_value, ri.value) AS indicator_value,
          COALESCE(aar.is_gate, ri.is_gate) AS is_gate,
          aar.ai_evidence
        FROM ai_audit_results aar
        LEFT JOIN admin_rubric_categories rc ON rc.id = aar.category_id
        LEFT JOIN admin_rubric_indicators ri ON ri.id = aar.indicator_id
        WHERE aar.session_id = ?
        ORDER BY COALESCE(aar.category_name, rc.name, 'Other'),
                 COALESCE(aar.indicator_name, ri.name, '')
      `;
      db.all(sql, [parseInt(sessionId, 10)], (err, rows) => {
        if (err) {
          logger.error('Model(MeetingAiEvaluationReportModel): Error fetching session audit results:', err);
          return reject(err);
        }
        resolve(rows || []);
      });
    });
  }
}

module.exports = MeetingAiEvaluationReportModel;