/**
 * Migration: Create calendar_credentials table
 */
const { runAsync } = require('../seedHelpers');

const migrationName = 'create_calendar_credentials_table';

const up = async () => {
  console.log('[Migration calendar_credentials] Starting...');

  await runAsync(
    `DROP TABLE IF EXISTS calendar_credentials`
  );

  await runAsync(`
CREATE TABLE IF NOT EXISTS calendar_credentials (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    provider VARCHAR(50),
    credentials_json JSON,
    is_active TINYINT(1) DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_cc_user (user_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`);

  console.log('[Migration calendar_credentials] Complete.');
};

const down = async () => {
  await runAsync(`DROP TABLE IF EXISTS calendar_credentials`);
  console.log('[Migration calendar_credentials] Rolled back — calendar_credentials dropped.');
};

module.exports = { up, down, migrationName };
