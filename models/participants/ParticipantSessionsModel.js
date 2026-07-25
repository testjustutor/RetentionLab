/**
 * root/models/ParticipantSessionsModel.js
 */
const { db } = require('../../database/db');
const { logger } = require('../../utils/logger');

class ParticipantSessionsModel {
  static create(session) {
    return new Promise((resolve, reject) => {
      const sql = `INSERT INTO participant_sessions (meeting_id, session_id, participant_name, join_sequence, joined_at, left_at, session_duration_seconds, total_meeting_duration_seconds, participant_count_at_join, session_status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`;
      db.run(sql, [session.meeting_id, session.session_id, session.participant_name, session.join_sequence || 1, session.joined_at || null, session.left_at || null, session.session_duration_seconds || 0, session.total_meeting_duration_seconds || 0, session.participant_count_at_join || 0, session.session_status || 'active'], function(err) {
        if (err) {
          logger.error('[ParticipantSessionsModel] create error', err);
          return reject(err);
        }
        resolve({ id: this.lastID });
      });
    });
  }

  static listByMeeting(meetingId) {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM participant_sessions WHERE meeting_id = ? ORDER BY joined_at ASC', [meetingId], (err, rows) => err ? reject(err) : resolve(rows || []));
    });
  }

  static getById(id) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM participant_sessions WHERE id = ?', [id], (err, row) => err ? reject(err) : resolve(row || null));
    });
  }

  static update(id, changes) {
    const keys = Object.keys(changes);
    if (!keys.length) return Promise.resolve({ updated: false });
    const set = keys.map(k => `${k} = ?`).join(', ');
    const params = keys.map(k => changes[k]);
    params.push(id);
    return new Promise((resolve, reject) => {
      db.run(`UPDATE participant_sessions SET ${set}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, params, function(err) {
        if (err) return reject(err);
        resolve({ updated: this.changes > 0 });
      });
    });
  }

  static delete(id) {
    return new Promise((resolve, reject) => {
      db.run('DELETE FROM participant_sessions WHERE id = ?', [id], function(err) {
        if (err) return reject(err);
        resolve({ deleted: this.changes > 0 });
      });
    });
  }
}

module.exports = ParticipantSessionsModel;
