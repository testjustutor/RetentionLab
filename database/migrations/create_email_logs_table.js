/**
 * Migration: Create email_logs table
 * Tracks all emails sent from the system with sender, receiver, subject, purpose, and status
 */
const { db } = require('../db');

const createEmailLogsTable = () => {
  return new Promise((resolve, reject) => {
    db.run(`
      CREATE TABLE IF NOT EXISTS email_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        sender_email VARCHAR(255) NOT NULL,
        receiver_email VARCHAR(255) NOT NULL,
        subject VARCHAR(500) NOT NULL,
        purpose VARCHAR(100) NOT NULL COMMENT 'calendar_integration, email_verification, password_reset, etc.',
        status ENUM('pending', 'sent', 'failed') DEFAULT 'pending',
        error_message TEXT NULL,
        sent_at DATETIME NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_receiver_email (receiver_email),
        INDEX idx_purpose (purpose),
        INDEX idx_status (status),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `, (err) => {
      if (err) return reject(err);
      console.log('[Migration] email_logs table created/verified');
      resolve();
    });
  });
};

module.exports = { createEmailLogsTable };