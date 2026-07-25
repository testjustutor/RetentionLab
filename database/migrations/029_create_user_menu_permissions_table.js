/**
 * Migration: Create user_menu_permissions table
 * User-specific overrides for menu item visibility and sort order
 */
const { runAsync } = require('../seedHelpers');

const migrationName = 'create_user_menu_permissions_table';

const up = async () => {
  console.log('[Migration user_menu_permissions] Starting...');

  await runAsync(`DROP TABLE IF EXISTS user_menu_permissions`);

  await runAsync(`
    CREATE TABLE IF NOT EXISTS user_menu_permissions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      menu_item_id INT NOT NULL,
      parent_id INT DEFAULT NULL,
      is_visible TINYINT(1) DEFAULT 1,
      sort_order INT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY unique_user_menu (user_id, menu_item_id),
      INDEX idx_user (user_id),
      INDEX idx_menu_item (menu_item_id),
      INDEX idx_parent (parent_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE,
      FOREIGN KEY (parent_id) REFERENCES user_menu_permissions(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('[Migration user_menu_permissions] Complete.');
};

const down = async () => {
  await runAsync(`DROP TABLE IF EXISTS user_menu_permissions`);
  console.log('[Migration user_menu_permissions] Rolled back — user_menu_permissions dropped.');
};

module.exports = { up, down, migrationName };