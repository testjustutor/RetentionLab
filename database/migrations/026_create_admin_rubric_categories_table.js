/**
 * Migration: Create admin_rubric_categories table
 */
const { runAsync } = require('../seedHelpers');
const migrationName = 'create_admin_rubric_categories_table';
const up = async () => {
  console.log('[Migration admin_rubric_categories] Starting...');
  await runAsync(
    `DROP TABLE IF EXISTS admin_rubric_categories`
  );
  await runAsync(`
    CREATE TABLE IF NOT EXISTS admin_rubric_categories (
      id INT AUTO_INCREMENT PRIMARY KEY,
      master_category_id INT NULL,
      category_code VARCHAR(10) NOT NULL,
      admin_user_id INT NOT NULL,
      source ENUM('master', 'custom') DEFAULT 'master',
      name VARCHAR(255) NOT NULL,
      weight DECIMAL(5,2) NOT NULL DEFAULT 0,
      status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_arc_admin (admin_user_id),
      INDEX idx_arc_master_category_id (master_category_id),
      INDEX idx_arc_category_code (category_code),
      UNIQUE KEY uq_arc_admin_category (admin_user_id, master_category_id),
      CONSTRAINT fk_arc_master_category_id
        FOREIGN KEY (master_category_id) REFERENCES rubric_categories(id)
        ON UPDATE CASCADE ON DELETE SET NULL,
      CONSTRAINT fk_arc_category_code
        FOREIGN KEY (category_code) REFERENCES rubric_categories(category_code)
        ON UPDATE CASCADE ON DELETE CASCADE
      -- If you have a users/admins table, uncomment and adjust:
      -- , CONSTRAINT fk_arc_admin_user
      --     FOREIGN KEY (admin_user_id) REFERENCES admin_users(id)
      --     ON UPDATE CASCADE ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('[Migration admin_rubric_categories] Complete.');
};
const down = async () => {
  await runAsync(`DROP TABLE IF EXISTS admin_rubric_categories`);
  console.log('[Migration admin_rubric_categories] Rolled back — admin_rubric_categories dropped.');
};
module.exports = { up, down, migrationName };