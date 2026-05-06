const { db } = require('../database/db');
const { logger } = require('../utils/logger');

class MeetingModel {
  static createMeeting(meetingData) {
    return new Promise((resolve, reject) => {
const stmt = db.prepare(`
INSERT INTO calendar_meetings (meeting_id, platform, passcode, event_id, calendar_account, 
        meeting_link, timezone, start_time, end_time, title, 
        status, session_id, created_at) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,CURRENT_TIMESTAMP)
      `);
stmt.run(
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
        function(err) {
          stmt.finalize();
          if (err) {
            logger.error('Error creating meeting record:', err);
            reject(err);
          } else {
            logger.info(`Meeting tracked: ${meetingData.meetingId} (${meetingData.platform})`);
            resolve({ id: this.lastID, ...meetingData });
          }
        }
      );
    });
  }

  /**
   * Get meeting by ID or create new/queue if missing or failed
   * Handles duplicate meeting_id gracefully
   */
  static getMeetingByIdOrCreate(meetingData) {
    return new Promise((resolve, reject) => {
      // First check if exists
      db.get('SELECT * FROM calendar_meetings WHERE meeting_id = ?', [meetingData.meetingId], (err, row) => {
        if (err) {
          logger.error('Error checking meeting existence:', err);
          return reject(err);
        }

        if (row) {
          const activeStatuses = ['joining', 'active', 'queued', 'launching', 'starting'];
          const failedStatuses = ['failed', 'error', 'cancelled', 'stopped'];

          if (activeStatuses.includes(row.status)) {
            logger.info(`Meeting ${meetingData.meetingId} already ${row.status}, using existing`);
            return resolve({ id: row.id, exists: true, status: row.status });
          }

          if (row.status === 'completed') {
            logger.info(`Skipping completed meeting ${meetingData.meetingId}`);
            return resolve({ id: row.id, exists: true, skipped: true, status: 'completed' });
          }

          if (failedStatuses.includes(row.status)) {
            // Reset failed to queued
            db.run(
              `UPDATE calendar_meetings 
               SET status = 'queued', platform = ?, passcode = ?, meeting_link = ?, start_time = ?, title = ?, updated_at = CURRENT_TIMESTAMP 
               WHERE meeting_id = ?`,
              [meetingData.platform, meetingData.passcode || null, meetingData.meetingLink, meetingData.startTime, meetingData.title, meetingData.meetingId],
              function(updateErr) {
                if (updateErr) {
                  logger.error('Error resetting meeting:', updateErr);
                  return reject(updateErr);
                }
                logger.info(`Reset meeting ${meetingData.meetingId} with passcode: ${!!meetingData.passcode}`);
                resolve({ id: row.id, exists: true, reset: true, ...meetingData });
              }
            );
          } else {
            // Unexpected status - update anyway
            resolve({ id: row.id, exists: true, ...meetingData });
          }
        } else {
          // Create new
          const stmt = db.prepare(`
            INSERT INTO calendar_meetings (
              meeting_id, platform, passcode, event_id, calendar_account, 
              meeting_link, start_time, title, end_time, 
              timezone, status, session_id, created_at
            ) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'queued', ?, CURRENT_TIMESTAMP)
          `);

          stmt.run(
            meetingData.meetingId,        // 1
            meetingData.platform,         // 2
            meetingData.passcode || null, // 3
            meetingData.eventId,          // 4
            meetingData.account,          // 5
            meetingData.meetingLink,      // 6
            meetingData.startTime,        // 7
            meetingData.title,            // 8
            meetingData.endTime || null,  // 9
            meetingData.timezone || null, // 10
            meetingData.sessionId || null,// 11 (maps to the '?' after status)
            function(err) {
              stmt.finalize();
              if (err) {
                logger.error('Error creating meeting record:', err);
                reject(err);
              } else {
                logger.info(`Created new queued meeting: ${meetingData.meetingId} with passcode: ${!!meetingData.passcode}`);
                resolve({ id: this.lastID, created: true, ...meetingData });
              }
            }
          );
        }
      });
    });
  }

  static updateMeetingStatus(meetingId, status, sessionId = null) {
    return new Promise((resolve, reject) => {
      let query = 'UPDATE calendar_meetings SET status = ?, session_id = ?, updated_at = CURRENT_TIMESTAMP WHERE meeting_id = ?';
      let params = [status, sessionId, meetingId];
      
      db.run(query, params, function(err) {
        if (err) {
          logger.error('Error updating meeting status:', err);
          reject(err);
        } else {
          logger.info(`Meeting ${meetingId} status updated to: ${status}`);
          resolve({ changes: this.changes, meetingId });
        }
      });
    });
  }

