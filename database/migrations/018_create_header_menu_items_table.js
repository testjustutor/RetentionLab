/**
 * Migration: Create header_menu_items table
 */
const { runAsync } = require('../seedHelpers');

const migrationName = 'create_header_menu_items_table';

const up = async () => {
  console.log('[Migration header_menu_items] Starting...');

  await runAsync(
    `DROP TABLE IF EXISTS header_menu_items`
  );

  await runAsync(`
CREATE TABLE IF NOT EXISTS header_menu_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    role_id INT,
    menu_id VARCHAR(255),
    parent_id VARCHAR(255),
    label VARCHAR(255),
    icon VARCHAR(100),
    href VARCHAR(500),
    display_order INT DEFAULT 0,
    is_active TINYINT(1) DEFAULT 1,
    section VARCHAR(100) DEFAULT 'main',
    color VARCHAR(50) DEFAULT 'violet',
    is_deleted TINYINT(1) DEFAULT 0,
    deleted_at DATETIME DEFAULT NULL,
    created_by INT,
    updated_by INT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_hmi_role (role_id),
    INDEX idx_hmi_parent (parent_id),
    INDEX idx_hmi_deleted_at (deleted_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`);

  console.log('[Migration header_menu_items] Complete.');
};

const down = async () => {
  await runAsync(`DROP TABLE IF EXISTS header_menu_items`);
  console.log('[Migration header_menu_items] Rolled back — header_menu_items dropped.');
};

module.exports = { up, down, migrationName };
