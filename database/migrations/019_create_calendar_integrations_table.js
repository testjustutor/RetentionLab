/**
 * Migration: Create calendar_integrations table
 */
const { runAsync } = require('../seedHelpers');

const migrationName = 'create_calendar_integrations_table';

const up = async () => {
  console.log('[Migration calendar_integrations] Starting...');

  await runAsync(
    `DROP TABLE IF EXISTS calendar_integrations`
  );

  await runAsync(`
CREATE TABLE IF NOT EXISTS calendar_integrations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    platform VARCHAR(50),
    access_token TEXT,
    refresh_token TEXT,
    expires_at DATETIME,
    status VARCHAR(50) DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_ci_user (user_id),
    INDEX idx_ci_platform (platform)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`);

  console.log('[Migration calendar_integrations] Complete.');
};

const down = async () => {
  await runAsync(`DROP TABLE IF EXISTS calendar_integrations`);
  console.log('[Migration calendar_integrations] Rolled back — calendar_integrations dropped.');
};

module.exports = { up, down, migrationName };
