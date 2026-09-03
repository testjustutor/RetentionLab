/**
 * Migration: Create header_role_configs table
 */
const { runAsync } = require('../seedHelpers');

const migrationName = 'create_header_role_configs_table';

const up = async () => {
  console.log('[Migration header_role_configs] Starting...');

  await runAsync(
    `DROP TABLE IF EXISTS header_role_configs`
  );

  await runAsync(`
CREATE TABLE IF NOT EXISTS header_role_configs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    role_id INT,
    home_href VARCHAR(500),
    home_label VARCHAR(255),
    events_href VARCHAR(500),
    events_label VARCHAR(255),
    archives_href VARCHAR(500),
    archives_label VARCHAR(255),
    profile_href VARCHAR(500),
    profile_label VARCHAR(255),
    settings_href VARCHAR(500),
    settings_label VARCHAR(255),
    is_active TINYINT(1) DEFAULT 1,
    is_deleted TINYINT(1) DEFAULT 0,
    deleted_at DATETIME DEFAULT NULL,
    created_by INT,
    updated_by INT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_hrc_role (role_id),
    INDEX idx_hrc_deleted_at (deleted_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`);

  console.log('[Migration header_role_configs] Complete.');
};

const down = async () => {
  await runAsync(`DROP TABLE IF EXISTS header_role_configs`);
  console.log('[Migration header_role_configs] Rolled back — header_role_configs dropped.');
};

module.exports = { up, down, migrationName };
