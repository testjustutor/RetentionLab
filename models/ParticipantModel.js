const { db } = require('../database/db');
const { logger } = require('../utils/logger');
const MeetingParticipantSessionModel = require('./MeetingParticipantSessionModel');

/**
 * ParticipantModel - Manages participant attendance tracking
 * Handles join/leave/rejoin events and duration calculations
 */
class ParticipantModel {
  /**
   * Record a participant joining for the first time
   * Creates a new entry in meeting_participants table
   */
  static recordParticipantJoin(meetingId, sessionId, participantName, joinedAt = new Date()) {
    return new Promise((resolve, reject) => {
      if (sessionId === undefined || sessionId === null) {
        return reject(new Error('sessionId is required to record participant join'));
      }

      const sql = `
        INSERT OR IGNORE INTO meeting_participants (
          meeting_id, session_id, participant_name, first_joined_at, 
          participant_status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, 'joined', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `;

      const stmt = db.prepare(sql);
      stmt.run(
        meetingId,
        sessionId,
        participantName,
        joinedAt.toISOString(),
        function(err) {
          stmt.finalize();
          if (err) {
            logger.error('Model(ParticipantModel): Error recording participant join:', err);
            reject(err);
          } else {
            db.get(
              `SELECT id FROM meeting_participants
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
                    participantId,
                    1,
                    joinedAt
                  );

                  await MeetingParticipantSessionModel.recordParticipantJoin(
                    meetingId,
                    sessionId,
                    participantName,
                    0
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
                  firstJoinedAt: joinedAt.toISOString()
                });
              }
            );
          }
        }
      );
    });
  }

  static ensureAttendanceSession(meetingId, participantId, sessionNumber, joinedAt = new Date()) {
    return new Promise((resolve, reject) => {
      const stmt = db.prepare(`
        INSERT OR IGNORE INTO meeting_participant_attendance_sessions (
          meeting_id, participant_id, session_number, joined_at,
          attendance_status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `);

      stmt.run(
        meetingId,
        participantId,
        sessionNumber,
        joinedAt.toISOString(),
        function(err) {
          stmt.finalize();
          if (err) {
            reject(err);
          } else {
            resolve({ id: this.lastID, participantId, sessionNumber });
          }
        }
      );
    });
  }

  /**
   * Record a participant leaving
   * Updates the main participants table with last_left_at and duration
   */
  static recordParticipantLeave(meetingId, participantName, leftAt = new Date()) {
    return new Promise((resolve, reject) => {
      // Get current participant record to calculate duration
      db.get(
        `SELECT id, first_joined_at, total_duration_seconds FROM meeting_participants 
         WHERE meeting_id = ? AND participant_name = ? AND deleted_at IS NULL`,
        [meetingId, participantName],
        (err, row) => {
          if (err) {
            logger.error('Model(ParticipantModel): Error fetching participant:', err);
            return reject(err);
          }

          if (!row) {
            logger.warn(`Model(ParticipantModel): Participant not found for leave - ${participantName} (meeting: ${meetingId})`);
            return resolve({ success: false, message: 'Participant not found' });
          }

          // Calculate session duration
          const joinTime = new Date(row.first_joined_at);
          const leaveTime = new Date(leftAt);
          const sessionDuration = Math.floor((leaveTime - joinTime) / 1000); // seconds
          const totalDuration = (row.total_duration_seconds || 0) + sessionDuration;

          // Update participant record
          const updateSql = `
            UPDATE meeting_participants 
            SET last_left_at = ?, 
                total_duration_seconds = ?,
                participant_status = 'left',
                updated_at = CURRENT_TIMESTAMP
            WHERE meeting_id = ? AND participant_name = ? AND deleted_at IS NULL
          `;

          const stmt = db.prepare(updateSql);
          stmt.run(
            leftAt.toISOString(),
            totalDuration,
            meetingId,
            participantName,
            function(err) {
              stmt.finalize();
              if (err) {
                logger.error('Model(ParticipantModel): Error recording participant leave:', err);
                reject(err);
              } else {
                ParticipantModel.closeLatestAttendanceSession(row.id, leftAt)
                  .then(() => MeetingParticipantSessionModel.recordParticipantLeave(meetingId, participantName))
                  .then(() => {
                    logger.info(
                      `Model(ParticipantModel): Participant left - ${participantName} (duration: ${sessionDuration}s, total: ${totalDuration}s)`
                    );

                    resolve({
                      success: true,
                      participantId: row.id,
                      sessionDuration,
                      totalDuration,
                      leftAt: leftAt.toISOString()
                    });
                  })
                  .catch((trackingErr) => {
                    logger.error('Model(ParticipantModel): Error closing participant session:', trackingErr);
                    reject(trackingErr);
                  }
                );
              }
            }
          );
        }
      );
    });
  }

  static closeLatestAttendanceSession(participantId, leftAt = new Date()) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT id, joined_at FROM meeting_participant_attendance_sessions
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
            `UPDATE meeting_participant_attendance_sessions
             SET left_at = ?,
                 duration_seconds = ?,
                 attendance_status = 'left',
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = ? AND deleted_at IS NULL`,
            [leftAt.toISOString(), duration, row.id],
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
   * Creates a new entry in meeting_participant_attendance_sessions table
   */
  static recordParticipantRejoin(meetingId, participantId, rejoinedAt = new Date()) {
    return new Promise((resolve, reject) => {
      // Get the participant to find highest session number
      db.get(
        `SELECT MAX(session_number) as max_session FROM meeting_participant_attendance_sessions 
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
            `SELECT meeting_id, session_id, participant_name FROM meeting_participants WHERE id = ?`,
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
                INSERT INTO meeting_participant_attendance_sessions (
                  meeting_id, participant_id, session_number, joined_at, 
                  attendance_status, created_at, updated_at
                ) VALUES (?, ?, ?, ?, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
              `;

              const stmt = db.prepare(sql);
              stmt.run(
                participantRow.meeting_id,
                participantId,
                nextSessionNumber,
                rejoinedAt.toISOString(),
                function(err) {
                  stmt.finalize();
                  if (err) {
                    logger.error('Model(ParticipantModel): Error recording rejoin:', err);
                    reject(err);
                  } else {
                    // Update main participant record status
                    db.run(
                      `UPDATE meeting_participants 
                       SET participant_status = 'joined', updated_at = CURRENT_TIMESTAMP 
                       WHERE id = ?`,
                      [participantId],
                      (updateErr) => {
                        if (updateErr) {
                          logger.error('Model(ParticipantModel): Error updating participant status:', updateErr);
                        }
                        MeetingParticipantSessionModel.recordParticipantJoin(
                          participantRow.meeting_id,
                          participantRow.session_id,
                          participantRow.participant_name,
                          0
                        )
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
   * Record a participant leaving during a rejoin session
   * Updates the attendance_sessions table with left_at and duration
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
         FROM meeting_participant_attendance_sessions mpas
         JOIN meeting_participants mp ON mp.id = mpas.participant_id
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
            UPDATE meeting_participant_attendance_sessions 
            SET left_at = ?, 
                duration_seconds = ?,
                attendance_status = 'left',
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND deleted_at IS NULL
          `;

          const stmt = db.prepare(updateSql);
          stmt.run(
            leftAt.toISOString(),
            duration,
            sessionId,
            function(err) {
              stmt.finalize();
              if (err) {
                logger.error('Model(ParticipantModel): Error recording rejoin leave:', err);
                reject(err);
              } else {
                // Update total duration in main participant record
                db.get(
                  `SELECT SUM(duration_seconds) as total FROM meeting_participant_attendance_sessions 
                   WHERE participant_id = ? AND deleted_at IS NULL AND attendance_status = 'left'`,
                  [row.participant_id],
                  (sumErr, sumRow) => {
                    if (!sumErr && sumRow) {
                      const totalSessionsDuration = sumRow.total || 0;
                      db.run(
                        `UPDATE meeting_participants 
                         SET total_duration_seconds = total_duration_seconds + ?
                         WHERE id = ?`,
                        [duration, row.participant_id],
                        (updateErr) => {
                          if (updateErr) {
                            logger.error('Model(ParticipantModel): Error updating total duration:', updateErr);
                          }
                        }
                      );
                    }

                    MeetingParticipantSessionModel.recordParticipantLeave(row.meeting_id, row.participant_name)
                      .then(() => {
                        logger.info(
                          `Model(ParticipantModel): Rejoin session ended - session_id: ${sessionId} (duration: ${duration}s)`
                        );
                        resolve({
                          success: true,
                          sessionId,
                          participantId: row.participant_id,
                          duration,
                          leftAt: leftAt.toISOString()
                        });
                      })
                      .catch((sessionErr) => {
                        logger.error('Model(ParticipantModel): Error closing rejoin participant session:', sessionErr);
                        reject(sessionErr);
                      });
                  }
                );
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
        `SELECT * FROM meeting_participants 
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
        `SELECT * FROM meeting_participants 
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
        `SELECT * FROM meeting_participant_attendance_sessions 
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
      db.all(
        `SELECT 
          mp.id,
          mp.participant_name,
          mp.first_joined_at,
          mp.last_left_at,
          mp.total_duration_seconds,
          mp.participant_status,
          COUNT(mpas.id) as rejoin_count
         FROM meeting_participants mp
         LEFT JOIN meeting_participant_attendance_sessions mpas ON mp.id = mpas.participant_id AND mpas.deleted_at IS NULL
         WHERE mp.meeting_id = ? AND mp.deleted_at IS NULL
         GROUP BY mp.id
         ORDER BY mp.first_joined_at ASC`,
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
        `UPDATE meeting_participants SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
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
