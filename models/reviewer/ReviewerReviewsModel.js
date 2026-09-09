/**
 * models/reviewers/ReviewerReviewsModel.js
 * Data access for reviewer-reviews endpoints.
 * All SQL lives here; controllers only call these methods.
 */
const { db } = require('../../database/db');
const { logger } = require('../../utils/logger');

class ReviewerReviewsModel {
  /**
   * List instructors that the given reviewer has been assigned to (via meeting_reviewers).
   * @param {number} reviewerId
   * @returns {Promise<Array>} [{ id, first_name, last_name, email, role_name }]
   */
  static getInstructorsForReviewer(reviewerId) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT DISTINCT u.id, u.first_name, u.last_name, u.email,
               r.role_name
        FROM users u
        LEFT JOIN roles r ON r.id = u.role_id
        INNER JOIN meetings m ON LOWER(m.calendar_account) = LOWER(u.email)
        INNER JOIN meeting_reviewers mr ON mr.meeting_id = m.id AND mr.reviewer_id = ?
        WHERE u.deleted_at IS NULL
        AND u.is_active = 1
        AND r.role_name IN ('solo_instructor', 'instructor')
        ORDER BY u.first_name, u.last_name
      `;
      db.all(sql, [reviewerId], (err, rows) => {
        if (err) {
          logger.error('Model(ReviewerReviewsModel): Error fetching instructors:', err);
          return reject(err);
        }
        resolve(rows || []);
      });
    });
  }

  /**
   * Get sessions (meetings) for a specific instructor, visible to the reviewer.
   * @param {number} reviewerId
   * @param {number} instructorId
   * @param {string} status
   * @param {string} search
   * @returns {Promise<Array>}
   */
  static getInstructorSessions(reviewerId, instructorId, status, search) {
    return new Promise((resolve, reject) => {
      let sql = `
        SELECT m.id as meeting_id,
               m.title as meeting_title,
               m.scheduled_start_time as start_time,
               m.scheduled_end_time as end_time,
               m.platform,
               m.meeting_link,
               m.status as meeting_status,
               m.calendar_account,
               ma.audio_path,
               ma.transcript_path,
               ma.summary_path,
               ma.oqi_score,
               (SELECT COUNT(*) FROM meeting_session_scores ms WHERE ms.meeting_id = m.id) as score_count,
               (SELECT AVG(ms.score) FROM meeting_session_scores ms WHERE ms.meeting_id = m.id) as avg_score,
               mr.id as review_id,
               mr.review_status,
               mr.assigned_at,
               mr.reviewed_at,
               mr.comments,
               CONCAT(u.first_name, ' ', u.last_name) as assigned_by_name
        FROM meetings m
        INNER JOIN meeting_reviewers mr ON mr.meeting_id = m.id AND mr.reviewer_id = ?
        LEFT JOIN meeting_assets ma ON ma.meeting_id = m.id
        LEFT JOIN users u ON u.id = mr.assigned_by
        WHERE LOWER(m.calendar_account) = (SELECT LOWER(email) FROM users WHERE id = ?)
      `;
      const params = [reviewerId, instructorId];

      if (status === 'pending') {
        sql += ` AND (mr.review_status = 'pending' OR mr.review_status IS NULL)`;
      } else if (status === 'in_progress') {
        sql += ` AND mr.review_status IN ('in_progress', 'in-progress')`;
      } else if (status === 'completed') {
        sql += ` AND mr.review_status = 'completed'`;
      } else if (status === 'unassigned') {
        sql += ` AND mr.review_status IS NULL`;
      }

      if (search) {
        sql += ` AND (m.title LIKE ? OR m.platform LIKE ? OR m.calendar_account LIKE ?)`;
        params.push(`%${search}%`, `%${search}%`, `%${search}%`);
      }

      sql += ' ORDER BY m.scheduled_start_time DESC LIMIT 100';

      db.all(sql, params, (err, rows) => {
        if (err) {
          logger.error('Model(ReviewerReviewsModel): Error fetching sessions:', err);
          return reject(err);
        }
        resolve(rows || []);
      });
    });
  }

  /**
   * Find an existing review assignment by meeting_id + reviewer_id.
   * @param {string} meetingId
   * @param {number} reviewerId
   * @returns {Promise<object|null>}
   */
  static findReview(meetingId, reviewerId) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT * FROM meeting_reviewers WHERE meeting_id = ? AND reviewer_id = ?`,
        [meetingId, reviewerId],
        (err, row) => {
          if (err) {
            logger.error('Model(ReviewerReviewsModel): Error fetching review:', err);
            return reject(err);
          }
          resolve(row || null);
        }
      );
    });
  }

  /**
   * Get quick stats for a reviewer by review_status.
   * @param {number} reviewerId
   * @returns {Promise<Array>} [{ review_status, count, avg_hours }]
   */
  static getReviewerStats(reviewerId) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT mr.review_status,
               COUNT(*) as count,
               AVG(CASE WHEN mr.review_status = 'completed' AND mr.reviewed_at IS NOT NULL AND mr.assigned_at IS NOT NULL
                   THEN TIMESTAMPDIFF(HOUR, mr.assigned_at, mr.reviewed_at) END) as avg_hours
        FROM meeting_reviewers mr
        WHERE mr.reviewer_id = ?
        GROUP BY mr.review_status
      `;
      db.all(sql, [reviewerId], (err, rows) => {
        if (err) {
          logger.error('Model(ReviewerReviewsModel): Error fetching stats:', err);
          return reject(err);
        }
        resolve(rows || []);
      });
    });
  }

  /**
   * Review queue items (meeting_reviewers + meeting) for the reviewer, filtered
   * by date range / meeting / session.
   * @param {number} reviewerId
   * @param {Object} filters { from_date?, to_date?, meeting_id?, session_id? }
   * @returns {Promise<{ rows: Array, summary: Object }>}
   */
  /**
   * Analytics for the reviewer: review status distribution, score stats,
   * evaluation summary stats, filtered by date range / meeting / session.
   * @param {number} reviewerId
   * @param {Object} filters { from_date?, to_date?, meeting_id?, session_id? }
   * @returns {Promise<Object>}
   */
  static getFilteredReviews(reviewerId, filters = {}) {
    return new Promise((resolve, reject) => {
      const conditions = ['mr.reviewer_id = ?', 'mr.assigned_by IS NOT NULL', 'mr.assigned_by <> mr.reviewer_id'];
      const params = [reviewerId];

      if (filters.meeting_id) {
        conditions.push('m.id = ?');
        params.push(Number(filters.meeting_id));
      }
      if (filters.session_id) {
        conditions.push('EXISTS (SELECT 1 FROM meeting_sessions ss WHERE ss.id = ? AND ss.meeting_id = m.id)');
        params.push(Number(filters.session_id));
      }
      if (filters.from_date) {
        conditions.push('m.scheduled_start_time >= ?');
        params.push(`${filters.from_date} 00:00:00`);
      }
      if (filters.to_date) {
        conditions.push('m.scheduled_start_time < DATE_ADD(?, INTERVAL 1 DAY)');
        params.push(`${filters.to_date} 00:00:00`);
      }

      const sql = `
        SELECT m.id as meeting_id,
               m.title as meeting_title,
               m.scheduled_start_time as start_time,
               m.scheduled_end_time as end_time,
               m.platform,
               m.meeting_link,
               m.status as meeting_status,
               m.calendar_account,
               (SELECT COUNT(*) FROM meeting_session_scores ms WHERE ms.meeting_id = m.id) as score_count,
               (SELECT AVG(ms.score) FROM meeting_session_scores ms WHERE ms.meeting_id = m.id) as avg_score,
               (SELECT COUNT(*) FROM meeting_sessions ss WHERE ss.meeting_id = m.id) as session_count,
               mr.id as review_id,
               mr.review_status,
               mr.assigned_at,
               mr.reviewed_at,
               mr.comments,
               CONCAT(u.first_name, ' ', u.last_name) as assigned_by_name
        FROM meetings m
        INNER JOIN meeting_reviewers mr ON mr.meeting_id = m.id
        LEFT JOIN users u ON u.id = mr.assigned_by
        WHERE ${conditions.join(' AND ')}
        ORDER BY m.scheduled_start_time DESC, mr.id DESC
        LIMIT 2000
      `;

      db.all(sql, params, (err, rows) => {
        if (err) {
          logger.error('Model(ReviewerReviewsModel): Error fetching filtered reviews:', err);
          return reject(err);
        }
        const all = rows || [];
        const counts = {
          total: all.length,
          unassigned: all.filter((r) => r.review_status === 'unassigned' || r.review_status === null).length,
          pending: all.filter((r) => r.review_status === 'pending').length,
          in_progress: all.filter((r) => r.review_status === 'in_progress' || r.review_status === 'in-progress').length,
          completed: all.filter((r) => r.review_status === 'completed').length
        };
        resolve({ rows: all, summary: counts });
      });
    });
  }

  /**
   * Reviewer analytics: status distribution + score/eval stats for the reviewer,
   * filtered by date range / meeting / session.
   */
  static getAnalytics(reviewerId, filters = {}) {
    return new Promise((resolve, reject) => {
      const conditions = ['mr.reviewer_id = ?', 'mr.assigned_by IS NOT NULL', 'mr.assigned_by <> mr.reviewer_id'];
      const params = [reviewerId];
      if (filters.meeting_id) { conditions.push('m.id = ?'); params.push(Number(filters.meeting_id)); }
      if (filters.session_id) {
        conditions.push('EXISTS (SELECT 1 FROM meeting_sessions ss WHERE ss.id = ? AND ss.meeting_id = m.id)');
        params.push(Number(filters.session_id));
      }
      if (filters.from_date) { conditions.push('m.scheduled_start_time >= ?'); params.push(`${filters.from_date} 00:00:00`); }
      if (filters.to_date) { conditions.push('m.scheduled_start_time < DATE_ADD(?, INTERVAL 1 DAY)'); params.push(`${filters.to_date} 00:00:00`); }

      const statusSql = `
        SELECT mr.review_status AS status, COUNT(*) AS cnt
        FROM meeting_reviewers mr
        JOIN meetings m ON m.id = mr.meeting_id
        WHERE ${conditions.join(' AND ')}
        GROUP BY mr.review_status
      `;

      const scopeMeetingsSql = (andClause) => `
        SELECT DISTINCT m.id
        FROM meetings m
        JOIN meeting_reviewers mr ON mr.meeting_id = m.id AND mr.reviewer_id = ?
          AND mr.assigned_by IS NOT NULL AND mr.assigned_by <> mr.reviewer_id
        ${andClause}
      `;

      db.all(statusSql, params, (err1, statusRows) => {
        if (err1) { logger.error('Model(ReviewerReviewsModel): Analytics status error', err1); return reject(err1); }

        const meetingConditions = [];
        const meetingParams = [reviewerId];
        if (filters.meeting_id) { meetingConditions.push('m.id = ?'); meetingParams.push(Number(filters.meeting_id)); }
        if (filters.from_date) { meetingConditions.push('m.scheduled_start_time >= ?'); meetingParams.push(`${filters.from_date} 00:00:00`); }
        if (filters.to_date) { meetingConditions.push('m.scheduled_start_time < DATE_ADD(?, INTERVAL 1 DAY)'); meetingParams.push(`${filters.to_date} 00:00:00`); }
        const clause = meetingConditions.length ? `WHERE ${meetingConditions.join(' AND ')}` : '';
        const scopeSql = `
          SELECT DISTINCT m.id
          FROM meetings m
          JOIN meeting_reviewers mr ON mr.meeting_id = m.id AND mr.reviewer_id = ?
            AND mr.assigned_by IS NOT NULL AND mr.assigned_by <> mr.reviewer_id
          ${clause}
        `;

        db.all(scopeSql, meetingParams, (err2, meetingRows) => {
          if (err2) { logger.error('Model(ReviewerReviewsModel): Analytics meetings error', err2); return reject(err2); }
          const ids = (meetingRows || []).map((r) => r.id);
          if (!ids.length) {
            return resolve({
              status_distribution: (statusRows || []).map((r) => ({ status: r.status, count: r.cnt })),
              total_reviews: (statusRows || []).reduce((a, r) => a + r.cnt, 0),
              scores: { total_scores: 0, avg_score: 0 },
              evaluations: { total_evals: 0, avg_final_score: 0 },
              distribution: {}
            });
          }
          const placeholders = ids.map(() => '?').join(',');

          db.all(
            `SELECT COUNT(*) AS total_scores, COALESCE(AVG(ms.score), 0) AS avg_score
             FROM meeting_session_scores ms
             WHERE ms.reviewer_id = ? AND ms.meeting_id IN (${placeholders})`,
            [reviewerId, ...ids],
            (err3, scoreRows) => {
              if (err3) { logger.error('Reviewer analytics scores error', err3); return reject(err3); }
              db.all(
                `SELECT COUNT(*) AS total_evals, COALESCE(AVG(te.final_score_pct), 0) AS avg_final_score
                 FROM tutor_evaluation_summary te
                 WHERE te.reviewer_id = ? AND te.session_id IN (
                   SELECT ss.id FROM meeting_sessions ss WHERE ss.meeting_id IN (${placeholders})
                 )`,
                [reviewerId, ...ids],
                (err4, evalRows) => {
                  if (err4) { logger.error('Reviewer analytics evals error', err4); return reject(err4); }
                  const dist = {};
                  (statusRows || []).forEach((r) => { dist[r.status] = r.cnt; });
                  const sr = (scoreRows && scoreRows[0]) || {};
                  const er = (evalRows && evalRows[0]) || {};
                  resolve({
                    status_distribution: (statusRows || []).map((r) => ({ status: r.status, count: r.cnt })),
                    total_reviews: (statusRows || []).reduce((a, r) => a + (r.cnt || 0), 0),
                    scores: { total_scores: sr.total_scores || 0, avg_score: Math.round((sr.avg_score || 0) * 10) / 10 },
                    evaluations: { total_evals: er.total_evals || 0, avg_final_score: Math.round((er.avg_final_score || 0) * 10) / 10 },
                    distribution: dist
                  });
                }
              );
            }
          );
        });
      });
    });
  }
}

module.exports = ReviewerReviewsModel;