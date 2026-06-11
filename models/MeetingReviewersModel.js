/**
 * root/models/MeetingReviewersModel.js
 */
const { db } = require('../database/db');
const { logger } = require('../utils/logger');

class MeetingReviewersModel {
  static assignReviewer(meetingId, reviewerId, assignedBy) {
    return new Promise((resolve, reject) => {
      const sql = `INSERT OR IGNORE INTO meeting_reviewers (meeting_id, reviewer_id, assigned_by, assigned_at, review_status) VALUES (?, ?, ?, CURRENT_TIMESTAMP, 'pending')`;
      db.run(sql, [meetingId, reviewerId, assignedBy || null], function(err) {
        if (err) return reject(err);
        resolve({ id: this.lastID, meetingId, reviewerId });
      });
    });
  }

  static getReviewersForMeeting(meetingId) {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM meeting_reviewers WHERE meeting_id = ? ORDER BY assigned_at DESC', [meetingId], (err, rows) => err ? reject(err) : resolve(rows || []));
    });
  }

  static setReviewStatus(id, status, comments) {
    return new Promise((resolve, reject) => {
      db.run('UPDATE meeting_reviewers SET review_status = ?, reviewed_at = CURRENT_TIMESTAMP, comments = ? WHERE id = ?', [status, comments || null, id], function(err) {
        if (err) return reject(err);
        resolve({ updated: this.changes > 0 });
      });
    });
  }

  static removeReviewer(id) {
    return new Promise((resolve, reject) => {
      db.run('DELETE FROM meeting_reviewers WHERE id = ?', [id], function(err) {
        if (err) return reject(err);
        resolve({ removed: this.changes > 0 });
      });
    });
  }
}

module.exports = MeetingReviewersModel;
