/**
 * Migration: Create email_logs table
 */
const { runAsync } = require('../seedHelpers');

const migrationName = 'create_email_logs_table';

const up = async () => {
  console.log('[Migration email_logs] Starting...');

  await runAsync(
    `DROP TABLE IF EXISTS email_logs`
  );

  await runAsync(`
CREATE TABLE IF NOT EXISTS email_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    recipient VARCHAR(255),
    subject VARCHAR(500),
    body TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    sent_at DATETIME,
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_el_recipient (recipient),
    INDEX idx_el_status (status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`);

  console.log('[Migration email_logs] Complete.');
};

const down = async () => {
  await runAsync(`DROP TABLE IF EXISTS email_logs`);
  console.log('[Migration email_logs] Rolled back — email_logs dropped.');
};

module.exports = { up, down, migrationName };
