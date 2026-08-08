/**
 * root/models/MeetingModel.js
 */
const { db } = require('../../database/db');
const { logger } = require('../../utils/logger');

// Promisified run helper matching the MySQL shim's callback style
const run = (sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, function (err) {
    if (err) return reject(err);
    resolve({ lastID: this.lastID, changes: this.changes });
  });
});

class MeetingModel {
  static async createMeeting(meetingData) {
    const sql = `INSERT INTO meetings (external_meeting_id, platform, passcode, event_id, calendar_account, 
      meeting_link, timezone, scheduled_start_time, scheduled_end_time, title, 
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

  // Dedup key is event_id (unique per calendar occurrence), NOT meeting_id.
  // meeting_id (e.g. the static Google Meet link ID) is often identical across
  // every occurrence of a recurring meeting, so keying on it would silently
  // skip/overwrite the wrong day's row.
  static getMeetingByIdOrCreate(meetingData) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM meetings WHERE event_id = ?', [meetingData.eventId], (err, row) => {
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
              `UPDATE meetings SET status = 'queued', platform = ?, passcode = ?, meeting_link = ?, scheduled_start_time = ?, title = ?, updated_at = CURRENT_TIMESTAMP WHERE event_id = ?`,
              [meetingData.platform, meetingData.passcode || null, meetingData.meetingLink, meetingData.scheduled_start_time, meetingData.title, meetingData.eventId],
              function(updateErr) { if (updateErr) return reject(updateErr); resolve({ id: row.id, exists: true, reset: true, ...meetingData }); });
          } else {
            // Update existing meeting with fresh data from calendar sync
            db.run(
              `UPDATE meetings SET platform = ?, passcode = ?, meeting_link = ?, scheduled_start_time = ?, scheduled_end_time = ?, title = ?, timezone = ?, updated_at = CURRENT_TIMESTAMP WHERE event_id = ?`,
              [meetingData.platform, meetingData.passcode || null, meetingData.meetingLink, meetingData.scheduled_start_time, meetingData.scheduled_end_time || null, meetingData.title, meetingData.timezone || null, meetingData.eventId],
              function(updateErr) { if (updateErr) return reject(updateErr); resolve({ id: row.id, exists: true, updated: true, ...meetingData }); }
            );
          }
        } else {
          const insertSql = `INSERT INTO meetings (external_meeting_id, platform, passcode, event_id, calendar_account, meeting_link, scheduled_start_time, title, scheduled_end_time, timezone, status, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'queued', ?, CURRENT_TIMESTAMP)`;
          const insertParams = [
            meetingData.meetingId, meetingData.platform, meetingData.passcode || null, meetingData.eventId,
            meetingData.account, meetingData.meetingLink, meetingData.scheduled_start_time, meetingData.title,
            meetingData.scheduled_end_time || null, meetingData.timezone || null, meetingData.sessionId || null,
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

  // NOTE: meeting_id is no longer guaranteed unique (recurring meetings share
  // the same meeting_id across occurrences with different event_id). This
  // lookup will only return ONE row (the first match) even if several
  // occurrences share the same meeting_id. Prefer getMeetingByEventId when
  // you need a specific occurrence.
  static getMeetingById(meetingId) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM meetings WHERE meeting_id = ?', [meetingId], (err, row) => { if (err) { logger.error('Model(MeetingModel): Error fetching meeting by ID:', err); reject(err); } else resolve(row); });
    });
  }

  static getMeetingByEventId(eventId) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM meetings WHERE event_id = ?', [eventId], (err, row) => { if (err) { logger.error('Model(MeetingModel): Error fetching meeting by event ID:', err); reject(err); } else resolve(row); });
    });
  }

  static getMeetingsByAccounts(emails, hours) {
    return new Promise((resolve, reject) => {
      if (!emails || !emails.length) return resolve([]);

      const now = new Date();
      const future = new Date(now.getTime() + hours * 3600000);
      const futureStr = future.toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' });

      const placeholders = emails.map(() => '?').join(',');
      const params = [...emails, futureStr];

      db.all(
        `SELECT m.title, m.scheduled_start_time, m.scheduled_end_time, m.platform, m.calendar_account, 
                u.first_name, u.last_name, r.role_name 
         FROM meetings m 
         LEFT JOIN users u ON u.email = m.calendar_account 
         LEFT JOIN roles r ON r.id = u.role_id 
         WHERE LOWER(m.calendar_account) IN (${placeholders}) 
           AND m.scheduled_start_time <= ?
         ORDER BY m.scheduled_start_time ASC`,
        params,
        (err, rows) => {
          if (err) return reject(err);
          resolve(rows || []);
        }
      );
    });
  }

  static getMeetingsByDateRange(emails, fromDate, toDate) {
    return new Promise((resolve, reject) => {
      if (!emails || !emails.length) return resolve([]);

      const fromStr = fromDate.toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' });
      const toStr = toDate.toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' });

      const placeholders = emails.map(() => '?').join(',');
      const params = [...emails, fromStr, toStr];

      db.all(
        `SELECT m.title, m.scheduled_start_time, m.scheduled_end_time, m.platform, m.calendar_account,
                u.first_name, u.last_name, r.role_name,
                TIMESTAMPDIFF(MINUTE, m.scheduled_start_time, m.scheduled_end_time) as duration
         FROM meetings m 
         LEFT JOIN users u ON u.email = m.calendar_account 
         LEFT JOIN roles r ON r.id = u.role_id 
         WHERE LOWER(m.calendar_account) IN (${placeholders}) 
           AND m.scheduled_start_time >= ?
           AND m.scheduled_start_time <= ?
         ORDER BY m.scheduled_start_time ASC`,
        params,
        (err, rows) => {
          if (err) return reject(err);
          resolve(rows || []);
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
        `SELECT m.*, u.first_name, u.last_name, r.role_name FROM meetings m LEFT JOIN users u ON u.email = m.calendar_account LEFT JOIN roles r ON r.id = u.role_id WHERE m.calendar_account IS NOT NULL AND LOWER(m.calendar_account) IN (${placeholders}) AND m.scheduled_start_time IS NOT NULL AND m.status NOT IN ('failed','cancelled') ORDER BY m.scheduled_start_time ASC`,
        emails,
        (err, rows) => {
          if (err) return reject(err);
          // Include meetings that are:
          // 1. Currently active (start <= now && end >= now)
          // 2. Starting within the next 10 minutes (start <= now + 10min) - for launch
          // 3. Started within the last 30 minutes (to account for delayed end_time updates)
          const filterStart = now - 30 * 60 * 1000; // 30 minutes ago
          const filterEnd = now + 10 * 60 * 1000;   // 10 minutes from now
          
          // Helper function to convert timezone-aware datetime to UTC timestamp
          const convertToUTC = (dateStr, timezone) => {
            if (!dateStr) return null;
            
            let year, month, day, hour, minute, second;
            
            // Handle different input types
            if (dateStr instanceof Date) {
              // If it's already a Date object, extract components
              year = dateStr.getUTCFullYear();
              month = dateStr.getUTCMonth() + 1;
              day = dateStr.getUTCDate();
              hour = dateStr.getUTCHours();
              minute = dateStr.getUTCMinutes();
              second = dateStr.getUTCSeconds();
            } else if (typeof dateStr === 'string') {
              // Parse datetime components from string (format: "YYYY-MM-DD HH:MM:SS" or ISO format)
              let datePart, timePart;
              
              // Check if it's ISO format (contains 'T')
              if (dateStr.includes('T')) {
                const isoDate = new Date(dateStr);
                year = isoDate.getUTCFullYear();
                month = isoDate.getUTCMonth() + 1;
                day = isoDate.getUTCDate();
                hour = isoDate.getUTCHours();
                minute = isoDate.getUTCMinutes();
                second = isoDate.getUTCSeconds();
              } else {
                // Format: "YYYY-MM-DD HH:MM:SS"
                [datePart, timePart] = dateStr.split(' ');
                [year, month, day] = datePart.split('-').map(Number);
                [hour, minute, second = 0] = (timePart || '00:00:00').split(':').map(Number);
              }
            } else {
              // Unknown format, try to convert to Date
              const date = new Date(dateStr);
              if (isNaN(date.getTime())) return null;
              return date.getTime();
            }
            
            // If no timezone, treat as UTC
            if (!timezone) {
              return Date.UTC(year, month - 1, day, hour, minute, second);
            }
            
            try {
              // Create a timestamp treating the input as UTC
              const asUTC = Date.UTC(year, month - 1, day, hour, minute, second);
              const tempDate = new Date(asUTC);
              
              // Format this UTC time in the target timezone to see what wall-clock time it represents
              const formatter = new Intl.DateTimeFormat('en-US', {
                timeZone: timezone,
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
              });
              
              const parts = formatter.formatToParts(tempDate);
              const getPart = (type) => parts.find(p => p.type === type)?.value || '00';
              
              const tzHour = parseInt(getPart('hour'));
              const tzMinute = parseInt(getPart('minute'));
              const tzSecond = parseInt(getPart('second'));
              
              // Calculate the timezone offset in minutes
              const originalMinutes = hour * 60 + minute + second / 60;
              const tzMinutes = tzHour * 60 + tzMinute + tzSecond / 60;
              const offsetMinutes = tzMinutes - originalMinutes;
              
              // Adjust the UTC timestamp by the offset to get the correct UTC time
              return asUTC - (offsetMinutes * 60 * 1000);
              
            } catch (e) {
              // Fallback: treat as UTC
              return Date.UTC(year, month - 1, day, hour, minute, second);
            }
          };
          
          const filtered = (rows || []).filter(r => { 
            const start = convertToUTC(r.scheduled_start_time, r.timezone); 
            const end = r.scheduled_end_time ? convertToUTC(r.scheduled_end_time, r.timezone) : Infinity; 
            // Show if:
            // - Meeting is currently ongoing, OR
            // - Meeting hasnt ended yet and started within the last 30 min, OR
            // - Meeting will start within the next 10 min (for launch)
            return (start <= now && end >= now) || 
                   (end >= now && start >= filterStart && start <= now) ||
                   (start >= now && start <= filterEnd);
          });
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

      // Include meetings that are:
      // 1. Status = 'completed', OR
      // 2. Have at least one session with both transcript_file_name AND audio_file_name
      const sql = `
        SELECT DISTINCT m.*, u.first_name, u.last_name, r.role_name
        FROM meetings m
        LEFT JOIN users u ON u.email = m.calendar_account
        LEFT JOIN roles r ON r.id = u.role_id
        LEFT JOIN meeting_sessions ms ON ms.meeting_id = m.external_meeting_id
        WHERE m.scheduled_start_time IS NOT NULL
          AND (
            m.status = 'completed'
            OR (ms.transcript_file_name IS NOT NULL AND ms.audio_file_name IS NOT NULL)
          )
        ORDER BY m.scheduled_start_time DESC
      `;

      const params = [now, lookback];

      db.all(sql, params, (err, rows) => {
        if (err) {
          logger.error('Model(MeetingModel): Error fetching completed meetings:', err);
          return reject(err);
        }
        resolve(rows || []);
      });
    });
  }

  static getQueuedMeetings() {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM meetings WHERE status = 'queued' AND scheduled_start_time <= DATE_ADD(NOW(), INTERVAL 3 MINUTE) ORDER BY scheduled_start_time ASC LIMIT 10`,
        [],
        (err, rows) => { if (err) { logger.error('Model(MeetingModel): Error fetching queued meetings:', err); reject(err); } else resolve(rows); }
      );
    });
  }

  // Keyed on event_id so that only the specific occurrence being processed
  // gets its status updated — meeting_id is shared across every occurrence
  // of a recurring meeting, so using it here could flip the status of the
  // wrong day's row (e.g. tomorrow's queued row instead of today's).
  static updateMeetingStatus(eventId, status, sessionId = null) {
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE meetings SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE event_id = ? AND status IN ('queued', 'launching')`,
        [status, eventId],
        function (err) {
          if (err) {
            logger.error('Model(MeetingModel): Error updating meeting status:', err);
            reject(err);
          } else {
            resolve({ success: true, updated: this.changes > 0, changes: this.changes, eventId });
          }
        }
      );
    });
  }

  static deleteRemovedMeetings(email, activeEventIds) {
    return new Promise((resolve, reject) => {
      if (!activeEventIds || activeEventIds.length === 0) { db.run(`DELETE FROM meetings WHERE calendar_account = ? AND status = 'queued'`, [email], (err) => err ? reject(err) : resolve()); }
      else { const ph = activeEventIds.map(() => '?').join(','); db.run(`DELETE FROM meetings WHERE calendar_account = ? AND status = 'queued' AND event_id NOT IN (${ph})`, [email, ...activeEventIds], (err) => { if (err) reject(err); else resolve(); }); }
    });
  }

  static getBatchHistory(limit = 50) { return new Promise((resolve, reject) => { db.all(`SELECT * FROM meetings WHERE platform LIKE '%batch%' AND status != 'queued' ORDER BY created_at DESC LIMIT ?`, [limit], (err, rows) => { if (err) { logger.error('Model(MeetingModel): Error fetching batch history:', err); reject(err); } else resolve(rows); }); }); }

  /**
   * Find meeting by title, start time, and owner (for calendar sync deduplication)
   */
  static findMeetingByTitleAndTime(title, startTime, ownerUserId) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT meeting_id FROM meetings WHERE title = ? AND scheduled_start_time = ? AND owner_user_id = ?`,
        [title, startTime, ownerUserId],
        (err, row) => err ? reject(err) : resolve(row || null)
      );
    });
  }

  /**
   * Update meeting from calendar sync
   */
  static updateMeetingFromCalendar(meetingId, title, platform, startTime, endTime) {
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE meetings SET title = ?, platform = ?, scheduled_start_time = ?, scheduled_end_time = ?, updated_at = CURRENT_TIMESTAMP WHERE external_meeting_id = ?`,
        [title, platform, startTime, endTime, meetingId],
        function(err) {
          if (err) {
            logger.error(`[MeetingModel] Error updating meeting ${meetingId}:`, err);
            reject(err);
          } else {
            logger.info(`[MeetingModel] Updated meeting ${meetingId}: ${title}`);
            resolve({ updated: this.changes > 0, meetingId });
          }
        }
      );
    });
  }

  /**
   * Create meeting from calendar sync
   */
  static createMeetingFromCalendar(title, platform, startTime, endTime, userId) {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO meetings (external_meeting_id, title, platform, scheduled_start_time, scheduled_end_time, owner_user_id, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'scheduled', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [`cal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, title, platform, startTime, endTime, userId],
        function(err) {
          if (err) {
            logger.error(`[MeetingModel] Error creating meeting for ${title}:`, err);
            reject(err);
          } else {
            logger.info(`[MeetingModel] Created meeting: ${title} at ${startTime}`);
            resolve({ id: this.lastID, meetingId: `cal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` });
          }
        }
      );
    });
  }

  static getUserStats() {
    return new Promise((resolve, reject) => {
      db.all(`SELECT ci.id, u.email, ci.provider, ci.token_expiry, ci.status, ci.created_at, ci.updated_at, u.id AS user_id, r.role_name, COUNT(m.id) AS total_meetings, SUM(CASE WHEN m.status = 'completed' THEN 1 ELSE 0 END) AS completed_meetings, COALESCE(SUM(CASE WHEN m.status = 'completed' AND m.scheduled_start_time IS NOT NULL AND m.scheduled_end_time IS NOT NULL THEN CAST((julianday(m.scheduled_end_time) - julianday(m.scheduled_start_time)) * 86400 AS INTEGER) ELSE 0 END), 0) AS total_duration_seconds, (SELECT m2.platform FROM meetings m2 WHERE m2.calendar_account = u.email AND m2.platform IS NOT NULL GROUP BY m2.platform ORDER BY COUNT(*) DESC LIMIT 1) AS top_platform, MAX(CASE WHEN m.status = 'completed' THEN m.scheduled_end_time ELSE NULL END) AS last_meeting_at FROM calendar_integrations ci LEFT JOIN users u ON u.id = ci.user_id LEFT JOIN roles r ON r.id = u.role_id LEFT JOIN meetings m ON m.calendar_account = u.email GROUP BY ci.id ORDER BY u.email ASC`, [], (err, rows) => { if (err) { logger.error('Model(MeetingModel): Error fetching user stats:', err); reject(err); } else resolve(rows); });
    });
  }

  /**
   * Get all meetings with owner details for reports
   * @param {number} days - Number of days to look back
   * @returns {Promise<Array>} Array of meetings with owner information
   */
  static async getMeetingsWithOwnerDetails(days = 90) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT m.id,
               m.external_meeting_id as meeting_id,
               m.title,
               m.scheduled_start_time,
               m.scheduled_end_time,
               m.platform,
               m.calendar_account,
               m.status,
               CONCAT(u.first_name, ' ', u.last_name) as owner_name,
               u.email as owner_email,
               u.id as owner_user_id
        FROM meetings m
        LEFT JOIN users u ON u.email = m.calendar_account
        WHERE m.scheduled_start_time >= DATE_SUB(NOW(), INTERVAL ? DAY) OR m.scheduled_start_time IS NULL
        ORDER BY m.scheduled_start_time DESC
        LIMIT 100
      `;

      db.all(sql, [days], (err, rows) => {
        if (err) {
          logger.error('Model(MeetingModel): Error fetching meetings with owner details:', err);
          return reject(err);
        }
        resolve(rows || []);
      });
    });
  }
}

module.exports = MeetingModel;