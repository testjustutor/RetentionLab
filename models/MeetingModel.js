/**
 * root/models/MeetingModel.js
 */
const { db } = require('../database/db');
const { logger } = require('../utils/logger');

// Promisified run helper matching the MySQL shim's callback style
const run = (sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, function (err) {
    if (err) return reject(err);
    resolve({ lastID: this.lastID, changes: this.changes });
  });
});

class MeetingModel {
  static async createMeeting(meetingData) {
    const sql = `INSERT INTO meetings (meeting_id, platform, passcode, event_id, calendar_account, 
      meeting_link, timezone, start_time, end_time, title, 
      status, session_id, company_id, owner_user_id, reviewer_id, created_by_user_id, created_at) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`;

    const params = [
      meetingData.meetingId,
      meetingData.platform,
      meetingData.passcode || null,
      meetingData.eventId,
      meetingData.account,
      meetingData.meetingLink,
      meetingData.timezone || null,
      meetingData.startTime,
      meetingData.endTime || null,
      meetingData.title,
      'joining',
      meetingData.sessionId || null,
      meetingData.company_id || null,
      meetingData.owner_user_id || null,
      meetingData.reviewer_id || null,
      meetingData.created_by_user_id || null
    ];

    const result = await run(sql, params);
    logger.info(`Model(MeetingModel): Meeting tracked: ${meetingData.meetingId} (${meetingData.platform})`);
    return { id: result.lastID, ...meetingData };
  }

  static getMeetingByIdOrCreate(meetingData) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM meetings WHERE meeting_id = ?', [meetingData.meetingId], (err, row) => {
        if (err) { logger.error('Model(MeetingModel): Error checking meeting existence:', err); return reject(err); }

