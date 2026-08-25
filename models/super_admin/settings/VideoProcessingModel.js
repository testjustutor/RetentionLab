/**
 * models/super_admin/settings/VideoProcessingModel.js
 * DATA-ACCESS ONLY (SQL queries / DDL). No business logic here.
 *
 * The `video_processing` table is the identification journal for video->audio
 * work. For user/meeting/session it stores BOTH the id that came from the video
 * FILENAME (file_user_id / file_meeting_id / file_session_id) AND the REAL id
 * stored/used in the users/meetings/meeting_sessions tables
 * (user_id / meeting_id / session_id).
 */
const { db } = require('../../../database/db');

class VideoProcessingModel {
  static ensureTable() {
    return new Promise((resolve, reject) => {
      const sql = `
        CREATE TABLE IF NOT EXISTS video_processing (
            id INT AUTO_INCREMENT PRIMARY KEY,
            file_name VARCHAR(255) NOT NULL,
            status VARCHAR(50) NOT NULL DEFAULT 'pending',
            mp3_path VARCHAR(500) DEFAULT NULL,
            video_user_id INT DEFAULT NULL,
            video_meeting_type VARCHAR(50) DEFAULT NULL,
            video_meeting_id INT DEFAULT NULL,
            video_session_id INT DEFAULT NULL,
            file_user_id INT DEFAULT NULL,
            file_meeting_id INT DEFAULT NULL,
            file_session_id INT DEFAULT NULL,
            user_id INT DEFAULT NULL,
            first_name VARCHAR(100) DEFAULT NULL,
            last_name VARCHAR(100) DEFAULT NULL,
            meeting_type VARCHAR(50) DEFAULT NULL,
            meeting_id INT DEFAULT NULL,
            session_id INT DEFAULT NULL,
            external_meeting_id VARCHAR(150) DEFAULT NULL,
            title VARCHAR(255) DEFAULT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT NULL,
            INDEX idx_video_processing_file_name (file_name),
            INDEX idx_video_processing_status (status),
            INDEX idx_video_processing_user_id (user_id),
            INDEX idx_video_processing_meeting_id (meeting_id),
            INDEX idx_video_processing_session_id (session_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `;
      db.run(sql, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  }

  // ------------------------------------------------------------------
  // Processing record queries
  // ------------------------------------------------------------------
  static saveProcessingRecord(rec) {
    return new Promise((resolve, reject) => {
      const sql = `INSERT INTO video_processing
        (file_name, status, mp3_path,
         file_user_id, file_meeting_id, file_session_id,
         video_user_id, video_meeting_type, video_meeting_id, video_session_id,
         user_id, meeting_type, meeting_id, session_id,
         external_meeting_id, first_name, last_name, title,
         created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`;
      db.run(sql, [
        rec.fileName, rec.status, rec.mp3Path ?? null,
        rec.fileUserId ?? null, rec.fileMeetingId ?? null, rec.fileSessionId ?? null,
        rec.videoUserId ?? null, rec.videoMeetingType ?? null, rec.videoMeetingId ?? null, rec.videoSessionId ?? null,
        rec.userId ?? null, rec.meetingType ?? null, rec.meetingId ?? null, rec.sessionId ?? null,
        rec.externalMeetingId ?? null, rec.firstName ?? null, rec.lastName ?? null,
        rec.title ?? null
      ], function (err) {
        if (err) return reject(err);
        resolve({ id: this.lastID, changes: this.changes });
      });
    });
  }

  static updateProcessingRecord(id, rec) {
    return new Promise((resolve, reject) => {
      const sql = `UPDATE video_processing SET
        status = ?, mp3_path = ?,
        file_user_id = ?, file_meeting_id = ?, file_session_id = ?,
        video_user_id = ?, video_meeting_type = ?, video_meeting_id = ?, video_session_id = ?,
        user_id = ?, meeting_type = ?, meeting_id = ?, session_id = ?,
        external_meeting_id = ?, first_name = ?, last_name = ?, title = ?,
        updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`;
      db.run(sql, [
        rec.status, rec.mp3Path ?? null,
        rec.fileUserId ?? null, rec.fileMeetingId ?? null, rec.fileSessionId ?? null,
        rec.videoUserId ?? null, rec.videoMeetingType ?? null, rec.videoMeetingId ?? null, rec.videoSessionId ?? null,
        rec.userId ?? null, rec.meetingType ?? null, rec.meetingId ?? null, rec.sessionId ?? null,
        rec.externalMeetingId ?? null, rec.firstName ?? null, rec.lastName ?? null,
        rec.title ?? null, id
      ], function (err) { err ? reject(err) : resolve({ id, changes: this.changes }); });
    });
  }

  static getProcessingHistory() {
    return new Promise((resolve, reject) => {
      db.all(`SELECT id, file_name, status, mp3_path,
                     file_user_id, file_meeting_id, file_session_id,
                     video_user_id, video_meeting_type, video_meeting_id, video_session_id,
                     user_id, meeting_type, meeting_id, session_id,
                     external_meeting_id, first_name, last_name, title,
                     created_at, updated_at
              FROM video_processing ORDER BY created_at DESC`, (err, rows) => {
        if (err) return reject(err);
        resolve(rows || []);
      });
    });
  }

  static getLatestStatus(fileName) {
    return new Promise((resolve, reject) => {
      db.all(
        'SELECT status FROM video_processing WHERE file_name = ? ORDER BY created_at DESC, id DESC LIMIT 1',
        [fileName],
        (err, rows) => (err ? reject(err) : resolve(rows[0]?.status || null))
      );
    });
  }

  /** Find the newest active (non-failed) row already tied to the same REAL user+session. */
  static findDuplicateSession(userId, sessionId) {
    return new Promise((resolve, reject) => {
      if (userId == null || sessionId == null) return resolve(null);
      db.get(
        `SELECT id, file_name, status, meeting_id, session_id,
                user_id, file_user_id, first_name, last_name,
                external_meeting_id, title
         FROM video_processing
         WHERE user_id = ? AND session_id = ?
           AND status IN ('converting','converted','processing','processed')
         ORDER BY created_at DESC, id DESC LIMIT 1`,
        [userId, sessionId],
        (err, row) => (err ? reject(err) : resolve(row || null))
      );
    });
  }

      /** STEP 6: mark a recording as needing reprocessing (failed diarization). */
  static markNeedsReprocessing(fileName) {
    return new Promise((resolve, reject) => {
      db.run(
        "UPDATE video_processing SET status = 'needs_reprocessing', updated_at = CURRENT_TIMESTAMP WHERE file_name = ?",
        [fileName],
        function (err) { err ? reject(err) : resolve({ changes: this.changes }); }
      );
    });
  }

  static hasAuditResults(sessionId) {
    return new Promise((resolve, reject) => {
      if (sessionId === null || sessionId === undefined || sessionId === '') return resolve(false);
      db.get(
        'SELECT COUNT(*) AS c FROM ai_audit_results WHERE session_id = ?',
        [String(sessionId)],
        (err, row) => (err ? reject(err) : resolve(Number(row?.c) > 0))
      );
    });
  }

  // ------------------------------------------------------------------
  // User queries
  // ------------------------------------------------------------------
  static getUserById(id) {
    return new Promise((resolve, reject) => {
      db.get('SELECT id, company_id, role_id, first_name, last_name, email FROM users WHERE id = ? LIMIT 1',
        [id], (err, row) => (err ? reject(err) : resolve(row || null)));
    });
  }
  static getUserByEmail(email) {
    return new Promise((resolve, reject) => {
      db.get('SELECT id, company_id, role_id, first_name, last_name, email FROM users WHERE email = ? LIMIT 1',
        [email], (err, row) => (err ? reject(err) : resolve(row || null)));
    });
  }
  static getUserByName(firstName, lastName) {
    return new Promise((resolve, reject) => {
      db.get(`SELECT id, company_id, role_id, first_name, last_name, email
              FROM users
              WHERE LOWER(first_name) = LOWER(?) AND LOWER(last_name) = LOWER(?)
                AND role_id = (SELECT id FROM roles WHERE role_name = 'instructor' LIMIT 1)
              LIMIT 1`,
        [firstName, lastName], (err, row) => (err ? reject(err) : resolve(row || null)));
    });
  }
  static getInstructorRoleId() {
    return new Promise((resolve, reject) => {
      db.get("SELECT id FROM roles WHERE role_name = 'instructor' LIMIT 1",
        [], (err, row) => (err ? reject(err) : resolve(row ? row.id : null)));
    });
  }
  static insertInstructor(u) {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO users (user_uuid, role_id, first_name, last_name, email, password_hash, phone, status, is_active, email_verified, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'active', 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [u.userUuid, u.roleId, u.firstName, u.lastName, u.email, u.passwordHash, u.phone ?? null],
        function (err) { err ? reject(err) : resolve(this.lastID); }
      );
    });
  }

  // ------------------------------------------------------------------
  // Calendar provider queries
  // ------------------------------------------------------------------
  static getProviderByName(name) {
    return new Promise((resolve, reject) => {
      db.get('SELECT id FROM calendar_providers WHERE name = ? LIMIT 1',
        [name], (err, row) => (err ? reject(err) : resolve(row || null)));
    });
  }
  static findConnection(userId, providerId) {
    return new Promise((resolve, reject) => {
      db.get('SELECT id FROM calendar_connections WHERE user_id = ? AND provider_id = ? LIMIT 1',
        [userId, providerId], (err, row) => (err ? reject(err) : resolve(row || null)));
    });
  }
  static insertConnection({ userId, providerId, accessToken, refreshToken }) {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO calendar_connections (user_id, provider_id, access_token, refresh_token, token_expires_at, connection_status, created_at, updated_at)
         VALUES (?, ?, ?, ?, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 30 DAY), 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [userId, providerId, accessToken, refreshToken],
        function (err) { err ? reject(err) : resolve(this.lastID); }
      );
    });
  }
  // ------------------------------------------------------------------
  // Meeting queries
  // ------------------------------------------------------------------
  static getMeetingByExternalId(externalMeetingId) {
    return new Promise((resolve, reject) => {
      db.get('SELECT id, external_meeting_id FROM meetings WHERE external_meeting_id = ? ORDER BY id DESC LIMIT 1',
        [externalMeetingId], (err, row) => (err ? reject(err) : resolve(row || null)));
    });
  }
  static findMeetingByExternalAndCreator(externalMeetingId, title, createdBy) {
    return new Promise((resolve, reject) => {
      db.get('SELECT id, external_meeting_id FROM meetings WHERE external_meeting_id = ? AND title = ? AND created_by = ? LIMIT 1',
        [externalMeetingId, title, createdBy], (err, row) => (err ? reject(err) : resolve(row || null)));
    });
  }
  static insertMeeting(m) {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO meetings (external_meeting_id, title, description, scheduled_start_time, scheduled_end_time, platform, calendar_account, meeting_link, passcode, event_id, timezone, status, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [m.externalMeetingId, m.title, m.description, m.start, m.end, m.platform, m.calendarAccount,
         m.meetingLink ?? null, m.passcode ?? null, m.eventId, m.timezone, m.status, m.createdBy],
        function (err) { err ? reject(err) : resolve(this.lastID); }
      );
    });
  }

  // ------------------------------------------------------------------
  // Session queries
  // ------------------------------------------------------------------
  static findSessionByMeetingTime(meetingId, start, end) {
    return new Promise((resolve, reject) => {
      db.get('SELECT id FROM meeting_sessions WHERE meeting_id = ? AND start_time = ? AND end_time = ? ORDER BY id DESC LIMIT 1',
        [meetingId, start, end], (err, row) => (err ? reject(err) : resolve(row || null)));
    });
  }
  static findSessionByMeetingStartLike(meetingId, startLike) {
    return new Promise((resolve, reject) => {
      db.get('SELECT id FROM meeting_sessions WHERE meeting_id = ? AND start_time LIKE ? ORDER BY id DESC LIMIT 1',
        [meetingId, startLike], (err, row) => (err ? reject(err) : resolve(row ? Number(row.id) : null)));
    });
  }
  static insertSession(meetingId, start, end) {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO meeting_sessions (meeting_id, start_time, end_time, status, created_at, updated_at)
         VALUES (?, ?, ?, 'completed', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [meetingId, start, end],
        function (err) { err ? reject(err) : resolve(this.lastID); }
      );
    });
  }
  static getSessionById(id) {
    return new Promise((resolve, reject) => {
      db.get('SELECT id, meeting_id FROM meeting_sessions WHERE id = ?', [id],
        (err, row) => (err ? reject(err) : resolve(row || null)));
    });
  }

  // ------------------------------------------------------------------
  // Asset / session-file queries (video->audio side effects)
  // ------------------------------------------------------------------
  static updateSessionFileNames(sessionId, mp3Name, transcriptName) {
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE meeting_sessions SET audio_file_name = ?, transcript_file_name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [mp3Name, transcriptName, sessionId],
        function (err) { err ? reject(err) : resolve(); }
      );
    });
  }
  static insertMeetingAsset(a) {
    return new Promise((resolve, reject) => {
      const sql = `INSERT INTO meeting_assets
        (meeting_id, session_id, audio_path, transcript_path, video_path, status, processed_at)
        VALUES (?, ?, ?, ?, ?, 'Conversion', CURRENT_TIMESTAMP)
        ON DUPLICATE KEY UPDATE
          audio_path = VALUES(audio_path),
          transcript_path = VALUES(transcript_path),
          video_path = VALUES(video_path),
          status = 'Conversion',
          processed_at = CURRENT_TIMESTAMP`;
      db.run(sql, [String(a.meetingId), String(a.sessionId), a.mp3Name, a.transcriptName, a.videoPath],
        function (err) { err ? reject(err) : resolve(); });
    });
  }

}
module.exports = VideoProcessingModel;