  static getUpcomingMeetings(account = null, limit = 20) {
    return new Promise((resolve, reject) => {
      let query = 'SELECT * FROM calendar_meetings WHERE status IN ("joining", "active")';
      let params = [];
      
      if (account) {
        query += ' AND calendar_account = ?';
        params.push(account);
      }
      
      query += ' ORDER BY start_time ASC LIMIT ?';
      params.push(limit);
      
      db.all(query, params, (err, rows) => {
        if (err) {
          logger.error('Error fetching upcoming meetings:', err);
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  static getMeetingHistory(account = null, limit = 50) {
    return new Promise((resolve, reject) => {
      let query = `
        SELECT * FROM calendar_meetings 
        WHERE status IN ('completed', 'failed', 'cancelled')
      `;
      let params = [];
      
      if (account) {
        query += ' AND calendar_account = ?';
        params.push(account);
      }
      
      query += ' ORDER BY created_at DESC LIMIT ?';
      params.push(limit);
      
      db.all(query, params, (err, rows) => {
        if (err) {
          logger.error('Error fetching meeting history:', err);
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  static getMeetingById(meetingId) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM calendar_meetings WHERE meeting_id = ?', [meetingId], (err, row) => {
        if (err) {
          logger.error('Error fetching meeting by ID:', err);
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  // NEW: Get queued batch meetings for polling
  static getQueuedMeetings() {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT * FROM calendar_meetings 
        WHERE status = 'queued'
        AND datetime(start_time) <= datetime('now', '+1 minute')
        ORDER BY start_time ASC
        LIMIT 10
      `;

      db.all(query, [], (err, rows) => {
        if (err) {
          logger.error('Error fetching queued meetings:', err);
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  // NEW: Update status (enhanced for batch tracking)
  static updateMeetingStatus(meetingId, status, sessionId = null) {
    return new Promise((resolve, reject) => {
      let query = 'UPDATE calendar_meetings SET status = ?, session_id = ?, updated_at = CURRENT_TIMESTAMP WHERE meeting_id = ?';
      let params = [status, sessionId, meetingId];
      
      db.run(query, params, function(err) {
        if (err) {
          logger.error('Error updating meeting status:', err);
          reject(err);
        } else {
          logger.info(`Meeting ${meetingId} status → ${status} (changes: ${this.changes})`);
          resolve({ changes: this.changes, meetingId });
        }
      });
    });
  }

  // Add this to your MeetingModel.js
  static deleteRemovedMeetings(email, activeEventIds) {
      return new Promise((resolve, reject) => {
          if (!activeEventIds || activeEventIds.length === 0) {
              const sql = `DELETE FROM calendar_meetings WHERE calendar_account = ? AND status = 'queued'`;
              db.run(sql, [email], (err) => err ? reject(err) : resolve());
          } else {
              const placeholders = activeEventIds.map(() => '?').join(',');
              const sql = `DELETE FROM calendar_meetings 
                           WHERE calendar_account = ? 
                           AND status = 'queued' 
                           AND event_id NOT IN (${placeholders})`;
              
              db.run(sql, [email, ...activeEventIds], (err) => {
                  if (err) reject(err);
                  else resolve();
              });
          }
      });
  }

  // NEW: Get batch history
  static getBatchHistory(limit = 50) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT * FROM calendar_meetings 
        WHERE platform LIKE '%batch%'
        AND status != 'queued'
        ORDER BY created_at DESC 
        LIMIT ?
      `;
      db.all(query, [limit], (err, rows) => {
        if (err) {
          logger.error('Error fetching batch history:', err);
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  // Add this to MeetingModel.js
  static updateSummary(sessionId, summary) {
    return new Promise((resolve, reject) => {
      const sql = `UPDATE calendar_meetings SET summary = ? WHERE session_id = ?`;
      db.run(sql, [summary, sessionId], function(err) {
        if (err) {
          logger.error('Error updating summary in DB:', err);
          reject(err);
        } else {
          logger.info(`Summary updated in DB for session: ${sessionId}`);
          resolve(this.changes);
        }
      });
    });
  }
}

module.exports = MeetingModel;

