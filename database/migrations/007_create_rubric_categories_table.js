/**
 * Migration: Create rubric_categories table
 */
const { runAsync } = require('../seedHelpers');
const migrationName = 'create_rubric_categories_table';
const up = async () => {
  console.log('[Migration rubric_categories] Starting...');
  await runAsync(
    `DROP TABLE IF EXISTS rubric_categories`
  );
  await runAsync(`
CREATE TABLE IF NOT EXISTS rubric_categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    category_id VARCHAR(10) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    weight DECIMAL(5,2) NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`);
  console.log('[Migration rubric_categories] Complete.');
};
const down = async () => {
  await runAsync(`DROP TABLE IF EXISTS rubric_categories`);
  console.log('[Migration rubric_categories] Rolled back — rubric_categories dropped.');
};
module.exports = { up, down, migrationName };