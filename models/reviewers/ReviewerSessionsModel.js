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
        INNER JOIN meeting_reviewers mr ON mr.meeting_id = m.id AND mr.reviewer_id = ?
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
   *
   * NOTE: several previously-selected meeting_assets columns
   * (diarization_path, audit_json_path, embeddings_path, llm_prompts_path,
   * action_items_path, sentiment_analysis_path, talk_ratio_json_path,
   * questions_asked_count_path, evidence_quote) do not exist on the
   * meeting_assets table as currently migrated (031_create_meeting_assets_table.js
   * only has: audio_path, transcript_path, summary_path, video_path, oqi_score,
   * audit_summary, audit_completed_at, status, processed_at). They were removed
   * here to prevent "Unknown column" SQL errors. meetings.summary was removed
   * for the same reason (meetings has no summary column).
   * If the frontend needs these fields, meeting_assets needs a migration to add
   * them before they can be selected again.
   *
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
               ma.audio_path,
               ma.transcript_path,
               ma.summary_path,
               ma.audit_summary,
               ma.oqi_score,
               ma.status as asset_status,
               (SELECT COUNT(*) FROM meeting_session_scores ms WHERE ms.meeting_id = m.id) as score_count,
               (SELECT AVG(ms.score) FROM meeting_session_scores ms WHERE ms.meeting_id = m.id) as avg_score,
               (SELECT COUNT(*) FROM participants ps WHERE ps.meeting_id = m.id) as participant_count
        FROM meetings m
        INNER JOIN meeting_reviewers mr ON mr.meeting_id = m.id AND mr.reviewer_id = ?
        LEFT JOIN meeting_assets ma ON ma.meeting_id = m.id
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
   *
   * NOTE: meeting_assets.wav_audio_path, evidence_quote, review_status, and
   * reviewer_comments do not exist on meeting_assets as currently migrated —
   * removed to prevent "Unknown column" errors (see getInstructorSessions
   * note above). Also fixed the join key (meeting_assets.meeting_id is an
   * INT FK to meetings.id, not external_meeting_id) and replaced the
   * SQLite/Postgres-style `||` concatenation with MySQL's CONCAT(), matching
   * every other query in this codebase.
   *
   * @param {string} meetingId - meetings.external_meeting_id
   * @returns {Promise<object|null>}
   */
  static getSessionDetails(meetingId) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT m.*,
                ma.audio_path, ma.transcript_path, ma.summary_path,
                ma.oqi_score, ma.status as asset_status,
                CONCAT(u.first_name, ' ', u.last_name) as owner_name
         FROM meetings m
         LEFT JOIN meeting_assets ma ON ma.meeting_id = m.id
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
   * Get scores for a meeting, with indicator + category context.
   * NOTE: meeting_session_scores.meeting_id is an INT FK to meetings.id
   * (not meetings.external_meeting_id), and the table has no category_id
   * column directly — category comes from the indicator via
   * admin_rubric_indicators.admin_category_id. Callers must pass the
   * internal numeric meetings.id here, not the external_meeting_id string.
   * @param {number} meetingId - Internal meetings.id
   * @returns {Promise<Array>}
   */
  static getScoresForMeeting(meetingId) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT ms.*, i.name as indicator_name, c.name as category_name
         FROM meeting_session_scores ms
         LEFT JOIN admin_rubric_indicators i ON i.id = ms.indicator_id
         LEFT JOIN admin_rubric_categories c ON c.id = i.admin_category_id
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
   * NOTE: participants.meeting_id is an INT FK to meetings.id — pass the
   * internal numeric id here, not the external_meeting_id string.
   * @param {number} meetingId - Internal meetings.id
   * @returns {Promise<Array>}
   */
  static getParticipantsForMeeting(meetingId) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT p.* FROM participants p
         WHERE p.meeting_id = ? AND p.deleted_at IS NULL ORDER BY p.join_time`,
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