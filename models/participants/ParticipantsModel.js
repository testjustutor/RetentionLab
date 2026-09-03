/**
 * root/models/ParticipantsModel.js
 */
const { db } = require('../../database/db');
const { logger } = require('../../utils/logger');

class ParticipantsModel {
  static create(participant) {
    return new Promise((resolve, reject) => {
      const sql = `INSERT IGNORE INTO participants (meeting_id, session_id, participant_name, join_time, leave_time, created_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`;
      db.run(sql, [participant.meeting_id, participant.session_id, participant.participant_name, participant.join_time || null, participant.leave_time || null], function(err) {
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
      db.all('SELECT * FROM participants WHERE meeting_id = ? ORDER BY join_time ASC', [meetingId], (err, rows) => err ? reject(err) : resolve(rows || []));
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
