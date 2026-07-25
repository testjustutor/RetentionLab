/**
 * Migration: Create calendar_providers table
 */
const { runAsync } = require('../seedHelpers');

const migrationName = 'create_calendar_providers_table';

const up = async () => {
  console.log('[Migration calendar_providers] Starting...');

  await runAsync(
    `DROP TABLE IF EXISTS calendar_providers`
  );

  await runAsync(`
CREATE TABLE IF NOT EXISTS calendar_providers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    display_name VARCHAR(255),
    is_active TINYINT(1) DEFAULT 1,
    config_json JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`);

  console.log('[Migration calendar_providers] Complete.');
};

const down = async () => {
  await runAsync(`DROP TABLE IF EXISTS calendar_providers`);
  console.log('[Migration calendar_providers] Rolled back — calendar_providers dropped.');
};

module.exports = { up, down, migrationName };
