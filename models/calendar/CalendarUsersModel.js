/**
 * root/models/CalendarUsersModel.js
 */
const { db } = require('../../database/db');
const { logger } = require('../../utils/logger');

// Small promisified wrappers matching the MySQL shim's callback style
const run = (sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, function (err) {
    if (err) return reject(err);
    resolve({ lastID: this.lastID, changes: this.changes });
  });
});

class CalendarUsersModel {
  static createTable() {
    // Tables already exist in MySQL - skip creation
    logger.info('Model(CalendarUsersModel): Tables verified (creation skipped for MySQL)');
    return Promise.resolve(0);
  }

  static async createOrUpdateUser(email, tokens, userId = null) {
    const { access_token, refresh_token, expiry_date, provider = 'google' } = tokens;
    if (!email) throw new Error('Missing email');

    const sql = `
      INSERT INTO calendar_integrations (user_id, email, provider, access_token, refresh_token, token_expiry)
      VALUES (?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        user_id = VALUES(user_id),
        provider = VALUES(provider),
        access_token = VALUES(access_token),
        refresh_token = VALUES(refresh_token),
        token_expiry = VALUES(token_expiry),
        updated_at = CURRENT_TIMESTAMP
    `;
    const params = [userId, email, provider, access_token, refresh_token || null, expiry_date || Date.now() + 3600000];

    const result = await run(sql, params);
    logger.info(`Model(CalendarUsersModel): Calendar integration upserted: ${email}`);
    return { id: result.lastID || null, email, changes: result.changes };
  }

  static async getUser(email) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM calendar_integrations WHERE email = ? ORDER BY updated_at DESC LIMIT 1', [email], (err, row) => {
        if (err) {
          logger.error('Model(CalendarUsersModel): Error fetching calendar integration:', err);
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  static async getAllUsers() {
    return new Promise((resolve, reject) => {
      db.all(`
        SELECT calendar_integrations.*, users.id AS user_id_ref, users.role_id, roles.role_name
        FROM calendar_integrations
        LEFT JOIN users ON users.id = calendar_integrations.user_id
        LEFT JOIN roles ON roles.id = users.role_id
        ORDER BY calendar_integrations.email
      `, (err, rows) => {
        if (err) {
          logger.error('Model(CalendarUsersModel): Error fetching calendar integrations:', err);
          reject(err);
        } else {
          logger.info(`Model(CalendarUsersModel): Fetched ${rows.length} calendar integrations`);
          resolve(rows);
        }
      });
    });
  }

  static updateTokens(email, tokens) {
    return new Promise((resolve, reject) => {
      const { access_token, refresh_token, expiry_date } = tokens;
      db.run(`
        UPDATE calendar_integrations SET
          access_token = ?,
          refresh_token = ?,
          token_expiry = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE email = ?
      `, [access_token, refresh_token || null, expiry_date, email], function(err) {
        if (err) {
          logger.error('Model(CalendarUsersModel): Error updating calendar tokens:', err);
          reject(err);
        } else {
          logger.info(`Model(CalendarUsersModel): Calendar tokens refreshed for ${email}, changes: ${this.changes}`);
          resolve({ changes: this.changes, email });
        }
      });
    });
  }

  static deleteUser(email) {
    return new Promise((resolve, reject) => {
      db.run('DELETE FROM calendar_integrations WHERE email = ?', [email], function(err) {
        if (err) {
          logger.error('Model(CalendarUsersModel): Error deleting calendar integration:', err);
          reject(err);
        } else {
          logger.info(`Model(CalendarUsersModel): Calendar integration deleted: ${email}, changes: ${this.changes}`);
          resolve({ changes: this.changes, email });
        }
      });
    });
  }

  /**
   * Get the count of truly connected calendars by checking
   * calendar_integrations, users, and roles tables.
   * A calendar is considered "connected" when:
   *  - calendar_integrations.status = 'active'
   *  - calendar_integrations has valid access_token or token_expiry
   *  - user is active (users.status = 'active')
   *  - user has an instructor-type role (instructor, solo_instructor)
   *  - user was created by the logged-in admin (users.created_by = adminId)
   *
   * @param {number|null} adminId - The logged-in admin's user ID. If null, skip admin filter.
   */
  static async getConnectedCalendarCount(adminId = null) {
    return new Promise((resolve, reject) => {
      const conditions = [
        `ci.status = 'active'`,
        `ci.email IS NOT NULL`,
        `(ci.access_token IS NOT NULL OR ci.token_expiry IS NOT NULL)`,
        `u.status = 'active'`,
        `r.role_name IN ('instructor', 'solo_instructor')`
      ];
      const params = [];

      if (adminId) {
        conditions.push(`u.created_by = ?`);
        params.push(adminId);
      }

      const sql = `
        SELECT COUNT(DISTINCT ci.email) AS count
        FROM calendar_integrations ci
        JOIN users u ON u.id = ci.user_id
        JOIN roles r ON r.id = u.role_id
        WHERE ${conditions.join(' AND ')}
      `;
      db.get(sql, params, (err, row) => {
        if (err) {
          logger.error('Model(CalendarUsersModel): Error counting connected calendars:', err);
          reject(err);
        } else {
          resolve(row ? row.count : 0);
        }
      });
    });
  }
}

module.exports = CalendarUsersModel;

