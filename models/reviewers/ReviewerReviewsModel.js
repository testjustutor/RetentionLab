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
        INNER JOIN meeting_reviewers mr ON mr.meeting_id = m.external_meeting_id AND mr.reviewer_id = ?
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
        SELECT m.external_meeting_id,
               m.title as meeting_title,
               m.scheduled_start_time,
               m.scheduled_end_time,
               m.platform,
               m.meeting_link,
               m.status as meeting_status,
               m.calendar_account,
               ma.audio_path,
               ma.transcript_path,
               ma.summary_path,
               ma.oqi_score,
               ma.review_status as asset_review_status,
               (SELECT COUNT(*) FROM meeting_session_scores ms WHERE ms.meeting_id = m.id) as score_count,
               (SELECT AVG(ms.score) FROM meeting_session_scores ms WHERE ms.meeting_id = m.id) as avg_score,
               mr.id as review_id,
               mr.review_status,
               mr.assigned_at,
               mr.reviewed_at,
               mr.comments,
               CONCAT(u.first_name, ' ', u.last_name) as assigned_by_name
        FROM meetings m
        INNER JOIN meeting_reviewers mr ON mr.meeting_id = m.external_meeting_id AND mr.reviewer_id = ?
        LEFT JOIN meeting_assets ma ON ma.meeting_id = m.external_meeting_id
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
}

module.exports = ReviewerReviewsModel;