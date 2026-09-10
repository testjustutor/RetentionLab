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
   * Get meetings for a given instructor (or all) with their sessions, each annotated with
   * an AI audit summary (indicator count, avg score %, latest scored_at).
   *
   * The audit summary is computed via a LEFT JOIN to a pre-aggregated subquery instead of
   * a separate unfiltered query over the whole ai_audit_results table (previously
   * getSessionAuditSummary() ran with no filters on every call and the controller merged
   * it in JS). This keeps the aggregate scoped to what the join actually touches and avoids
   * a second full scan+group-by that mostly gets thrown away.
   *
   * Score averaging: a row with ai_score = NULL is an EXCLUDED indicator (e.g. video-gated,
   * not scorable from a transcript) and must not contribute to the average. A row with
   * ai_score set but ai_max_score = 0/NULL is scored-but-malformed and should contribute 0,
   * not be dropped. This mirrors the per-row logic used in getSessionAuditResults/the
   * controller's getSessionReport average calc, so summary and detail numbers agree.
   *
   * NOTE (unchanged behavior, flagged for review): date filters apply to
   * meetings.scheduled_start_time, not meeting_sessions.start_time — if a session can run on
   * a different day than its meeting is scheduled, this may include/exclude unexpectedly.
   * Also, "instructor" is resolved via meetings.created_by, which may not always be the
   * instructor who ran the session (e.g. meetings created by an admin/coordinator).
   *
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
          ms.audio_file_name,
          COALESCE(audit.ai_indicator_count, 0) AS ai_indicator_count,
          COALESCE(audit.ai_scored_count, 0) AS ai_scored_count,
          COALESCE(audit.ai_avg_score_pct, 0) AS ai_avg_score_pct,
          audit.ai_scored_at AS ai_scored_at,
          COALESCE(audit.ai_max_oqi_score, 0) AS ai_oqi_score
        FROM meetings m
        LEFT JOIN users ui ON ui.id = m.created_by
        JOIN meeting_sessions ms ON ms.meeting_id = m.id
        LEFT JOIN (
          SELECT
            aar.session_id,
            COUNT(aar.id) AS ai_indicator_count,
            SUM(CASE WHEN aar.status_code IN (1, 2) THEN 1 ELSE 0 END) AS ai_scored_count,
            MAX(aos.final_score) AS ai_avg_score_pct,
            MAX(aar.scored_at) AS ai_scored_at,
            MAX(aos.final_score) AS ai_max_oqi_score
          FROM ai_audit_results aar
          LEFT JOIN ai_audit_overall_summary aos
            ON aos.session_id = aar.session_id AND aos.calc_source = 'submit'
          WHERE aar.session_id IS NOT NULL
          GROUP BY aar.session_id
        ) audit ON audit.session_id = ms.id
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
   * Get a single session's aggregate overall summary (from ai_audit_overall_summary).
   * @param {number} sessionId - meeting_sessions.id
   * @returns {Promise<object|null>}
   */
  static getSessionOverallSummary(sessionId) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT
          session_id,
          final_score,
          total_weighted_percent,
          total_criteria_all,
          calc_source,
          red_flag,
          overall_summary
        FROM ai_audit_overall_summary
        WHERE session_id = ? AND calc_source = 'submit'
        ORDER BY id DESC
        LIMIT 1
      `;
      db.get(sql, [parseInt(sessionId, 10)], (err, row) => {
        if (err) {
          logger.error('Model(MeetingAiEvaluationReportModel): Error fetching session overall summary:', err);
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
   *
   * The rewritten ai_audit_results schema only stores status_code (1=Met,
   * 2=Not Met, 3=N/A), is_gate, ai_evidence, reason — category/indicator
   * display names and weights resolve via the canonical rubric_* tables.
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
          aar.status_code,
          aar.is_gate,
          aar.reason,
          aar.ai_evidence,
          aar.scored_at,
          rc.name AS category_name,
          rc.weight AS category_weight,
          ri.name AS indicator_name,
          ri.value AS indicator_value,
          CASE aar.status_code
            WHEN 1 THEN 'Met'
            WHEN 2 THEN 'Not met'
            ELSE 'N/A'
          END AS rating
        FROM ai_audit_results aar
        LEFT JOIN rubric_categories rc ON rc.id = aar.category_id
        LEFT JOIN rubric_indicators ri ON ri.id = aar.indicator_id
        WHERE aar.session_id = ?
        ORDER BY COALESCE(rc.name, 'Other'),
                 COALESCE(ri.name, '')
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

  /**
   * Get a single session's per-category rollup (from ai_audit_category_scores),
   * joined to rubric_categories for the display name and canonical A-H order.
   * @param {number} sessionId - meeting_sessions.id
   * @returns {Promise<Array>} one row per category with counts + category_score
   */
  static getSessionCategoryScores(sessionId) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT
          acs.category_id,
          rc.name AS category_name,
          rc.category_code,
          acs.category_weight,
          acs.count_met,
          acs.count_not_met,
          acs.count_not_applicable,
          acs.total_criteria,
          acs.category_score
        FROM ai_audit_category_scores acs
        LEFT JOIN rubric_categories rc ON rc.id = acs.category_id
        WHERE acs.session_id = ? AND acs.calc_source = 'submit'
        ORDER BY COALESCE(rc.category_code, ''), COALESCE(rc.name, 'Other')
      `;
      db.all(sql, [parseInt(sessionId, 10)], (err, rows) => {
        if (err) {
          logger.error('Model(MeetingAiEvaluationReportModel): Error fetching session category scores:', err);
          return reject(err);
        }
        resolve(rows || []);
      });
    });
  }
}

module.exports = MeetingAiEvaluationReportModel;