/**
 * root/models/reviewers/ReviewerScoresModel.js
 *
 * Data access for the reviewer scores report page. All SQL lives here.
 * Only scores saved by the logged-in reviewer are returned (meeting_session_scores.reviewer_id).
 */
const { db } = require('../../database/db');
const { logger } = require('../../utils/logger');

class ReviewerScoresModel {
  /**
   * Filter options (meetings + sessions) for the reviewer's assigned sessions.
   * @param {number} reviewerId
   * @returns {Promise<{ meetings: Array, sessions: Array }>}
   */
  static getFilterOptions(reviewerId) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT m.id AS meeting_id,
               m.title AS meeting_title,
               ss.id AS session_id,
               ss.start_time AS session_start
        FROM meeting_sessions ss
        JOIN meetings m ON m.id = ss.meeting_id
        JOIN meeting_reviewers mr ON mr.meeting_id = m.id AND mr.reviewer_id = ?
          AND mr.assigned_by IS NOT NULL AND mr.assigned_by <> mr.reviewer_id
        ORDER BY m.title ASC, ss.start_time DESC
      `;
      db.all(sql, [reviewerId], (err, rows) => {
        if (err) {
          logger.error('[ReviewerScoresModel] getFilterOptions error', err);
          return reject(err);
        }
        const meetingsMap = {};
        const sessions = [];
        (rows || []).forEach((r) => {
          if (!meetingsMap[r.meeting_id]) {
            meetingsMap[r.meeting_id] = { id: r.meeting_id, title: r.meeting_title || `Meeting #${r.meeting_id}` };
          }
          sessions.push({ session_id: r.session_id, meeting_id: r.meeting_id, start_time: r.session_start });
        });
        resolve({ meetings: Object.values(meetingsMap), sessions });
      });
    });
  }

  /**
   * Report rows for the logged-in reviewer, optionally filtered.
   * @param {number} reviewerId
   * @param {Object} filters
   *   { from_date?, to_date?, meeting_id?, session_id? }
   * @returns {Promise<{ rows: Array, summary: Object }>}
   */
  static getReport(reviewerId, filters = {}) {
    return new Promise((resolve, reject) => {
      const conditions = ['ms.reviewer_id = ?'];
      const params = [reviewerId];

      if (filters.meeting_id) {
        conditions.push('ms.meeting_id = ?');
        params.push(Number(filters.meeting_id));
      }
      if (filters.session_id) {
        conditions.push('ms.session_id = ?');
        params.push(Number(filters.session_id));
      }
      if (filters.from_date) {
        conditions.push('ms.scored_at >= ?');
        params.push(`${filters.from_date} 00:00:00`);
      }
      if (filters.to_date) {
        conditions.push('ms.scored_at < DATE_ADD(?, INTERVAL 1 DAY)');
        params.push(`${filters.to_date} 00:00:00`);
      }

      const sql = `
        SELECT ms.id,
               ms.meeting_id,
               ms.session_id,
               ms.indicator_id,
               ms.score,
               ms.score_type,
               ms.comment,
               ms.scored_at,
               ms.created_at,
               m.title AS meeting_title,
               ss.start_time AS session_start,
               ss.status AS session_status,
               i.name AS indicator_name,
               i.indicator_code AS indicator_code,
               i.type AS indicator_type,
               c.name AS category_name,
               c.category_code AS category_code
        FROM meeting_session_scores ms
        JOIN meetings m ON m.id = ms.meeting_id
        LEFT JOIN meeting_sessions ss ON ss.id = ms.session_id
        LEFT JOIN admin_rubric_indicators i ON i.id = ms.indicator_id
        LEFT JOIN admin_rubric_categories c ON c.id = i.admin_category_id
        WHERE ${conditions.join(' AND ')}
        ORDER BY ms.scored_at DESC, ms.id DESC
        LIMIT 2000
      `;

      db.all(sql, params, (err, rows) => {
        if (err) {
          logger.error('[ReviewerScoresModel] getReport error', err);
          return reject(err);
        }
        const all = rows || [];
        const numeric = all.map((r) => Number(r.score)).filter((s) => Number.isFinite(s));
        const avgScore = numeric.length ? Math.round((numeric.reduce((a, b) => a + b, 0) / numeric.length) * 10) / 10 : 0;
        const meetingIds = new Set(all.map((r) => r.meeting_id));
        const sessionIds = new Set(all.map((r) => r.session_id));
        const summary = {
          total_scores: all.length,
          avg_score: avgScore,
          meetings_covered: meetingIds.size,
          sessions_covered: sessionIds.size
        };
        resolve({ rows: all, summary });
      });
    });
  }
}

module.exports = ReviewerScoresModel;