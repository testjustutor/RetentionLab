/**
 * root/models/ParticipantModel.js
 */
const { db } = require('../../database/db');
const { logger } = require('../../utils/logger');

/**
 * Formats a JS Date as 'YYYY-MM-DD HH:MM:SS' using the LOCAL system
 * timezone (Date's getFullYear/getHours/etc, not the UTC getters) - NOT
 * `.toISOString()`, which is always UTC.
 *
 * FIX: joined_at/left_at were being written via `.toISOString()` while
 * created_at/updated_at use MySQL's own `CURRENT_TIMESTAMP`, which reflects
 * the DB server's LOCAL system time. On a server in IST (UTC+5:30) that
 * made joined_at/left_at sit exactly 5.5 hours BEHIND created_at/updated_at
 * on the very same row (e.g. joined_at "14:11:31" vs. created_at "19:41:31"
 * for the same real moment) - confusing to read directly and inconsistent
 * with every other timestamp column in this schema. This does not change
 * any duration math: durations are computed from real JS Date objects
 * (true instants), never from the stored string, so they were always
 * correct regardless of which format got written.
 */
function toMySQLLocalDateTime(date) {
  const d = date instanceof Date ? date : new Date(date);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
         `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/**
 * ParticipantModel - Manages participant attendance tracking
 * Handles join/leave/rejoin events and duration calculations
 */
class ParticipantModel {
  /**
   * Record a participant joining for the first time
   * Creates a new entry in participants table
   *
   * SCHEMA UPDATE: `participants` no longer has join_time/leave_time columns
   * at all (current table: id, meeting_id, session_id, participant_name,
   * participant_email, participant_role, deleted_at, created_at, updated_at).
   * The actual join timestamp lives exclusively in
   * participant_attendance_sessions.joined_at (see ensureAttendanceSession
   * below) — `participants` is now purely the identity/roster row for this
   * (meeting_id, session_id, participant_name), with created_at standing in
   * for "when this participant record first appeared" wherever that's
   * needed (see getMeetingParticipants/getMeetingAttendanceSummary).
   *
   * participantEmail/participantRole are optional — Google Meet's DOM-scraped
   * roster (services/platforms/google-meet/monitor.js) only ever surfaces a
   * display name today, so these stay null for that platform. They're
   * accepted here rather than hard-coded to null so a platform/integration
   * that DOES have this data (e.g. a calendar-invite match) can populate the
   * new columns without another schema-alignment pass.
   */
  static recordParticipantJoin(meetingId, sessionId, participantName, joinedAt = new Date(), participantEmail = null, participantRole = null) {
    return new Promise((resolve, reject) => {
      if (sessionId === undefined || sessionId === null) {
        return reject(new Error('sessionId is required to record participant join'));
      }

      const sql = `
        INSERT IGNORE INTO participants (
          meeting_id, session_id, participant_name, participant_email, participant_role,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `;

      const stmt = db.prepare(sql);
      stmt.run(
        meetingId,
        sessionId,
        participantName,
        participantEmail,
        participantRole,
        function(err) {
          stmt.finalize();
          if (err) {
            logger.error('Model(ParticipantModel): Error recording participant join:', err);
            reject(err);
          } else {
            db.get(
              `SELECT id FROM participants
               WHERE meeting_id = ?
                 AND session_id = ?
                 AND participant_name = ?
                 AND deleted_at IS NULL`,
              [meetingId, sessionId, participantName],
              async (fetchErr, existingRow) => {
                if (fetchErr) {
                  return reject(fetchErr);
                }

                const participantId = existingRow?.id || this.lastID;

                try {
                  await ParticipantModel.ensureAttendanceSession(
                      meetingId,
                      sessionId,
                      participantId,
                      1,
                      joinedAt
                    );
                } catch (trackingErr) {
                  logger.error('Model(ParticipantModel): Error recording participant session:', trackingErr);
                  return reject(trackingErr);
                }

                logger.info(`Model(ParticipantModel): Participant joined - ${participantName} (meeting: ${meetingId})`);
                resolve({
                  id: participantId,
                  meetingId,
                  sessionId,
                  participantName,
                  joinedAt: joinedAt.toISOString()
                });
              }
            );
          }
        }
      );
    });
  }

  /**
   * FIX: was `INSERT IGNORE` against the (participant_id, session_number)
   * unique key. `session_number` is always 1 here (recordParticipantJoin's
   * only caller), so this only collides when a row for this exact
   * participant_id + session_number=1 ALREADY exists — which happens when
   * `session_id` (meeting_sessions.id) gets reused across a bot
   * reconnect/relaunch for the same meeting (see FIX 3 note on
   * recordParticipantLeave) and the SAME participant identity (same
   * meeting_id/session_id/participant_name, hence same participant_id) shows
   * up again after the bot's in-memory tracker was reset by the restart, so
   * this genuinely is a fresh "first join" as far as THIS bot process is
   * concerned. `INSERT IGNORE` silently left the OLD row untouched in that
   * case — including its original `joined_at`, possibly hours old — so the
   * next leave computed duration against that stale timestamp instead of
   * the real one (seen in production as e.g. "duration: 19801s" on a
   * session only open a couple of seconds). Switched to an upsert that
   * resets joined_at/status/left_at/duration on conflict, so a genuine new
   * join always starts the row fresh regardless of what stale data was
   * sitting in it from an earlier, unrelated bot run.
   */
  static ensureAttendanceSession(meetingId, sessionId, participantId, sessionNumber, joinedAt = new Date()) {
    return new Promise((resolve, reject) => {
      const stmt = db.prepare(`
        INSERT INTO participant_attendance_sessions (
          meeting_id, session_id, participant_id, session_number, joined_at,
          attendance_status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON DUPLICATE KEY UPDATE
          joined_at = VALUES(joined_at),
          left_at = NULL,
          duration_seconds = NULL,
          attendance_status = 'active',
          deleted_at = NULL,
          updated_at = CURRENT_TIMESTAMP
      `);

      stmt.run(
        meetingId, sessionId, participantId, sessionNumber, toMySQLLocalDateTime(joinedAt),
        function(err) {
          stmt.finalize();
          if (err) return reject(err);

          // insertId can be 0 on a fresh insert under some MySQL configs and
          // is always 0 on the UPDATE branch of ON DUPLICATE KEY UPDATE -
          // don't trust lastID blindly, fetch the real row either way.
          if (this.lastID) {
            return resolve({ id: this.lastID, participantId, sessionNumber });
          }

          db.get(
            `SELECT id FROM participant_attendance_sessions
             WHERE participant_id = ? AND session_number = ? AND deleted_at IS NULL`,
            [participantId, sessionNumber],
            (fetchErr, row) => {
              if (fetchErr) return reject(fetchErr);
              resolve({ id: row?.id || null, participantId, sessionNumber });
            }
          );
        }
      );
    });
  }

  /**
   * Record a participant leaving mid-meeting (meeting keeps running for
   * everyone else who's still on the call).
   *
   * INTENTIONAL: this writes ONLY to participant_attendance_sessions (via
   * closeLatestAttendanceSession) — the `participants` row for this person is
   * NOT touched (no leave_time write, no UPDATE at all). `participants` is
   * the per-meeting identity/join record; `participant_attendance_sessions`
   * is the granular join/leave audit trail (one row per join/rejoin cycle),
   * and a mid-meeting leave is exactly that: an attendance-session event, not
   * a change to who the participant is or when they first joined. This also
   * keeps a participant who later rejoins from having a stale leave_time
   * sitting on their main record. (Previously this set participants.leave_time
   * too — removed per requirement: leave events update
   * participant_attendance_sessions only.)
   *
   * FIX 3: still takes sessionId and scopes the participant lookup by
   * (meeting_id, session_id, participant_name) instead of just
   * (meeting_id, participant_name). A meeting can have multiple sessions
   * (bot reconnect/relaunch — see botManager.js), and without session_id here
   * this could grab an older session's row for a participant name that
   * recurs across sessions.
   */
  static recordParticipantLeave(meetingId, sessionId, participantName, leftAt = new Date()) {
    return new Promise((resolve, reject) => {
      if (sessionId === undefined || sessionId === null) {
        return reject(new Error('sessionId is required to record participant leave'));
      }

      // Read-only lookup: only need to resolve participant_id here.
      // `participants` no longer has a join_time column (see SCHEMA UPDATE
      // note on recordParticipantJoin above) — the duration figure below
      // comes from closeLatestAttendanceSession, which computes it from
      // participant_attendance_sessions.joined_at instead. This SELECT never
      // becomes a write to `participants`.
      db.get(
        `SELECT id FROM participants
         WHERE meeting_id = ? AND session_id = ? AND participant_name = ? AND deleted_at IS NULL`,
        [meetingId, sessionId, participantName],
        (err, row) => {
          if (err) {
            logger.error('Model(ParticipantModel): Error fetching participant:', err);
            return reject(err);
          }

          if (!row) {
            logger.warn(`Model(ParticipantModel): Participant not found for leave - ${participantName} (meeting: ${meetingId}, session: ${sessionId})`);
            return resolve({ success: false, message: 'Participant not found' });
          }

          ParticipantModel.closeLatestAttendanceSession(row.id, leftAt)
            .then((closeResult) => {
              if (closeResult && closeResult.success === false) {
                logger.warn(
                  `Model(ParticipantModel): Leave not persisted for ${participantName} - ${closeResult.message}`
                );
                return resolve({ success: false, participantId: row.id, message: closeResult.message });
              }

              // duration comes from closeLatestAttendanceSession (computed
              // against attendance_sessions.joined_at, the only place a join
              // timestamp is stored now) — kept as `sessionDuration` on the
              // return value for compatibility with callers (e.g.
              // participantTracker.js) that read that field name.
              const sessionDuration = closeResult && closeResult.duration != null ? closeResult.duration : 0;

              logger.info(
                `Model(ParticipantModel): Participant left (mid-meeting) - ${participantName} (duration: ${sessionDuration}s) [participant_attendance_sessions updated only]`
              );

              resolve({
                success: true,
                participantId: row.id,
                sessionDuration,
                leftAt: leftAt.toISOString()
              });
            })
            .catch((trackingErr) => {
              logger.error('Model(ParticipantModel): Error closing participant session:', trackingErr);
              reject(trackingErr);
            });
        }
      );
    });
  }

  static closeLatestAttendanceSession(participantId, leftAt = new Date()) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT id, joined_at FROM participant_attendance_sessions
         WHERE participant_id = ? AND attendance_status = 'active' AND deleted_at IS NULL
         ORDER BY session_number DESC LIMIT 1`,
        [participantId],
        (err, row) => {
          if (err) {
            return reject(err);
          }

          if (!row) {
            return resolve({ success: false, message: 'No active attendance session' });
          }

          const duration = Math.floor((new Date(leftAt) - new Date(row.joined_at)) / 1000);
          db.run(
            `UPDATE participant_attendance_sessions
             SET left_at = ?,
                 duration_seconds = ?,
                 attendance_status = 'left',
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = ? AND deleted_at IS NULL`,
            [toMySQLLocalDateTime(leftAt), duration, row.id],
            function(updateErr) {
              if (updateErr) {
                reject(updateErr);
              } else {
                resolve({ success: true, sessionId: row.id, duration });
              }
            }
          );
        }
      );
    });
  }

  /**
   * Record a participant rejoining (after leaving)
   * Creates a new entry in participant_attendance_sessions table
   */
  static recordParticipantRejoin(meetingId, participantId, rejoinedAt = new Date()) {
    return new Promise((resolve, reject) => {
      // Get the participant to find highest session number
      db.get(
        `SELECT MAX(session_number) as max_session FROM participant_attendance_sessions 
         WHERE participant_id = ?`,
        [participantId],
        (err, sessionRow) => {
          if (err) {
            logger.error('Model(ParticipantModel): Error fetching session number:', err);
            return reject(err);
          }

          const nextSessionNumber = (sessionRow?.max_session || 0) + 1;

              // Get participant details for session tracking
              db.get(
            `SELECT meeting_id, session_id, participant_name FROM participants WHERE id = ?`,
            [participantId],
            (err, participantRow) => {
              if (err) {
                logger.error('Model(ParticipantModel): Error fetching participant:', err);
                return reject(err);
              }

              if (!participantRow) {
                return reject(new Error('Participant not found'));
              }

              const sql = `
                INSERT INTO participant_attendance_sessions (
                  meeting_id, session_id, participant_id, session_number, joined_at, 
                  attendance_status, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
              `;

              const stmt = db.prepare(sql);
              stmt.run(
                participantRow.meeting_id,
                participantRow.session_id,
                participantId,
                nextSessionNumber,
                toMySQLLocalDateTime(rejoinedAt),
                function(err) {
                  stmt.finalize();
                  if (err) {
                    logger.error('Model(ParticipantModel): Error recording rejoin:', err);
                    reject(err);
                  } else {
                    // Update main participant record status
                    db.run(
                      `UPDATE participants 
                       SET updated_at = CURRENT_TIMESTAMP 
                       WHERE id = ?`,
                      [participantId],
                      (updateErr) => {
                        if (updateErr) {
                          logger.error('Model(ParticipantModel): Error updating participant status:', updateErr);
                        }
                        Promise.resolve()
                          .then(() => {
                            logger.info(
                              `Model(ParticipantModel): Participant rejoined - session #${nextSessionNumber} (participant_id: ${participantId})`
                            );
                            resolve({
                              id: this.lastID,
                              participantId,
                              sessionNumber: nextSessionNumber,
                              rejoinedAt: rejoinedAt.toISOString()
                            });
                          })
                          .catch((sessionErr) => {
                            logger.error('Model(ParticipantModel): Error recording rejoin participant session:', sessionErr);
                            reject(sessionErr);
                          });
                      }
                    );
                  }
                }
              );
            }
          );
        }
      );
    });
  }

  /**
   * Record a participant leaving during a rejoin session (they left, came
   * back, and are now leaving again) — mid-meeting, same as
   * recordParticipantLeave.
   *
   * INTENTIONAL: writes ONLY to participant_attendance_sessions. Previously
   * this also ran a second, unrelated `UPDATE participants SET updated_at =
   * CURRENT_TIMESTAMP` after computing (and discarding — it was never used
   * or returned) a total-duration SUM across sessions. Removed: it didn't
   * set leave_time so it wasn't the bug, but it was still a write to
   * `participants` triggered by a leave event, and the requirement is that a
   * leave event updates participant_attendance_sessions only.
   */
  static recordRejoinLeave(sessionId, leftAt = new Date()) {
    return new Promise((resolve, reject) => {
      // Get current session to calculate duration
      db.get(
        `SELECT
           mpas.id,
           mpas.participant_id,
           mpas.joined_at,
           mp.meeting_id,
           mp.participant_name
         FROM participant_attendance_sessions mpas
         JOIN participants mp ON mp.id = mpas.participant_id
         WHERE mpas.id = ? AND mpas.deleted_at IS NULL`,
        [sessionId],
        (err, row) => {
          if (err) {
            logger.error('Model(ParticipantModel): Error fetching session:', err);
            return reject(err);
          }

          if (!row) {
            logger.warn(`Model(ParticipantModel): Session not found for leave - ${sessionId}`);
            return resolve({ success: false, message: 'Session not found' });
          }

          // Calculate session duration
          const joinTime = new Date(row.joined_at);
          const leaveTime = new Date(leftAt);
          const duration = Math.floor((leaveTime - joinTime) / 1000); // seconds

          // Update session record
          const updateSql = `
            UPDATE participant_attendance_sessions 
            SET left_at = ?, 
                duration_seconds = ?,
                attendance_status = 'left',
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND deleted_at IS NULL
          `;

          const stmt = db.prepare(updateSql);
          stmt.run(
            toMySQLLocalDateTime(leftAt),
            duration,
            sessionId,
            function(err) {
              stmt.finalize();
              if (err) {
                logger.error('Model(ParticipantModel): Error recording rejoin leave:', err);
                reject(err);
              } else {
                logger.info(
                  `Model(ParticipantModel): Rejoin session ended (mid-meeting) - session_id: ${sessionId} (duration: ${duration}s) [participant_attendance_sessions updated only]`
                );
                resolve({
                  success: true,
                  sessionId,
                  participantId: row.participant_id,
                  duration,
                  leftAt: leftAt.toISOString()
                });
              }
            }
          );
        }
      );
    });
  }

  /**
   * Get participant record by meeting_id and name
   */
  static getParticipant(meetingId, participantName) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT * FROM participants 
         WHERE meeting_id = ? AND participant_name = ? AND deleted_at IS NULL`,
        [meetingId, participantName],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
  }

  /**
   * Get all participants in a meeting
   */
  static getMeetingParticipants(meetingId) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM participants 
         WHERE meeting_id = ? AND deleted_at IS NULL 
         ORDER BY created_at ASC`,
        [meetingId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  }

  /**
   * Get attendance sessions for a participant
   */
  static getParticipantSessions(participantId) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM participant_attendance_sessions 
         WHERE participant_id = ? AND deleted_at IS NULL 
         ORDER BY session_number ASC`,
        [participantId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  }

  /**
   * Get attendance summary for a meeting
   */
  static getMeetingAttendanceSummary(meetingId) {
    return new Promise((resolve, reject) => {
      // SCHEMA UPDATE: `participants` has no join_time/leave_time columns at
      // all anymore, so both first_joined_at and last_left_at are derived
      // from participant_attendance_sessions instead:
      //   - first_joined_at = MIN(joined_at) across that participant's
      //     sessions (the very first join, i.e. session_number = 1's joined_at)
      //   - last_left_at    = MAX(left_at) across that participant's sessions
      // This is also more correct than the old behavior (reading
      // participants.join_time/leave_time), which never reflected a
      // rejoin's join/leave time and only ever showed the first session's.
      db.all(
        `SELECT
          mp.id,
          mp.participant_name,
          mp.participant_email,
          mp.participant_role,
          MIN(CASE WHEN mpas.deleted_at IS NULL THEN mpas.joined_at ELSE NULL END) as first_joined_at,
          MAX(CASE WHEN mpas.deleted_at IS NULL THEN mpas.left_at ELSE NULL END) as last_left_at,
          COALESCE(SUM(CASE WHEN mpas.deleted_at IS NULL THEN mpas.duration_seconds ELSE 0 END), 0) as total_duration_seconds,
          CASE WHEN MAX(CASE WHEN mpas.attendance_status = 'active' AND mpas.deleted_at IS NULL THEN 1 ELSE 0 END) = 1 THEN 'joined' ELSE 'left' END as participant_status,
          COUNT(mpas.id) as rejoin_count
         FROM participants mp
         LEFT JOIN participant_attendance_sessions mpas ON mp.id = mpas.participant_id AND mpas.deleted_at IS NULL
         WHERE mp.meeting_id = ? AND mp.deleted_at IS NULL
         GROUP BY mp.id
         ORDER BY first_joined_at ASC`,
        [meetingId],
        (err, rows) => {
          if (err) {
            logger.error('Model(ParticipantModel): Error fetching attendance summary:', err);
            reject(err);
          } else {
            resolve(rows || []);
          }
        }
      );
    });
  }

  /**
   * Soft delete a participant record
   */
  static deleteParticipant(participantId) {
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE participants SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [participantId],
        function(err) {
          if (err) {
            logger.error('Model(ParticipantModel): Error deleting participant:', err);
            reject(err);
          } else {
            logger.info(`Model(ParticipantModel): Participant soft-deleted - id: ${participantId}`);
            resolve({ success: true, participantId });
          }
        }
      );
    });
  }
}

module.exports = ParticipantModel;