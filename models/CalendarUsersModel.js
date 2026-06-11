/**
 * root/models/CalendarUsersModel.js
 */
const { db } = require('../database/db');
const { logger } = require('../utils/logger');

class CalendarUsersModel {
  static createTable() {
    return new Promise((resolve, reject) => {
      db.run(`
        CREATE TABLE IF NOT EXISTS calendar_integrations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER,
          provider TEXT,
          email TEXT UNIQUE NOT NULL,
          access_token TEXT,
          refresh_token TEXT,
          token_expiry INTEGER,
          status TEXT DEFAULT 'active',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id)
        )
      `, function(err) {
        if (err) {
          logger.error('Model(CalendarUsersModel): Error creating calendar_integrations table:', err);
          reject(err);
        } else {
          logger.info('Model(CalendarUsersModel): calendar_integrations table ready');
          resolve(this.changes);
        }
      });
    });
  }

  static createOrUpdateUser(email, tokens, userId = null) {
    return new Promise((resolve, reject) => {
      const { access_token, refresh_token, expiry_date, provider = 'google' } = tokens;
      if (!email) {
        return reject(new Error('Missing email'));
      }

      const stmt = db.prepare(`
        INSERT INTO calendar_integrations (user_id, email, provider, access_token, refresh_token, token_expiry)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(email) DO UPDATE SET
          user_id = excluded.user_id,
          provider = excluded.provider,
          access_token = excluded.access_token,
          refresh_token = excluded.refresh_token,
          token_expiry = excluded.token_expiry,
          updated_at = CURRENT_TIMESTAMP
      `);
      stmt.run(userId, email, provider, access_token, refresh_token || null, expiry_date || Date.now() + 3600000, function(err) {
        stmt.finalize();
        if (err) {
          logger.error('Model(CalendarUsersModel): Error upserting calendar integration:', err);
          reject(err);
        } else {
          logger.info(`Model(CalendarUsersModel): Calendar integration upserted: ${email}`);
          resolve({ id: this.lastID || null, email, changes: this.changes });
        }
      });
    });
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
}

module.exports = CalendarUsersModel;

