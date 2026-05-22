const { db } = require('../database/db');
const { logger } = require('../utils/logger');

class MeetingParticipantSessionModel {
  /**
   * Record a participant joining a meeting
   * Creates a new row with incremented join_sequence
   */
  static recordParticipantJoin(meetingId, sessionId, participantName, participantCountAtJoin) {
    return new Promise((resolve, reject) => {
      // First, get the next join_sequence number for this participant
      db.get(
        `SELECT MAX(join_sequence) as max_seq FROM meeting_participant_sessions 
         WHERE meeting_id = ? AND participant_name = ?`,
        [meetingId, participantName],
        (err, row) => {
          if (err) {
            logger.error('Model(MeetingParticipantSessionModel): Error getting max sequence:', err);
            return reject(err);
          }

          const nextSequence = (row && row.max_seq) ? row.max_seq + 1 : 1;

          // Insert new row for this join
          const stmt = db.prepare(`
            INSERT INTO meeting_participant_sessions (
              meeting_id, session_id, participant_name, join_sequence, 
              joined_at, participant_count_at_join, session_status, 
              created_at, updated_at
            ) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, ?, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `);

          stmt.run(
            meetingId,
            sessionId,
            participantName,
            nextSequence,
            participantCountAtJoin || 0,
            function(insertErr) {
              stmt.finalize();
              if (insertErr) {
                logger.error('Model(MeetingParticipantSessionModel): Error recording join:', insertErr);
                reject(insertErr);
              } else {
                logger.info(
                  `Model(MeetingParticipantSessionModel): Participant join recorded - ${participantName} (sequence: ${nextSequence})`
                );
                resolve({
                  id: this.lastID,
                  meetingId,
                  sessionId,
                  participantName,
                  join_sequence: nextSequence,
                  session_status: 'active'
                });
              }
            }
          );
        }
      );
    });
  }

  /**
   * Record a participant leaving a meeting
   * Updates the latest row for this participant to set left_at and calculate durations
   */
  static recordParticipantLeave(meetingId, participantName) {
    return new Promise((resolve, reject) => {
      // Get the latest active session for this participant
      db.get(
        `SELECT * FROM meeting_participant_sessions 
         WHERE meeting_id = ? AND participant_name = ? AND session_status = 'active'
         ORDER BY join_sequence DESC LIMIT 1`,
        [meetingId, participantName],
        (err, row) => {
          if (err) {
            logger.error('Model(MeetingParticipantSessionModel): Error getting active session:', err);
            return reject(err);
          }

          if (!row) {
            logger.warn(
              `Model(MeetingParticipantSessionModel): No active session found for ${participantName} in meeting ${meetingId}`
            );
            return resolve({ status: 'no_active_session', participantName });
          }

          // Calculate session duration in seconds
          db.all(
            `SELECT datetime(joined_at) as joined_dt FROM meeting_participant_sessions 
             WHERE id = ?`,
            [row.id],
            (timeErr, timeRows) => {
              if (timeErr) {
                logger.error('Model(MeetingParticipantSessionModel): Error getting join time:', timeErr);
                return reject(timeErr);
              }

              // Get all previous session durations for this participant
              db.all(
                `SELECT session_duration_seconds FROM meeting_participant_sessions 
                 WHERE meeting_id = ? AND participant_name = ? AND session_status = 'left'
                 ORDER BY join_sequence ASC`,
                [meetingId, participantName],
                (prevErr, prevSessions) => {
                  if (prevErr) {
                    logger.error('Model(MeetingParticipantSessionModel): Error getting previous sessions:', prevErr);
                    return reject(prevErr);
                  }

                  // Calculate total duration from all previous sessions
                  const previousTotalSeconds = prevSessions.reduce(
                    (sum, session) => sum + (session.session_duration_seconds || 0),
                    0
                  );

                  // In SQLite, we need to calculate duration differently
                  // Update the row with calculated values
                  const updateStmt = db.prepare(`
                    UPDATE meeting_participant_sessions
                    SET 
                      left_at = CURRENT_TIMESTAMP,
                      session_duration_seconds = (
                        SELECT (julianday(CURRENT_TIMESTAMP) - julianday(joined_at)) * 86400
                        FROM meeting_participant_sessions WHERE id = ?
                      ),
                      total_meeting_duration_seconds = ? + (
                        SELECT (julianday(CURRENT_TIMESTAMP) - julianday(joined_at)) * 86400
                        FROM meeting_participant_sessions WHERE id = ?
                      ),
                      session_status = 'left',
                      updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                  `);

                  updateStmt.run(row.id, previousTotalSeconds, row.id, row.id, function(updateErr) {
                    updateStmt.finalize();
                    if (updateErr) {
                      logger.error('Model(MeetingParticipantSessionModel): Error updating leave:', updateErr);
                      reject(updateErr);
                    } else {
                      logger.info(
                        `Model(MeetingParticipantSessionModel): Participant leave recorded - ${participantName} (sequence: ${row.join_sequence})`
                      );
                      resolve({
                        id: row.id,
                        meetingId,
                        participantName,
                        join_sequence: row.join_sequence,
                        session_status: 'left'
                      });
                    }
                  });
                }
              );
            }
          );
        }
      );
    });
  }

