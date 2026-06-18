/**
 * root/models/ParticipantAttendanceSessionsModel.js
 */
const { db } = require('../database/db');
const { logger } = require('../utils/logger');

class ParticipantAttendanceSessionsModel {
  static create(record) {
    return new Promise((resolve, reject) => {
      const sql = `INSERT INTO participant_attendance_sessions (meeting_id, participant_id, session_number, joined_at, left_at, duration_seconds, attendance_status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`;
      db.run(sql, [record.meeting_id, record.participant_id, record.session_number, record.joined_at || null, record.left_at || null, record.duration_seconds || 0, record.attendance_status || 'active'], function(err) {
        if (err) {
          logger.error('[ParticipantAttendanceSessionsModel] create error', err);
          return reject(err);
        }
        resolve({ id: this.lastID });
      });
    });
  }

  static listByParticipant(participantId) {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM participant_attendance_sessions WHERE participant_id = ? ORDER BY session_number ASC', [participantId], (err, rows) => err ? reject(err) : resolve(rows || []));
    });
  }

  static getById(id) {
    return new Promise((resolve, reject) => db.get('SELECT * FROM participant_attendance_sessions WHERE id = ?', [id], (err, row) => err ? reject(err) : resolve(row || null)));
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
    return new Promise((resolve, reject) => db.run('DELETE FROM participant_attendance_sessions WHERE id = ?', [id], function(err) { if (err) return reject(err); resolve({ deleted: this.changes > 0 }); }));
  }
}

module.exports = ParticipantAttendanceSessionsModel;
