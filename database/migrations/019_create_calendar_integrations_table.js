/**
 * Migration: Create calendar_integrations table
 * Includes all columns from subsequent fix migrations (060, 063, 064)
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
    provider VARCHAR(50) DEFAULT 'google',
    provider_id INT DEFAULT NULL,
    access_token TEXT,
    refresh_token TEXT,
    expires_at DATETIME,
    token_expiry DATETIME,
    status VARCHAR(50) DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_user_provider (user_id, provider_id),
    INDEX idx_ci_user (user_id),
    INDEX idx_ci_platform (platform),
    INDEX idx_ci_provider (provider),
    INDEX idx_ci_provider_id (provider_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (provider_id) REFERENCES calendar_providers(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`);

  console.log('[Migration calendar_integrations] Complete.');
};

const down = async () => {
  await runAsync(`DROP TABLE IF EXISTS calendar_integrations`);
  console.log('[Migration calendar_integrations] Rolled back — calendar_integrations dropped.');
};

module.exports = { up, down, migrationName };