        if (row) {
          const activeStatuses = ['joining', 'active', 'queued', 'launching', 'starting'];
          const failedStatuses = ['failed', 'error', 'cancelled', 'stopped'];

          if (activeStatuses.includes(row.status)) {
            return resolve({ id: row.id, exists: true, status: row.status });
          }
          if (row.status === 'completed') {
            return resolve({ id: row.id, exists: true, skipped: true, status: 'completed' });
          }
          if (failedStatuses.includes(row.status)) {
            db.run(
              `UPDATE meetings SET status = 'queued', platform = ?, passcode = ?, meeting_link = ?, start_time = ?, title = ?, updated_at = CURRENT_TIMESTAMP WHERE meeting_id = ?`,
              [meetingData.platform, meetingData.passcode || null, meetingData.meetingLink, meetingData.startTime, meetingData.title, meetingData.meetingId],
              function(updateErr) { if (updateErr) return reject(updateErr); resolve({ id: row.id, exists: true, reset: true, ...meetingData }); });
          } else { resolve({ id: row.id, exists: true, ...meetingData }); }
        } else {
          const insertSql = `INSERT INTO meetings (meeting_id, platform, passcode, event_id, calendar_account, meeting_link, start_time, title, end_time, timezone, status, session_id, company_id, owner_user_id, reviewer_id, created_by_user_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'queued', ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`;
          const insertParams = [
            meetingData.meetingId, meetingData.platform, meetingData.passcode || null, meetingData.eventId,
            meetingData.account, meetingData.meetingLink, meetingData.startTime, meetingData.title,
            meetingData.endTime || null, meetingData.timezone || null, meetingData.sessionId || null,
            meetingData.company_id || null, meetingData.owner_user_id || null, meetingData.reviewer_id || null,
            meetingData.created_by_user_id || null
          ];
          db.run(insertSql, insertParams, function(err) {
            if (err) { logger.error('Model(MeetingModel): Error creating meeting record:', err); reject(err); }
            else { resolve({ id: this.lastID, created: true, ...meetingData }); }
          });
        }
      });
    });
  }
  
  static getUpcomingMeetings(account = null, limit = 20) {
    return new Promise((resolve, reject) => {
      let query = 'SELECT * FROM meetings WHERE status IN ("joining", "active")';
      let params = [];
      if (account) { query += ' AND calendar_account = ?'; params.push(account); }
      query += ' ORDER BY start_time ASC LIMIT ?'; params.push(limit);
      db.all(query, params, (err, rows) => { if (err) { logger.error('Model(MeetingModel): Error fetching upcoming meetings:', err); reject(err); } else resolve(rows); });
    });
  }

  static getMeetingHistory(account = null, limit = 50) {
    return new Promise((resolve, reject) => {
      let query = `SELECT * FROM meetings WHERE status IN ('completed', 'failed', 'cancelled')`;
      let params = [];
      if (account) { query += ' AND calendar_account = ?'; params.push(account); }
      query += ' ORDER BY created_at DESC LIMIT ?'; params.push(limit);
      db.all(query, params, (err, rows) => { if (err) { logger.error('Model(MeetingModel): Error fetching meeting history:', err); reject(err); } else resolve(rows); });
    });
  }

  static getMeetingById(meetingId) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM meetings WHERE meeting_id = ?', [meetingId], (err, row) => { if (err) { logger.error('Model(MeetingModel): Error fetching meeting by ID:', err); reject(err); } else resolve(row); });
    });
  }

  static getMeetingsByAccounts(emails, hours) {
    return new Promise((resolve, reject) => {
      if (!emails || !emails.length) return resolve([]);
      const now = Date.now();
      const future = now + hours * 3600000;
      const placeholders = emails.map(() => '?').join(',');
      db.all(
        `SELECT m.*, u.first_name, u.last_name, r.role_name FROM meetings m LEFT JOIN users u ON u.email = m.calendar_account LEFT JOIN roles r ON r.id = u.role_id WHERE m.calendar_account IS NOT NULL AND LOWER(m.calendar_account) IN (${placeholders}) AND m.start_time IS NOT NULL AND m.status NOT IN ('failed','cancelled') ORDER BY m.start_time ASC`,
        emails,
        (err, rows) => {
          if (err) return reject(err);
          const filtered = (rows || []).filter(r => { const start = new Date(r.start_time).getTime(); if (isNaN(start)) return false; return start >= now && start <= future; });
          resolve(filtered);
        }
      );
    });
  }

  static getLiveMeetingsByAccounts(emails) {
    return new Promise((resolve, reject) => {
      if (!emails || !emails.length) return resolve([]);
      const now = Date.now();
      const placeholders = emails.map(() => '?').join(',');
      db.all(
        `SELECT m.*, u.first_name, u.last_name, r.role_name FROM meetings m LEFT JOIN users u ON u.email = m.calendar_account LEFT JOIN roles r ON r.id = u.role_id WHERE m.calendar_account IS NOT NULL AND LOWER(m.calendar_account) IN (${placeholders}) AND m.start_time IS NOT NULL AND m.status NOT IN ('failed','cancelled') ORDER BY m.start_time ASC`,
        emails,
        (err, rows) => {
          if (err) return reject(err);
          const filtered = (rows || []).filter(r => { const start = new Date(r.start_time).getTime(); const end = r.end_time ? new Date(r.end_time).getTime() : Infinity; return start <= now && end >= now; });
          resolve(filtered);
        }
      );
    });
  }

  /** Get all completed/ended meetings within a time window (across all users) */
  static getCompletedMeetingsByAccounts(emails, hours) {
    return new Promise((resolve, reject) => {
      const lookback = new Date(Date.now() - hours * 3600000).toISOString();
      const now = new Date().toISOString();

      if (emails && emails.length) {
        // Filtered by specific emails
        const placeholders = emails.map(() => '?').join(',');
        db.all(
          `SELECT m.*, u.first_name, u.last_name, r.role_name FROM meetings m LEFT JOIN users u ON u.email = m.calendar_account LEFT JOIN roles r ON r.id = u.role_id WHERE m.calendar_account IS NOT NULL AND LOWER(m.calendar_account) IN (${placeholders}) AND m.start_time IS NOT NULL AND m.end_time <= ? AND m.end_time >= ? ORDER BY m.start_time DESC`,
          [...emails, now, lookback],
          (err, rows) => err ? reject(err) : resolve(rows || [])
        );
      } else {
        // All users — no email filter
        db.all(
          `SELECT m.*, u.first_name, u.last_name, r.role_name FROM meetings m LEFT JOIN users u ON u.email = m.calendar_account LEFT JOIN roles r ON r.id = u.role_id WHERE m.start_time IS NOT NULL AND m.end_time <= ? AND m.end_time >= ? ORDER BY m.start_time DESC`,
          [now, lookback],
          (err, rows) => err ? reject(err) : resolve(rows || [])
        );
      }
    });
  }

  static getQueuedMeetings() {
    return new Promise((resolve, reject) => {
      db.all(`SELECT * FROM meetings WHERE status = 'queued' AND start_time <= DATE_ADD(NOW(), INTERVAL 1 MINUTE) ORDER BY start_time ASC LIMIT 10`, [], (err, rows) => { if (err) { logger.error('Model(MeetingModel): Error fetching queued meetings:', err); reject(err); } else resolve(rows); });
    });
  }

  static updateMeetingStatus(meetingId, status, sessionId = null) {
    return new Promise((resolve, reject) => {
      db.run(`UPDATE meetings SET status = ?, session_id = ?, updated_at = CURRENT_TIMESTAMP WHERE meeting_id = ? AND status IN ('queued', 'launching')`, [status, sessionId, meetingId], function (err) { if (err) { logger.error('Model(MeetingModel): Error updating meeting status:', err); reject(err); } else resolve({ success: true, updated: this.changes > 0, changes: this.changes, meetingId }); });
    });
  }

  static deleteRemovedMeetings(email, activeEventIds) {
    return new Promise((resolve, reject) => {
      if (!activeEventIds || activeEventIds.length === 0) { db.run(`DELETE FROM meetings WHERE calendar_account = ? AND status = 'queued'`, [email], (err) => err ? reject(err) : resolve()); }
      else { const ph = activeEventIds.map(() => '?').join(','); db.run(`DELETE FROM meetings WHERE calendar_account = ? AND status = 'queued' AND event_id NOT IN (${ph})`, [email, ...activeEventIds], (err) => { if (err) reject(err); else resolve(); }); }
    });
  }

  static getBatchHistory(limit = 50) { return new Promise((resolve, reject) => { db.all(`SELECT * FROM meetings WHERE platform LIKE '%batch%' AND status != 'queued' ORDER BY created_at DESC LIMIT ?`, [limit], (err, rows) => { if (err) { logger.error('Model(MeetingModel): Error fetching batch history:', err); reject(err); } else resolve(rows); }); }); }

  static getUserStats() {
    return new Promise((resolve, reject) => {
      db.all(`SELECT ci.id, ci.email, ci.provider, ci.token_expiry, ci.status, ci.created_at, ci.updated_at, u.id AS user_id, r.role_name, COUNT(m.id) AS total_meetings, SUM(CASE WHEN m.status = 'completed' THEN 1 ELSE 0 END) AS completed_meetings, COALESCE(SUM(CASE WHEN m.status = 'completed' AND m.start_time IS NOT NULL AND m.end_time IS NOT NULL THEN CAST((julianday(m.end_time) - julianday(m.start_time)) * 86400 AS INTEGER) ELSE 0 END), 0) AS total_duration_seconds, (SELECT m2.platform FROM meetings m2 WHERE m2.calendar_account = ci.email AND m2.platform IS NOT NULL GROUP BY m2.platform ORDER BY COUNT(*) DESC LIMIT 1) AS top_platform, MAX(CASE WHEN m.status = 'completed' THEN m.end_time ELSE NULL END) AS last_meeting_at FROM calendar_integrations ci LEFT JOIN users u ON u.id = ci.user_id LEFT JOIN roles r ON r.id = u.role_id LEFT JOIN meetings m ON m.calendar_account = ci.email GROUP BY ci.id ORDER BY ci.email ASC`, [], (err, rows) => { if (err) { logger.error('Model(MeetingModel): Error fetching user stats:', err); reject(err); } else resolve(rows); });
    });
  }
}

module.exports = MeetingModel;