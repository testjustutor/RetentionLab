/**
 * models/reviewers/ReviewerSessionsModel.js
 * Data access for reviewer-sessions endpoints.
 * All SQL lives here; controllers only call these methods.
 */
const { db } = require('../../database/db');
const { logger } = require('../../utils/logger');

class ReviewerSessionsModel {
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
          logger.error('Model(ReviewerSessionsModel): Error fetching instructors:', err);
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
        SELECT m.external_meeting_id as meeting_id,
               m.title as meeting_title,
               m.scheduled_start_time as start_time,
               m.scheduled_end_time as end_time,
               m.platform,
               m.meeting_link,
               m.status as meeting_status,
               m.calendar_account,
               m.summary as meeting_summary,
               ma.audio_path,
               ma.transcript_path,
               ma.summary_path,
               ma.diarization_path,
               ma.audit_json_path,
               ma.embeddings_path,
               ma.llm_prompts_path,
               ma.action_items_path,
               ma.sentiment_analysis_path,
               ma.talk_ratio_json_path,
               ma.questions_asked_count_path,
               ma.topic_clusters_path,
               ma.oqi_score,
               ma.evidence_quote,
               (SELECT COUNT(*) FROM meeting_scores ms WHERE ms.meeting_id = m.external_meeting_id) as score_count,
               (SELECT AVG(ms.score) FROM meeting_scores ms WHERE ms.meeting_id = m.external_meeting_id) as avg_score,
               (SELECT COUNT(*) FROM participant_sessions ps WHERE ps.meeting_id = m.external_meeting_id) as participant_count
        FROM meetings m
        INNER JOIN meeting_reviewers mr ON mr.meeting_id = m.external_meeting_id AND mr.reviewer_id = ?
        LEFT JOIN meeting_assets ma ON ma.meeting_id = m.external_meeting_id
        WHERE LOWER(m.calendar_account) = (SELECT LOWER(email) FROM users WHERE id = ?)
      `;
      const params = [reviewerId, instructorId];

      if (status === 'completed') {
        sql += " AND m.status = 'completed'";
      } else if (status === 'in_progress') {
        sql += " AND m.status IN ('in_progress', 'active', 'joining')";
      } else if (status === 'scheduled') {
        sql += " AND m.status IN ('queued', 'launching', 'starting')";
      }

      if (search) {
        sql += " AND (m.title LIKE ? OR m.platform LIKE ? OR m.calendar_account LIKE ?)";
        params.push(`%${search}%`, `%${search}%`, `%${search}%`);
      }

      sql += ' ORDER BY m.scheduled_start_time DESC LIMIT 100';

      db.all(sql, params, (err, rows) => {
        if (err) {
          logger.error('Model(ReviewerSessionsModel): Error fetching sessions:', err);
          return reject(err);
        }
        resolve(rows || []);
      });
    });
  }

  /**
   * Get detailed info for a single meeting.
   * @param {string} meetingId
   * @returns {Promise<object|null>}
   */
  static getSessionDetails(meetingId) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT m.*,
                ma.audio_path, ma.transcript_path, ma.summary_path, ma.wav_audio_path,
                ma.oqi_score, ma.evidence_quote, ma.review_status as asset_review_status,
                ma.reviewer_comments,
                u.first_name || ' ' || u.last_name as owner_name
         FROM meetings m
         LEFT JOIN meeting_assets ma ON ma.meeting_id = m.external_meeting_id
         LEFT JOIN users u ON u.email = m.calendar_account
         WHERE m.external_meeting_id = ?`,
        [meetingId],
        (err, row) => {
          if (err) {
            logger.error('Model(ReviewerSessionsModel): Error fetching session details:', err);
            return reject(err);
          }
          resolve(row || null);
        }
      );
    });
  }

  /**
   * Get scores for a meeting.
   * @param {string} meetingId
   * @returns {Promise<Array>}
   */
  static getScoresForMeeting(meetingId) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT ms.*, rc.name as category_name
         FROM meeting_scores ms
         LEFT JOIN rubric_categories rc ON rc.category_id = ms.category_id
         WHERE ms.meeting_id = ?
         ORDER BY ms.created_at DESC`,
        [meetingId],
        (err, rows) => {
          if (err) {
            logger.error('Model(ReviewerSessionsModel): Error fetching scores:', err);
            return reject(err);
          }
          resolve(rows || []);
        }
      );
    });
  }

  /**
   * Get participants for a meeting.
   * @param {string} meetingId
   * @returns {Promise<Array>}
   */
  static getParticipantsForMeeting(meetingId) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM participant_sessions WHERE meeting_id = ? ORDER BY joined_at`,
        [meetingId],
        (err, rows) => {
          if (err) {
            logger.error('Model(ReviewerSessionsModel): Error fetching participants:', err);
            return reject(err);
          }
          resolve(rows || []);
        }
      );
    });
  }
}

module.exports = ReviewerSessionsModel;