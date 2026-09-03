/**
 * root/models/reviews/MeetingScoresModel.js
 *
 * NOTE: The legacy `meeting_scores` table has been removed. Scores are now stored
 * in `meeting_session_scores` (per meeting+session+indicator). This facade keeps the
 * legacy reviewer scoring endpoints working by resolving a session for a meeting when
 * the caller only supplies a meeting_id.
 */
const { db } = require('../../database/db');
const { logger } = require('../../utils/logger');

class MeetingScoresModel {
  /**
   * Resolve the most recent session_id for a meeting. Used when a caller only
   * supplies meeting_id (e.g. the legacy reviewer scoring endpoint).
   * @param {number} meetingId - Internal meetings.id
   * @returns {Promise<number|null>}
   */
  static resolveSessionId(meetingId) {
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT id FROM meeting_sessions WHERE meeting_id = ? ORDER BY COALESCE(start_time, created_at) DESC LIMIT 1',
        [meetingId],
        (err, row) => (err ? reject(err) : resolve(row ? row.id : null))
      );
    });
  }

  static upsertScore({ meeting_id, session_id, indicator_id, reviewer_id, score = 0, comment = null, score_type = 'MANUAL' }) {
    return new Promise((resolve, reject) => {
      if (!meeting_id || !indicator_id) {
        return reject(new Error('meeting_id and indicator_id are required'));
      }

      const sessionPromise = session_id != null
        ? Promise.resolve(Number(session_id))
        : MeetingScoresModel.resolveSessionId(meeting_id);

      sessionPromise.then((sid) => {
        if (!sid) {
          return reject(new Error(`No session found for meeting ${meeting_id}`));
        }

        const sql = `INSERT INTO meeting_session_scores
                     (meeting_id, session_id, indicator_id, reviewer_id, score, comment, score_type, scored_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                     ON DUPLICATE KEY UPDATE
                       score = VALUES(score),
                       comment = VALUES(comment),
                       reviewer_id = VALUES(reviewer_id),
                       score_type = VALUES(score_type),
                       scored_at = CURRENT_TIMESTAMP`;
        db.run(sql, [meeting_id, sid, indicator_id, reviewer_id || null, score, comment, score_type], function (err) {
          if (err) {
            logger.error('[MeetingScoresModel] upsert error', err);
            return reject(err);
          }
          resolve({ id: this.lastID, meeting_id, session_id: sid, indicator_id, reviewer_id });
        });
      }).catch(reject);
    });
  }

  static getScoresByMeeting(meetingId) {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM meeting_session_scores WHERE meeting_id = ?', [meetingId], (err, rows) =>
        err ? reject(err) : resolve(rows || [])
      );
    });
  }
}

module.exports = MeetingScoresModel;