  /**
   * Get all session records for a participant in a meeting
   */
  static getParticipantSessions(meetingId, participantName) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM meeting_participant_sessions 
         WHERE meeting_id = ? AND participant_name = ?
         ORDER BY join_sequence ASC`,
        [meetingId, participantName],
        (err, rows) => {
          if (err) {
            logger.error('Model(MeetingParticipantSessionModel): Error fetching sessions:', err);
            reject(err);
          } else {
            resolve(rows || []);
          }
        }
      );
    });
  }

  /**
   * Get all participant sessions for a meeting
   */
  static getMeetingParticipantSessions(meetingId) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM meeting_participant_sessions 
         WHERE meeting_id = ?
         ORDER BY participant_name, join_sequence ASC`,
        [meetingId],
        (err, rows) => {
          if (err) {
            logger.error('Model(MeetingParticipantSessionModel): Error fetching meeting sessions:', err);
            reject(err);
          } else {
            resolve(rows || []);
          }
        }
      );
    });
  }

  /**
   * Get participant statistics for a meeting
   */
  static getParticipantStats(meetingId, participantName) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT 
          participant_name,
          COUNT(*) as total_joins,
          SUM(session_duration_seconds) as total_session_duration,
          MAX(total_meeting_duration_seconds) as cumulative_meeting_duration,
          MIN(joined_at) as first_joined_at,
          MAX(left_at) as last_left_at,
          GROUP_CONCAT(join_sequence) as join_sequences
         FROM meeting_participant_sessions
         WHERE meeting_id = ? AND participant_name = ? AND deleted_at IS NULL
         GROUP BY participant_name`,
        [meetingId, participantName],
        (err, row) => {
          if (err) {
            logger.error('Model(MeetingParticipantSessionModel): Error fetching stats:', err);
            reject(err);
          } else {
            resolve(row || null);
          }
        }
      );
    });
  }

  /**
   * Get all participant statistics for a meeting
   */
  static getMeetingParticipantStats(meetingId) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT 
          participant_name,
          COUNT(*) as total_joins,
          SUM(session_duration_seconds) as total_session_duration,
          MAX(total_meeting_duration_seconds) as cumulative_meeting_duration,
          MIN(joined_at) as first_joined_at,
          MAX(left_at) as last_left_at
         FROM meeting_participant_sessions
         WHERE meeting_id = ? AND deleted_at IS NULL
         GROUP BY participant_name
         ORDER BY participant_name`,
        [meetingId],
        (err, rows) => {
          if (err) {
            logger.error('Model(MeetingParticipantSessionModel): Error fetching meeting stats:', err);
            reject(err);
          } else {
            resolve(rows || []);
          }
        }
      );
    });
  }

  /**
   * Soft delete a participant session record
   */
  static deleteParticipantSession(sessionId) {
    return new Promise((resolve, reject) => {
      const stmt = db.prepare(`
        UPDATE meeting_participant_sessions
        SET 
          session_status = 'deleted',
          deleted_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);

      stmt.run(sessionId, function(err) {
        stmt.finalize();
        if (err) {
          logger.error('Model(MeetingParticipantSessionModel): Error deleting session:', err);
          reject(err);
        } else {
          logger.info(`Model(MeetingParticipantSessionModel): Session ${sessionId} soft deleted`);
          resolve({ id: sessionId, status: 'deleted' });
        }
      });
    });
  }

  /**
   * Update participant count at join (if it wasn't captured initially)
   */
  static updateParticipantCountAtJoin(sessionId, participantCount) {
    return new Promise((resolve, reject) => {
      const stmt = db.prepare(`
        UPDATE meeting_participant_sessions
        SET 
          participant_count_at_join = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);

      stmt.run(participantCount, sessionId, function(err) {
        stmt.finalize();
        if (err) {
          logger.error('Model(MeetingParticipantSessionModel): Error updating participant count:', err);
          reject(err);
        } else {
          resolve({ id: sessionId, participant_count_at_join: participantCount });
        }
      });
    });
  }
}

module.exports = MeetingParticipantSessionModel;
