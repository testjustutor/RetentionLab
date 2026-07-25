/**
 * Migration: Create menu_items table
 * Master list of all possible sidebar menu items
 */
const { runAsync } = require('../seedHelpers');

const migrationName = 'create_menu_items_table';

const up = async () => {
  console.log('[Migration menu_items] Starting...');

  await runAsync(`DROP TABLE IF EXISTS menu_items`);

  await runAsync(`
    CREATE TABLE IF NOT EXISTS menu_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      menu_key VARCHAR(100) UNIQUE NOT NULL,
      label VARCHAR(255) NOT NULL,
      icon VARCHAR(100),
      route_path VARCHAR(500),
      parent_id INT NULL,
      sort_order INT DEFAULT 0,
      is_active TINYINT(1) DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_parent (parent_id),
      INDEX idx_sort (sort_order),
      INDEX idx_active (is_active),
      FOREIGN KEY (parent_id) REFERENCES menu_items(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('[Migration menu_items] Complete.');
};

const down = async () => {
  await runAsync(`DROP TABLE IF EXISTS menu_items`);
  console.log('[Migration menu_items] Rolled back — menu_items dropped.');
};

module.exports = { up, down, migrationName };