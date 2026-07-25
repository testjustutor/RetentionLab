/**
 * root/models/MeetingScoresModel.js
 */
const { db } = require('../../database/db');
const { logger } = require('../../utils/logger');

class MeetingScoresModel {
  static upsertScore({ meeting_id, indicator_id, reviewer_id, score = 0, comment = null, score_type = 'MANUAL' }) {
    return new Promise((resolve, reject) => {
      const sql = `INSERT INTO meeting_scores (meeting_id, indicator_id, reviewer_id, score, comment, score_type, scored_at) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP) ON DUPLICATE KEY UPDATE score=VALUES(score), comment=VALUES(comment), reviewer_id=VALUES(reviewer_id), scored_at=CURRENT_TIMESTAMP`;
      db.run(sql, [meeting_id, indicator_id, reviewer_id, score, comment, score_type], function(err) {
        if (err) {
          logger.error('[MeetingScoresModel] upsert error', err);
          return reject(err);
        }
        resolve({ id: this.lastID, meeting_id, indicator_id, reviewer_id });
      });
    });
  }

  static getScoresByMeeting(meetingId) {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM meeting_scores WHERE meeting_id = ?', [meetingId], (err, rows) => err ? reject(err) : resolve(rows || []));
    });
  }
}

module.exports = MeetingScoresModel;
