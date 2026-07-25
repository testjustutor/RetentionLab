/**
 * Migration: Create role_menu_permissions table
 * Maps roles to menu items with visibility and sort order defaults
 */
const { runAsync } = require('../seedHelpers');

const migrationName = 'create_role_menu_permissions_table';

const up = async () => {
  console.log('[Migration role_menu_permissions] Starting...');

  await runAsync(`DROP TABLE IF EXISTS role_menu_permissions`);

  await runAsync(`
    CREATE TABLE IF NOT EXISTS role_menu_permissions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      role_id INT NOT NULL,
      menu_item_id INT NOT NULL,
      is_visible TINYINT(1) DEFAULT 1,
      sort_order INT DEFAULT 0,
      parent_id INT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY unique_role_menu (role_id, menu_item_id),
      INDEX idx_role (role_id),
      INDEX idx_menu_item (menu_item_id),
      INDEX idx_parent (parent_id),
      FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
      FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE,
      FOREIGN KEY (parent_id) REFERENCES role_menu_permissions(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('[Migration role_menu_permissions] Complete.');
};

const down = async () => {
  await runAsync(`DROP TABLE IF EXISTS role_menu_permissions`);
  console.log('[Migration role_menu_permissions] Rolled back — role_menu_permissions dropped.');
};

module.exports = { up, down, migrationName };