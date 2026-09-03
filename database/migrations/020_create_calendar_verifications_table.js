/**
 * Migration: Create calendar_verifications table
 * Includes all columns from subsequent fix migrations (066)
 */
const { runAsync } = require('../seedHelpers');

const migrationName = 'create_calendar_verifications_table';

const up = async () => {
  console.log('[Migration calendar_verifications] Starting...');

  await runAsync(
    `DROP TABLE IF EXISTS calendar_verifications`
  );

  await runAsync(`
CREATE TABLE IF NOT EXISTS calendar_verifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    provider VARCHAR(50) DEFAULT NULL,
    code VARCHAR(255),
    token TEXT DEFAULT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    expires_at DATETIME DEFAULT NULL,
    verified_at DATETIME DEFAULT NULL,
    connected_at DATETIME DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_user_provider (user_id, provider),
    INDEX idx_cv_user (user_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`);

  console.log('[Migration calendar_verifications] Complete.');
};

const down = async () => {
  await runAsync(`DROP TABLE IF EXISTS calendar_verifications`);
  console.log('[Migration calendar_verifications] Rolled back — calendar_verifications dropped.');
};

module.exports = { up, down, migrationName };