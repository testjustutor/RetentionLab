/**
 * models/reviewers/ReviewerDashboardModel.js
 * Model for reviewer dashboard statistics and data
 */
const { db } = require('../../database/db');
const { logger } = require('../../utils/logger');

class ReviewerDashboardModel {
  /**
   * Get all reviews for a specific reviewer with meeting details
   * @param {number} reviewerId - Reviewer user ID
   * @returns {Promise<Array>} Array of reviews with meeting information
   */
  static async getReviewsByReviewer(reviewerId) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT mr.*, m.title as meeting_title, m.scheduled_start_time as start_time
        FROM meeting_reviewers mr
        JOIN meetings m ON mr.meeting_id = m.external_meeting_id
        WHERE mr.reviewer_id = ?
      `;

      db.all(sql, [reviewerId], (err, rows) => {
        if (err) {
          logger.error('Model(ReviewerDashboardModel): Error fetching reviews:', err);
          return reject(err);
        }
        resolve(rows || []);
      });
    });
  }

  /**
   * Get recent assignments for a reviewer
   * @param {number} reviewerId - Reviewer user ID
   * @param {number} limit - Maximum number of assignments to return
   * @returns {Promise<Array>} Array of recent assignments
   */
  static async getRecentAssignments(reviewerId, limit = 5) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT mr.*, m.title as meeting_title, m.scheduled_start_time as start_time, m.platform
        FROM meeting_reviewers mr
        JOIN meetings m ON mr.meeting_id = m.external_meeting_id
        WHERE mr.reviewer_id = ?
        ORDER BY mr.assigned_at DESC
        LIMIT ?
      `;

      db.all(sql, [reviewerId, limit], (err, rows) => {
        if (err) {
          logger.error('Model(ReviewerDashboardModel): Error fetching recent assignments:', err);
          return reject(err);
        }
        resolve(rows || []);
      });
    });
  }

  /**
   * Get overdue reviews for a reviewer
   * @param {number} reviewerId - Reviewer user ID
   * @param {Date} cutoffDate - Date before which reviews are considered overdue
   * @returns {Promise<Array>} Array of overdue reviews
   */
  static async getOverdueReviews(reviewerId, cutoffDate) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT mr.*, m.title as meeting_title, m.scheduled_start_time as start_time
        FROM meeting_reviewers mr
        JOIN meetings m ON mr.meeting_id = m.external_meeting_id
        WHERE mr.reviewer_id = ? 
        AND mr.review_status = 'pending'
        AND mr.assigned_at < ?
        ORDER BY mr.assigned_at ASC
      `;

      db.all(sql, [reviewerId, cutoffDate.toISOString()], (err, rows) => {
        if (err) {
          logger.error('Model(ReviewerDashboardModel): Error fetching overdue reviews:', err);
          return reject(err);
        }
        resolve(rows || []);
      });
    });
  }

  /**
   * Get completed reviews for a reviewer
   * @param {number} reviewerId - Reviewer user ID
   * @returns {Promise<Array>} Array of completed reviews
   */
  static async getCompletedReviews(reviewerId) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT mr.*, m.title as meeting_title
        FROM meeting_reviewers mr
        JOIN meetings m ON mr.meeting_id = m.external_meeting_id
        WHERE mr.reviewer_id = ? AND mr.review_status = 'completed'
        ORDER BY mr.reviewed_at DESC
      `;

      db.all(sql, [reviewerId], (err, rows) => {
        if (err) {
          logger.error('Model(ReviewerDashboardModel): Error fetching completed reviews:', err);
          return reject(err);
        }
        resolve(rows || []);
      });
    });
  }
}

module.exports = ReviewerDashboardModel;