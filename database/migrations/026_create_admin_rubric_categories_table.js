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
      original_category_id VARCHAR(10) NOT NULL,
      admin_user_id INT NOT NULL,
      source ENUM('master', 'custom') DEFAULT 'master',
      name TEXT NOT NULL,
      weight DOUBLE DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_arc_admin (admin_user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('[Migration admin_rubric_categories] Complete.');
};

const down = async () => {
  await runAsync(`DROP TABLE IF EXISTS admin_rubric_categories`);
  console.log('[Migration admin_rubric_categories] Rolled back — admin_rubric_categories dropped.');
};

module.exports = { up, down, migrationName };