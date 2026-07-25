/**
 * Migration: Create header_page_configs table
 */
const { runAsync } = require('../seedHelpers');

const migrationName = 'create_header_page_configs_table';

const up = async () => {
  console.log('[Migration header_page_configs] Starting...');

  await runAsync(
    `DROP TABLE IF EXISTS header_page_configs`
  );

  await runAsync(`
CREATE TABLE IF NOT EXISTS header_page_configs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    role_id INT,
    page_key VARCHAR(255),
    title VARCHAR(500),
    description TEXT,
    role_title VARCHAR(255),
    show_stats TINYINT(1) DEFAULT 0,
    buttons_json JSON,
    is_active TINYINT(1) DEFAULT 1,
    is_deleted TINYINT(1) DEFAULT 0,
    deleted_at DATETIME DEFAULT NULL,
    created_by INT,
    updated_by INT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_hpc_role (role_id),
    INDEX idx_hpc_page (page_key),
    INDEX idx_hpc_deleted_at (deleted_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`);

  console.log('[Migration header_page_configs] Complete.');
};

const down = async () => {
  await runAsync(`DROP TABLE IF EXISTS header_page_configs`);
  console.log('[Migration header_page_configs] Rolled back — header_page_configs dropped.');
};

module.exports = { up, down, migrationName };
