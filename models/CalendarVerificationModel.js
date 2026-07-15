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

  static async updateTokenByEmail(email, token) {
    // Ensures the DB row uses the SAME token value that is placed in the verification URL.
    // This is required because verifyToken() primarily looks up by `calendar_verifications.token`.
    await run(
      `UPDATE calendar_verifications
       SET token = ?, updated_at = CURRENT_TIMESTAMP
       WHERE email = ? 
       ORDER BY created_at DESC
       LIMIT 1`,
      [token, email]
    );
  }


  static async create(email, ttlMinutes = 30) {
    const token = crypto.randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString();
    await run(
      `INSERT INTO calendar_verifications (email, token, status, expires_at, created_at, updated_at)
       VALUES (?, ?, 'pending', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON DUPLICATE KEY UPDATE
         token = VALUES(token),
         status = CASE WHEN status = 'verified' THEN 'verified' ELSE 'pending' END,
         expires_at = VALUES(expires_at),
         verified_at = CASE WHEN status = 'verified' THEN verified_at ELSE NULL END,
         updated_at = CURRENT_TIMESTAMP`,
      [email, token, expiresAt]
    );
    return { email, token, expiresAt };
  }

  static async getByToken(token) {
    return get(`SELECT * FROM calendar_verifications WHERE token = ? LIMIT 1`, [token]);
  }

  static async getByEmail(email) {
    return get(`SELECT * FROM calendar_verifications WHERE email = ? ORDER BY created_at DESC LIMIT 1`, [email]);
  }

  static async verifyToken(token) {
    // Try lookup by token first (legacy/compatibility)
    let row = await this.getByToken(token);
    let whereClause = 'token = ?';
    let params = [token];

    // If not found by token, try to extract email from JWT payload
    if (!row) {
      try {
        const jwt = require('jsonwebtoken');
        const VERIFY_SECRET = process.env.INSTRUCTOR_CALENDAR_SECRET || process.env.JWT_SECRET || 'instructor_cal_secure_key_change_me';
        const payload = jwt.verify(token, VERIFY_SECRET);
        if (payload?.email) {
          row = await this.getByEmail(payload.email);
          if (row) {
            whereClause = 'email = ?';
            params = [payload.email];
          }
        }
      } catch (e) {
        // Invalid JWT or not found
      }
    }

    if (!row) return null;
    if (new Date(row.expires_at).getTime() < Date.now()) {
      return { expired: true, row };
    }

    await run(
      `UPDATE calendar_verifications
       SET status = 'verified', verified_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE ${whereClause}`,
      params
    );
    return { expired: false, row };
  }
}

module.exports = CalendarVerificationModel;
