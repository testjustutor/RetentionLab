const { db } = require('../database/db');
const { logger } = require('../utils/logger');

class CalendarUsersModel {
  static createTable() {
    return new Promise((resolve, reject) => {
      db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT UNIQUE NOT NULL,
          access_token TEXT NOT NULL,
          refresh_token TEXT,
          token_expiry INTEGER NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, function(err) {
        if (err) {
          logger.error('Model(CalenderUsersModel): Error creating users table:', err);
          reject(err);
        } else {
          logger.info('Model(CalenderUsersModel): Users table ready');
          resolve(this.changes);
        }
      });
    });
  }

  static createOrUpdateUser(email, tokens) {
    return new Promise((resolve, reject) => {
      const { access_token, refresh_token, expiry_date } = tokens;
      if (!email) {
        return reject(new Error('Missing access_token or email'));
      }

      const stmt = db.prepare(`
        INSERT INTO users (email, access_token, refresh_token, token_expiry)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(email) DO UPDATE SET
          access_token = excluded.access_token,
          refresh_token = excluded.refresh_token,
          token_expiry = excluded.token_expiry,
          updated_at = CURRENT_TIMESTAMP
      `);
      stmt.run(email, access_token, refresh_token || null, expiry_date || Date.now() + 3600000, function(err) {
        stmt.finalize();
        if (err) {
          logger.error('Model(CalenderUsersModel): Error upserting user:', err);
          reject(err);
        } else {
          logger.info(`Model(CalenderUsersModel): User upserted: ${email}`);
          resolve({ id: this.lastID || null, email, changes: this.changes });
        }
      });
    });
  }

  static async getUser(email) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM users WHERE email = ? ORDER BY updated_at DESC LIMIT 1', [email], (err, row) => {
        if (err) {
          logger.error('Model(CalenderUsersModel): Error fetching user:', err);
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  static async getAllUsers() {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM users ORDER BY email', (err, rows) => {
        if (err) {
          logger.error('Model(CalenderUsersModel): Error fetching users:', err);
          reject(err);
        } else {
          logger.info(`Model(CalenderUsersModel): Fetched ${rows.length} users`);
          resolve(rows);
        }
      });
    });
  }

  static updateTokens(email, tokens) {
    return new Promise((resolve, reject) => {
      const { access_token, refresh_token, expiry_date } = tokens;
      db.run(`
        UPDATE users SET
          access_token = ?,
          refresh_token = ?,
          token_expiry = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE email = ?
      `, [access_token, refresh_token || null, expiry_date, email], function(err) {
        if (err) {
          logger.error('Model(CalenderUsersModel): Error updating tokens:', err);
          reject(err);
        } else {
          logger.info(`Model(CalenderUsersModel): Tokens refreshed for ${email}, changes: ${this.changes}`);
          resolve({ changes: this.changes, email });
        }
      });
    });
  }

  static deleteUser(email) {
    return new Promise((resolve, reject) => {
      db.run('DELETE FROM users WHERE email = ?', [email], function(err) {
        if (err) {
          logger.error('Model(CalenderUsersModel): Error deleting user:', err);
          reject(err);
        } else {
          logger.info(`Model(CalenderUsersModel): User deleted: ${email}, changes: ${this.changes}`);
          resolve({ changes: this.changes, email });
        }
      });
    });
  }
}

module.exports = CalendarUsersModel;

