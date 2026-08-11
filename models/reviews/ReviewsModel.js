/**
 * models/reviews/ReviewsModel.js
 * Data access for meeting_reviewers / review endpoints.
 * All SQL lives here; controllers only call these methods.
 */
const { db } = require('../../database/db');
const { logger } = require('../../utils/logger');

class ReviewsModel {
  /**
   * Get the email for a user by id.
   * @param {number} userId
   * @returns {Promise<object|null>} { email }
   */
  static findEmailByUserId(userId) {
    return new Promise((resolve, reject) => {
      db.get('SELECT email FROM users WHERE id = ?', [userId], (err, row) => err ? reject(err) : resolve(row));
    });
  }

  /**
   * List review assignments, optionally filtered by company_id and status.
   * @param {number|null} companyId
   * @param {string|null} status
   * @returns {Promise<Array>}
   */
  static getReviews(companyId = null, status = null) {
    return new Promise((resolve, reject) => {
      let sql = `
        SELECT mr.*,
               m.title as meeting_title, m.scheduled_start_time as start_time, m.scheduled_end_time as end_time, m.platform, m.meeting_link,
               m.calendar_account,
               rev.first_name as reviewer_name, rev.email as reviewer_email,
               creator.first_name as assigned_by_name,
               owner.company_id as owner_company_id,
               (SELECT COUNT(*) FROM meeting_scores ms WHERE ms.meeting_id = mr.meeting_id) as score_count
        FROM meeting_reviewers mr
        LEFT JOIN meetings m ON m.external_meeting_id = mr.meeting_id
        LEFT JOIN users rev ON rev.id = mr.reviewer_id
        LEFT JOIN users creator ON creator.id = mr.assigned_by
        LEFT JOIN users owner ON owner.email = m.calendar_account
        WHERE 1=1
      `;
      const params = [];

      if (companyId) {
        sql += ' AND (owner.company_id = ? OR owner.company_id IS NULL)';
        params.push(companyId);
      }

      if (status) {
        sql += ' AND mr.review_status = ?';
        params.push(status);
      }

      sql += ' ORDER BY mr.assigned_at DESC LIMIT 100';

      db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows || []));
    });
  }

  /**
   * Update the status of a review assignment.
   * @param {number} id
   * @param {string} status
   * @returns {Promise<{ updated: boolean }>}
   */
  static updateReviewStatus(id, status) {
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE meeting_reviewers SET review_status = ?, reviewed_at = CASE WHEN ? = 'completed' THEN CURRENT_TIMESTAMP ELSE reviewed_at END WHERE id = ?`,
        [status, status, id],
        function(err) { err ? reject(err) : resolve({ updated: this.changes > 0 }); }
      );
    });
  }

  /**
   * List instructors for filter dropdown, optionally filtered by company_id.
   * @param {number|null} companyId
   * @returns {Promise<Array>} [{ id, name, email, status }]
   */
  static getInstructors(companyId = null) {
    return new Promise((resolve, reject) => {
      let sql = `
        SELECT DISTINCT u.id, u.first_name, u.last_name, u.email, u.status
        FROM users u
        WHERE u.role_id = (SELECT id FROM roles WHERE role_name = 'instructor')
        AND u.deleted_at IS NULL
      `;
      const params = [];

      if (companyId) {
        sql += ' AND u.company_id = ?';
        params.push(companyId);
      }

      sql += ' ORDER BY u.first_name, u.last_name';

      db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows || []));
    }).then(rows =>
      rows.map(r => ({
        id: r.id,
        name: `${r.first_name} ${r.last_name || ''}`.trim(),
        email: r.email,
        status: r.status
      }))
    );
  }

  /**
   * Get meetings for an instructor (matched by calendar account email).
   * @param {string} email
   * @returns {Promise<Array>} [{ meeting_id, id, title, scheduled_start_time, scheduled_end_time, platform, status }]
   */
  static getMeetingsByInstructorEmail(email) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT m.id, m.external_meeting_id as meeting_id, m.title, m.scheduled_start_time,
                m.scheduled_end_time, m.platform, m.status
         FROM meetings m
         WHERE LOWER(m.calendar_account) = LOWER(?)
         AND m.scheduled_start_time >= DATE_SUB(NOW(), INTERVAL 90 DAY)
         ORDER BY m.scheduled_start_time DESC
         LIMIT 50`,
        [email],
        (err, rows) => err ? reject(err) : resolve(rows || [])
      );
    });
  }

  /**
   * Assign a reviewer to a single meeting (INSERT IGNORE).
   * @param {string} meetingId
   * @param {number} reviewerId
   * @param {number} assignedById
   * @returns {Promise<{ id: number, changes: number }>}
   */
  static assignReviewerToMeeting(meetingId, reviewerId, assignedById) {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT IGNORE INTO meeting_reviewers (meeting_id, reviewer_id, assigned_by, assigned_at, review_status)
         VALUES (?, ?, ?, CURRENT_TIMESTAMP, 'pending')`,
        [meetingId, reviewerId, assignedById],
        function(err) {
          if (err) return reject(err);
          resolve({ id: this.lastID, changes: this.changes });
        }
      );
    });
  }
}

module.exports = ReviewsModel;
