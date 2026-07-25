/**
 * Migration: Create header_configs table
 */
const { runAsync } = require('../seedHelpers');

const migrationName = 'create_header_configs_table';

const up = async () => {
  console.log('[Migration header_configs] Starting...');

  await runAsync(
    `DROP TABLE IF EXISTS header_configs`
  );

  await runAsync(`
CREATE TABLE IF NOT EXISTS header_configs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    config_key VARCHAR(255) UNIQUE NOT NULL,
    config_json JSON NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`);

  console.log('[Migration header_configs] Complete.');
};

const down = async () => {
  await runAsync(`DROP TABLE IF EXISTS header_configs`);
  console.log('[Migration header_configs] Rolled back — header_configs dropped.');
};

module.exports = { up, down, migrationName };