/**
 * root/models/ParticipantsModel.js
 */
const { db } = require('../../database/db');
const { logger } = require('../../utils/logger');

class ParticipantsModel {
  // SCHEMA UPDATE: `participants` no longer has join_time/leave_time columns
  // (current table: id, meeting_id, session_id, participant_name,
  // participant_email, participant_role, deleted_at, created_at, updated_at).
  // Join/leave timestamps live only in participant_attendance_sessions now
  // (see models/participants/ParticipantModel.js) — this generic CRUD model
  // just carries the two new identity columns through instead.
  static create(participant) {
    return new Promise((resolve, reject) => {
      const sql = `INSERT IGNORE INTO participants (meeting_id, session_id, participant_name, participant_email, participant_role, created_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`;
      db.run(sql, [participant.meeting_id, participant.session_id, participant.participant_name, participant.participant_email || null, participant.participant_role || null], function(err) {
        if (err) {
          logger.error('[ParticipantsModel] create error', err);
          return reject(err);
        }
        resolve({ id: this.lastID });
      });
    });
  }

  static getById(id) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM participants WHERE id = ?', [id], (err, row) => err ? reject(err) : resolve(row || null));
    });
  }

  static getByMeeting(meetingId) {
    return new Promise((resolve, reject) => {
      // Ordered by created_at (when the row first appeared) — join_time no
      // longer exists on this table; see the SCHEMA UPDATE note above.
      db.all('SELECT * FROM participants WHERE meeting_id = ? ORDER BY created_at ASC', [meetingId], (err, rows) => err ? reject(err) : resolve(rows || []));
    });
  }

  static update(id, changes) {
    const keys = Object.keys(changes);
    if (!keys.length) return Promise.resolve({ updated: false });
    const set = keys.map(k => `${k} = ?`).join(', ');
    const params = keys.map(k => changes[k]);
    params.push(id);
    return new Promise((resolve, reject) => {
      db.run(`UPDATE participants SET ${set}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, params, function(err) {
        if (err) return reject(err);
        resolve({ updated: this.changes > 0 });
      });
    });
  }

  static delete(id) {
    return new Promise((resolve, reject) => {
      db.run('DELETE FROM participants WHERE id = ?', [id], function(err) {
        if (err) return reject(err);
        resolve({ deleted: this.changes > 0 });
      });
    });
  }
}

module.exports = ParticipantsModel;
