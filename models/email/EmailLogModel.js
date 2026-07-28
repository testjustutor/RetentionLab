/**
 * root/models/EmailLogModel.js
 * Tracks all emails sent from the system
 */
const { db } = require('../../database/db');

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

class EmailLogModel {
  static async createTable() {
    // Table created via migration
    return Promise.resolve();
  }

  /**
   * Log an email that was sent
   * @param {Object} data
   * @param {string} data.sender_email - From email address
   * @param {string} data.receiver_email - To email address
   * @param {string} data.subject - Email subject
   * @param {string} data.body - Email body content
   * @param {string} data.purpose - Purpose: calendar_integration, email_verification, password_reset, etc.
   * @param {string} data.status - 'sent' or 'failed'
   * @param {string} [data.error_message] - Error message if failed
   * @returns {Promise<{id: number}>}
   */
  static async log({ sender_email, receiver_email, subject, body, purpose, status, error_message = null }) {
    const sentAt = status === 'sent' ? new Date().toISOString() : null;
    
    const result = await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO email_logs (recipient, subject, body, status, sent_at, error_message)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [receiver_email, subject, body || '', status, sentAt, error_message],
        function (err) {
          if (err) return reject(err);
          resolve({ id: this.lastID });
        }
      );
    });
    
    return result;
  }

  /**
   * Get all email logs with optional filters
   */
  static async getAll(filters = {}) {
    const { purpose, status, receiver_email, limit = 100, offset = 0 } = filters;
    
    let whereClause = 'WHERE 1=1';
    const params = [];
    
    if (purpose) {
      whereClause += ' AND subject LIKE ?';
      params.push(`%${purpose}%`);
    }
    if (status) {
      whereClause += ' AND status = ?';
      params.push(status);
    }
    if (receiver_email) {
      whereClause += ' AND recipient = ?';
      params.push(receiver_email);
    }
    
    const rows = await new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM email_logs
         ${whereClause}
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`,
        [...params, limit, offset],
        (err, rows) => {
          if (err) return reject(err);
          resolve(rows || []);
        }
      );
    });
    
    return rows;
  }

  /**
   * Get email log by ID
   */
  static async getById(id) {
    return get(`SELECT * FROM email_logs WHERE id = ? LIMIT 1`, [id]);
  }

  /**
   * Get email logs by receiver email
   */
  static async getByReceiverEmail(email, limit = 50) {
    return get(`SELECT * FROM email_logs WHERE recipient = ? ORDER BY created_at DESC LIMIT ?`, [email, limit]);
  }

  /**
   * Get email logs by purpose
   */
  static async getByPurpose(purpose, limit = 50) {
    return get(`SELECT * FROM email_logs WHERE subject LIKE ? ORDER BY created_at DESC LIMIT ?`, [`%${purpose}%`, limit]);
  }

  /**
   * Get email statistics
   */
  static async getStats() {
    const stats = await new Promise((resolve, reject) => {
      db.all(
        `SELECT 
          purpose,
          status,
          COUNT(*) as count,
          DATE(created_at) as date
        FROM email_logs
        GROUP BY purpose, status, DATE(created_at)
        ORDER BY date DESC, purpose`,
        (err, rows) => {
          if (err) return reject(err);
          resolve(rows || []);
        }
      );
    });
    
    return stats;
  }
}

module.exports = EmailLogModel;