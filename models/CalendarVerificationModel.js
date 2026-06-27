/**
 * root/models/CalendarVerificationModel.js
 */
const crypto = require('crypto');
const { db } = require('../database/db');

const run = (sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, function (err) {
    if (err) return reject(err);
    resolve(this);
  });
});

const get = (sql, params = []) => new Promise((resolve, reject) => {
  db.get(sql, params, (err, row) => {
    if (err) return reject(err);
    resolve(row || null);
  });
});

class CalendarVerificationModel {
  static async createTable() {
    // Tables already exist in MySQL - skip creation
    return Promise.resolve();
  }

  static async create(email, ttlMinutes = 30) {
    const token = crypto.randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString();
    await run(
      `INSERT INTO calendar_verifications (email, token, status, expires_at, created_at, updated_at)
       VALUES (?, ?, 'pending', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON DUPLICATE KEY UPDATE
         token = VALUES(token),
         status = 'pending',
         expires_at = VALUES(expires_at),
         verified_at = NULL,
         updated_at = CURRENT_TIMESTAMP`,
      [email, token, expiresAt]
    );
    return { email, token, expiresAt };
  }

  static async getByToken(token) {
    return get(`SELECT * FROM calendar_verifications WHERE token = ? LIMIT 1`, [token]);
  }

  static async verifyToken(token) {
    const row = await this.getByToken(token);
    if (!row) return null;
    if (new Date(row.expires_at).getTime() < Date.now()) {
      return { expired: true, row };
    }

    await run(
      `UPDATE calendar_verifications
       SET status = 'verified', verified_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE token = ?`,
      [token]
    );
    return { expired: false, row };
  }
}

module.exports = CalendarVerificationModel;
