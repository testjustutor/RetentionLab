/**
 * root/models/ParticipantSessionsModel.js
 *
 * Participant session records are stored in the `participant_attendance_sessions`
 * table (the legacy `participant_sessions` table was removed). Participant identity
 * is keyed by `participant_id`; find helper methods resolve it via `participants`.
 */
const { db } = require('../../database/db');
const { logger } = require('../../utils/logger');

class ParticipantSessionsModel {
  static resolveByMeetingName(meetingId, participantName) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT id FROM participants
          WHERE meeting_id = ? AND participant_name = ? AND deleted_at IS NULL
          ORDER BY id DESC LIMIT 1`,
        [meetingId, participantName],
        (err, row) => (err ? reject(err) : resolve(row || null))
      );
    });
  }

  static create(session) {
    return new Promise(async (resolve, reject) => {
      try {
        const participant = await ParticipantSessionsModel.resolveByMeetingName(session.meeting_id, session.participant_name);
        if (!participant) {
          return resolve({ id: null, status: 'participant_not_found' });
        }

        const maxRow = await new Promise((res, rej) => {
          db.get(
            `SELECT MAX(session_number) as max_session FROM participant_attendance_sessions
             WHERE participant_id = ? AND deleted_at IS NULL`,
            [participant.id],
            (err, row) => (err ? rej(err) : res(row))
          );
        });
        const nextSessionNumber = (maxRow && maxRow.max_session) ? maxRow.max_session +  1 : 1;

        const sql = `INSERT INTO participant_attendance_sessions (
            meeting_id, session_id, participant_id, session_number, joined_at, left_at,
            duration_seconds, total_meeting_duration_seconds, participant_count_at_join,
            attendance_status, session_status, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `;
        db.run(sql, [
            session.meeting_id,
            session.session_id,
            participant.id,
            nextSessionNumber,
            session.joined_at || null,
            session.left_at || null,
            session.duration_seconds || 0,
            session.total_meeting_duration_seconds || 0,
            session.participant_count_at_join || 0
          ], function(insertErr) {
            if (insertErr) {
              logger.error('[ParticipantSessionsModel] create error', insertErr);
              return reject(insertErr);
            }
            resolve({ id: this.lastID });
          });
      } catch (err) {
        logger.error('[ParticipantSessionsModel] create error', err);
        reject(err);
      }
    });
  }

  static listByMeeting(meetingId) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT pas.*, p.participant_name FROM participant_attendance_sessions pas
         JOIN participants p ON p.id = pas.participant_id
         WHERE pas.meeting_id = ? ORDER BY pas.joined_at ASC`,
        [meetingId],
        (err, rows) => err ? reject(err) : resolve(rows || [])
      );
    });
  }

  static getById(id) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT pas.*, p.participant_name FROM participant_attendance_sessions pas
         JOIN participants p ON p.id = pas.participant_id
         WHERE pas.id = ?`,
        [id],
        (err, row) => err ? reject(err) : resolve(row || null)
      );
    });
  }

  static update(id, changes) {
    const keys = Object.keys(changes);
    if (!keys.length) return Promise.resolve({ updated: false });
    const set = keys.map(k => `${k} = ?`).join(', ');
    const params = keys.map(k => changes[k]);
    params.push(id);
    return new Promise((resolve, reject) => {
      db.run(`UPDATE participant_attendance_sessions SET ${set}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, params, function(err) {
        if (err) return reject(err);
        resolve({ updated: this.changes > 0 });
      });
    });
  }

  static delete(id) {
    return new Promise((resolve, reject) => {
      db.run('DELETE FROM participant_attendance_sessions WHERE id = ?', [id], function(err) {
        if (err) return reject(err);
        resolve({ deleted: this.changes > 0 });
      });
    });
  }
}

module.exports = ParticipantSessionsModel;