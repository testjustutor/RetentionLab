/**
 * models/super_admin/settings/VideoProcessingModel.js
 * DATA-ACCESS ONLY (SQL queries / DDL). No business logic here.
 *
 * The `video_processing` table is the identification journal for video->audio
 * work. It stores BOTH the id family parsed straight out of the video
 * FILENAME (video_user_id / video_session_id / video_meeting_type) AND the
 * REAL id stored/used in the users/meetings/meeting_sessions tables
 * (user_id / meeting_id / session_id) once that filename-parsed id has been
 * matched/resolved against them.
 *
 * THREE unique keys (see migrations/060_create_video_processing_table.js):
 * file_name, (user_id, meeting_id, session_id), and (video_user_id,
 * video_session_id). Together they guarantee one row per file AND one row
 * per real session AND one row per raw filename-embedded id pair, so two
 * different video files can never be silently conflated into the same
 * tracking row unless they really do refer to the exact same session.
 * saveProcessingRecord() upserts that single row as a file moves through its
 * lifecycle instead of inserting a new row per status change.
 */
const { db } = require('../../../database/db');
const { normalizeStorageRef } = require('../../../utils/storagePaths');
const { logger } = require('../../../utils/logger');

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
            video_session_id INT DEFAULT NULL,
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
            UNIQUE KEY uniq_video_processing_file_name (file_name),
            UNIQUE KEY uniq_video_processing_user_meeting_session (user_id, meeting_id, session_id),
            UNIQUE KEY uniq_video_processing_video_user_meeting_session (video_user_id, video_session_id),
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
  /**
   * Upsert the SINGLE tracking row for this file/session. The table has
   * THREE unique keys (see migrations/060_create_video_processing_table.js):
   * file_name, (user_id, meeting_id, session_id), and (video_user_id,
   * video_session_id) - so this can land on an existing row via any of the
   * three (e.g. a different file_name resolving to the same real session
   * hits the id-pair key, not the file_name key). Because of that, file_name
   * is ALSO part of the UPDATE so the row always reflects the file that
   * triggered this call, not a stale name from whichever row it merged
   * into. A row is created once and then updated in place as it moves
   * through its lifecycle (converting -> converted -> processing ->
   * processed/failed), instead of a new row being inserted per status
   * change. status/mp3_path/file_name always take the new value; the other
   * id/name fields (video_user_id/video_session_id/video_meeting_type,
   * user_id/meeting_id/session_id, external_meeting_id/first_name/
   * last_name/title) only overwrite an existing value when the new one is
   * non-null, so a later call that doesn't carry a resolved id never blanks
   * out one already known.
   *
   * NOTE: MySQL unique keys never conflict on NULL (each NULL is distinct),
   * so the id-pair keys only start enforcing uniqueness once all of their
   * columns are resolved/non-null for a row.
   */
  static saveProcessingRecord(rec) {
    return new Promise((resolve, reject) => {
      const sql = `INSERT INTO video_processing
        (file_name, status, mp3_path,
         video_user_id, video_meeting_type, video_session_id,
         user_id, meeting_type, meeting_id, session_id,
         external_meeting_id, first_name, last_name, title,
         created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON DUPLICATE KEY UPDATE
          file_name = VALUES(file_name),
          status = VALUES(status),
          mp3_path = VALUES(mp3_path),
          video_user_id = COALESCE(VALUES(video_user_id), video_user_id),
          video_meeting_type = COALESCE(VALUES(video_meeting_type), video_meeting_type),
          video_session_id = COALESCE(VALUES(video_session_id), video_session_id),
          user_id = COALESCE(VALUES(user_id), user_id),
          meeting_type = COALESCE(VALUES(meeting_type), meeting_type),
          meeting_id = COALESCE(VALUES(meeting_id), meeting_id),
          session_id = COALESCE(VALUES(session_id), session_id),
          external_meeting_id = COALESCE(VALUES(external_meeting_id), external_meeting_id),
          first_name = COALESCE(VALUES(first_name), first_name),
          last_name = COALESCE(VALUES(last_name), last_name),
          title = COALESCE(VALUES(title), title),
          updated_at = CURRENT_TIMESTAMP`;
      db.run(sql, [
        rec.fileName, rec.status, rec.mp3Path ?? null,
        rec.videoUserId ?? null, rec.videoMeetingType ?? null, rec.videoSessionId ?? null,
        rec.userId ?? null, rec.meetingType ?? null, rec.meetingId ?? null, rec.sessionId ?? null,
        rec.externalMeetingId ?? null, rec.firstName ?? null, rec.lastName ?? null,
        rec.title ?? null
      ], function (err) {
        if (err) {
          logger.error(`[VideoProcessingModel] video_processing UPSERT FAILED file_name=${rec.fileName} status=${rec.status} meeting_id=${rec.meetingId ?? 'null'} session_id=${rec.sessionId ?? 'null'} -> ${err.message}`);
          return reject(err);
        }
        // mysql2: affectedRows is 1 for a fresh INSERT, 2 for a row that hit
        // ON DUPLICATE KEY UPDATE and actually changed, 0 if it matched but
        // nothing changed. this.lastID is only meaningful on a fresh insert.
        logger.info(`[VideoProcessingModel] video_processing UPSERT file_name=${rec.fileName} status=${rec.status} meeting_id=${rec.meetingId ?? 'null'} session_id=${rec.sessionId ?? 'null'} affected=${this.changes}`);
        resolve({ id: this.lastID, changes: this.changes });
      });
    });
  }

  static updateProcessingRecord(id, rec) {
    return new Promise((resolve, reject) => {
      const sql = `UPDATE video_processing SET
        status = ?, mp3_path = ?,
        video_user_id = ?, video_meeting_type = ?, video_session_id = ?,
        user_id = ?, meeting_type = ?, meeting_id = ?, session_id = ?,
        external_meeting_id = ?, first_name = ?, last_name = ?, title = ?,
        updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`;
      db.run(sql, [
        rec.status, rec.mp3Path ?? null,
        rec.videoUserId ?? null, rec.videoMeetingType ?? null, rec.videoSessionId ?? null,
        rec.userId ?? null, rec.meetingType ?? null, rec.meetingId ?? null, rec.sessionId ?? null,
        rec.externalMeetingId ?? null, rec.firstName ?? null, rec.lastName ?? null,
        rec.title ?? null, id
      ], function (err) {
        if (err) {
          logger.error(`[VideoProcessingModel] video_processing UPDATE FAILED id=${id} status=${rec.status} -> ${err.message}`);
          return reject(err);
        }
        logger.info(`[VideoProcessingModel] video_processing UPDATE id=${id} status=${rec.status} rows_changed=${this.changes}`);
        resolve({ id, changes: this.changes });
      });
    });
  }

  static getProcessingHistory() {
    return new Promise((resolve, reject) => {
      db.all(`SELECT id, file_name, status, mp3_path,
                     video_user_id, video_meeting_type, video_session_id,
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

  /** One query for many files: file_name -> newest status. */
  static getLatestStatuses(fileNames) {
    return new Promise((resolve, reject) => {
      if (!fileNames || !fileNames.length) return resolve({});
      const marks = fileNames.map(() => '?').join(',');
      db.all(
        `SELECT file_name, status
         FROM video_processing
         WHERE file_name IN (${marks})
         ORDER BY created_at DESC, id DESC`,
        fileNames,
        (err, rows) => {
          if (err) return reject(err);
          const map = {};
          (rows || []).forEach(r => { if (r.file_name && map[r.file_name] === undefined) map[r.file_name] = r.status; });
          resolve(map);
        }
      );
    });
  }

  /**
   * Persisted video -> real-id mapping for a single file, read from the
   * identification journal instead of re-deriving it from the filename via
   * meetings/meeting_sessions lookups every time. Used by
   * videoProcessingController.js::resolveVideoIds() as a fast-path cache
   * before falling back to live resolution.
   */
  static getMappingByFileName(fileName) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT meeting_id, session_id FROM video_processing
         WHERE file_name = ? AND meeting_id IS NOT NULL AND session_id IS NOT NULL
         ORDER BY created_at DESC, id DESC LIMIT 1`,
        [fileName],
        (err, row) => (err ? reject(err) : resolve(row ? { meetingId: row.meeting_id, sessionId: row.session_id } : null))
      );
    });
  }

  /** One query for many files: file_name -> { meetingId, sessionId } (only files with a known mapping). */
  static getMappingsByFileNames(fileNames) {
    return new Promise((resolve, reject) => {
      if (!fileNames || !fileNames.length) return resolve({});
      const marks = fileNames.map(() => '?').join(',');
      db.all(
        `SELECT file_name, meeting_id, session_id
         FROM video_processing
         WHERE file_name IN (${marks}) AND meeting_id IS NOT NULL AND session_id IS NOT NULL
         ORDER BY created_at DESC, id DESC`,
        fileNames,
        (err, rows) => {
          if (err) return reject(err);
          const map = {};
          (rows || []).forEach(r => {
            if (r.file_name && map[r.file_name] === undefined) {
              map[r.file_name] = { meetingId: r.meeting_id, sessionId: r.session_id };
            }
          });
          resolve(map);
        }
      );
    });
  }

  /**
   * Backfill a newly-resolved meeting/session mapping into any existing
   * video_processing row(s) for this file that don't have it yet, so the
   * table stays the durable video -> (normal pipeline) id mapping. Never
   * overwrites an id that is already set.
   */
  static backfillMapping(fileName, meetingId, sessionId) {
    return new Promise((resolve, reject) => {
      if (meetingId == null || sessionId == null) return resolve({ changes: 0 });
      db.run(
        `UPDATE video_processing SET meeting_id = ?, session_id = ?, updated_at = CURRENT_TIMESTAMP
         WHERE file_name = ? AND (meeting_id IS NULL OR session_id IS NULL)`,
        [meetingId, sessionId, fileName],
        function (err) {
          if (err) {
            logger.error(`[VideoProcessingModel] video_processing BACKFILL MAPPING FAILED file_name=${fileName} -> ${err.message}`);
            return reject(err);
          }
          if (this.changes) {
            logger.info(`[VideoProcessingModel] video_processing BACKFILL MAPPING file_name=${fileName} meeting_id=${meetingId} session_id=${sessionId} rows_changed=${this.changes}`);
          }
          resolve({ id: fileName, changes: this.changes });
        }
      );
    });
  }

  /**
   * Persisted video -> real-id mapping for the RAW filename-embedded id pair
   * (video_user_id, video_session_id) - backed by the
   * uniq_video_processing_video_user_meeting_session unique key. Unlike
   * getMappingByFileName (keyed on the literal file_name string), this is
   * keyed on the parsed ids, so it also catches a renamed/re-uploaded copy
   * of a file already resolved once. This is what keeps two different
   * recordings whose filenames happen to parse to the exact same date/time
   * (only their embedded session number differs) from resolving to the
   * same real session on a second lookup.
   */
  static getMappingByVideoIds(videoUserId, videoSessionId) {
    return new Promise((resolve, reject) => {
      if (videoUserId == null || videoSessionId == null) return resolve(null);
      db.get(
        `SELECT meeting_id, session_id FROM video_processing
         WHERE video_user_id = ? AND video_session_id = ?
           AND meeting_id IS NOT NULL AND session_id IS NOT NULL
         ORDER BY created_at DESC, id DESC LIMIT 1`,
        [videoUserId, videoSessionId],
        (err, row) => (err ? reject(err) : resolve(row ? { meetingId: row.meeting_id, sessionId: row.session_id } : null))
      );
    });
  }

  /**
   * Whichever raw (video_user_id, video_session_id) pair a REAL session is
   * already tracked under, if any. Used to detect when a time-matched
   * session is already "claimed" by a DIFFERENT raw recording (two admin-
   * named files that happen to compute the identical date/time but carry
   * different embedded session numbers), so it isn't silently reused/shown
   * for this one too.
   */
  static getClaimantForSession(meetingId, sessionId) {
    return new Promise((resolve, reject) => {
      if (meetingId == null || sessionId == null) return resolve(null);
      db.get(
        `SELECT video_user_id, video_session_id FROM video_processing
         WHERE meeting_id = ? AND session_id = ?
           AND video_user_id IS NOT NULL AND video_session_id IS NOT NULL
         ORDER BY created_at DESC, id DESC LIMIT 1`,
        [meetingId, sessionId],
        (err, row) => (err ? reject(err) : resolve(row ? { videoUserId: row.video_user_id, videoSessionId: row.video_session_id } : null))
      );
    });
  }

  /** Find the newest active (non-failed) row already tied to the same REAL user+session. */
  static findDuplicateSession(userId, sessionId) {
    return new Promise((resolve, reject) => {
      if (userId == null || sessionId == null) return resolve(null);
      db.get(
        `SELECT id, file_name, status, meeting_id, session_id,
                user_id, first_name, last_name,
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
        function (err) {
          if (err) {
            logger.error(`[VideoProcessingModel] video_processing UPDATE (needs_reprocessing) FAILED file_name=${fileName} -> ${err.message}`);
            return reject(err);
          }
          logger.info(`[VideoProcessingModel] video_processing UPDATE (needs_reprocessing) file_name=${fileName} rows_changed=${this.changes}`);
          resolve({ changes: this.changes });
        }
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

  /** One query for many session ids: session_id -> boolean (has audit rows). */
  static hasAuditResultsBatch(sessionIds) {
    return new Promise((resolve, reject) => {
      const clean = (sessionIds || []).filter(s => s !== null && s !== undefined && s !== '');
      if (!clean.length) return resolve({});
      const marks = clean.map(() => '?').join(',');
      db.all(
        `SELECT session_id, COUNT(*) AS c
         FROM ai_audit_results
         WHERE session_id IN (${marks})
         GROUP BY session_id`,
        clean.map(String),
        (err, rows) => {
          if (err) return reject(err);
          const map = {};
          (rows || []).forEach(r => { if (r.session_id !== null && r.session_id !== undefined) map[String(r.session_id)] = Number(r.c) > 0; });
          resolve(map);
        }
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
  /** Look up a meeting by its REAL primary key (not external_meeting_id). */
  static getMeetingById(id) {
    return new Promise((resolve, reject) => {
      db.get('SELECT id, external_meeting_id, title, created_by FROM meetings WHERE id = ? LIMIT 1',
        [id], (err, row) => (err ? reject(err) : resolve(row || null)));
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
        [normalizeStorageRef('audio', mp3Name), normalizeStorageRef('transcript', transcriptName), sessionId],
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
      db.run(sql, [String(a.meetingId), String(a.sessionId),
          normalizeStorageRef('audio', a.mp3Name),
          normalizeStorageRef('transcript', a.transcriptName),
          normalizeStorageRef('video', a.videoPath)],
        function (err) { err ? reject(err) : resolve(); });
    });
  }

}
module.exports = VideoProcessingModel;
