/**
 * root/models/meetings/assets/meetingAssetModel.js
 * Meeting Asset Model — all meeting_assets database queries live here.
 *
 * NOTE: Columns come from migration 031 (meeting_assets): id, meeting_id,
 * session_id, audio_path, transcript_path, summary_path, video_path, oqi_score,
 * audit_summary, audit_completed_at, status, processed_at, created_at, updated_at.
 * The row is uniquely identified by (meeting_id, session_id).
 */
const { db } = require('../../../database/db');
const { logger } = require('../../../utils/logger');

class MeetingAssetModel {
  /**
   * Step 1: Initialize/mark a meeting asset row as 'Conversion' and store the
   * audio + transcript paths. Upserts on the unique (meeting_id, session_id).
   * @param {string} meetingId - meeting_assets.meeting_id
   * @param {string} sessionId - meeting_assets.session_id
   * @param {string} audioPath - meeting_assets.audio_path
   * @param {string} transcriptPath - meeting_assets.transcript_path
   * @returns {Promise<Object>}
   */
  static initializeAssets(meetingId, sessionId, audioPath, transcriptPath) {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO meeting_assets (
            meeting_id,
            session_id,
            audio_path,
            transcript_path,
            status,
            processed_at
        )
        VALUES (?, ?, ?, ?, 'Conversion', CURRENT_TIMESTAMP)
        ON DUPLICATE KEY UPDATE
            audio_path = VALUES(audio_path),
            transcript_path = VALUES(transcript_path),
            status = 'Conversion',
            processed_at = CURRENT_TIMESTAMP
      `;

      db.run(
        sql,
        [meetingId, sessionId, audioPath, transcriptPath],
        function (err) {
          if (err) {
            logger.error(`[MeetingAssetModel] Init Error: ${err.message}`);
            return reject(err);
          }
          logger.info(
            `[MeetingAssetModel] Step 1 Started: Conversion for meeting ${meetingId} session ${sessionId}`
          );
          resolve({ meetingId, sessionId, status: 'Conversion' });
        }
      );
    });
  }

  /**
   * Update existing columns of a specific session row within meeting_assets.
   * Only columns present in the table (migration 031) are writable; any
   * unknown keys in `data` are ignored so legacy callers can't break the query.
   * @param {string} meetingId - meeting_assets.meeting_id
   * @param {string} sessionId - meeting_assets.session_id
   * @param {Object} data - column => value map
   * @returns {Promise<Object>}
   */
  static updateAssets(meetingId, sessionId, data) {
    return new Promise((resolve, reject) => {
      const validColumns = [
        'audio_path', 'transcript_path', 'summary_path', 'video_path',
        'oqi_score', 'audit_summary', 'audit_completed_at', 'status'
      ];
      const keys = Object.keys(data).filter((k) => validColumns.includes(k));

      if (keys.length === 0) {
        logger.warn(`[MeetingAssetModel] updateAssets: no valid writable columns for meeting ${meetingId} session ${sessionId}`);
        return resolve({ meetingId, sessionId, status: 'no_op' });
      }

      const setClause = keys.map((k) => `${k} = ?`).join(', ');
      const params = keys.map((k) => data[k]);
      params.push(meetingId, sessionId);

      const sql = `
        UPDATE meeting_assets
        SET ${setClause}, processed_at = CURRENT_TIMESTAMP
        WHERE meeting_id = ? AND session_id = ?
      `;

      db.run(sql, params, function (err) {
        if (err) {
          logger.error(`[MeetingAssetModel] Update Error: ${err.message}`);
          return reject(err);
        }
        logger.info(`[MeetingAssetModel] Assets updated for meeting ${meetingId} session ${sessionId}`);
        resolve({ meetingId, sessionId, status: 'updated', changes: this.changes });
      });
    });
  }
/**
   * Look up a meeting's internal id by its external_meeting_id.
   * Used by the Python Bridge to resolve meetingId for the asset DB-sync.
   */
  static getMeetingByExternalId(externalMeetingId) {
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT id, external_meeting_id FROM meetings WHERE external_meeting_id = ? ORDER BY id DESC LIMIT 1',
        [externalMeetingId],
        (err, row) => (err ? reject(err) : resolve(row || null))
      );
    });
  }

  /**
   * Look up a meeting's internal id (meetings.id) from a session id.
   * meeting_sessions.meeting_id references meetings.id (the internal ID), so this
   * is the authoritative source for resolving meetingId from a known sessionId —
   * the meeting id is read from the DB, never fabricated by engine/bridge code.
   * @param {number} sessionId - meeting_sessions.id
   * @returns {Promise<{meeting_id: number}|null>}
   */
  static getMeetingIdBySessionId(sessionId) {
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT meeting_id FROM meeting_sessions WHERE id = ? LIMIT 1',
        [sessionId],
        (err, row) => (err ? reject(err) : resolve(row || null))
      );
    });
  }
}

module.exports = MeetingAssetModel;
