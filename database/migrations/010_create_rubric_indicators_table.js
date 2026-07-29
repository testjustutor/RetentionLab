/**
 * Migration: Create rubric_indicators table
 */
const { runAsync } = require('../seedHelpers');
const migrationName = 'create_rubric_indicators_table';
const up = async () => {
  console.log('[Migration rubric_indicators] Starting...');
  await runAsync(
    `DROP TABLE IF EXISTS rubric_indicators`
  );
  await runAsync(`
CREATE TABLE IF NOT EXISTS rubric_indicators (
    id INT AUTO_INCREMENT PRIMARY KEY,
    indicator_id VARCHAR(255) NOT NULL UNIQUE,
    category_id VARCHAR(10),
    name VARCHAR(255) NOT NULL,
    type ENUM('AI', 'HUMAN') DEFAULT 'AI',
    is_gate TINYINT(1) DEFAULT 0,
    value INT DEFAULT 1,
    benchmark TEXT,
    requires_video TINYINT(1) DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_ri_category (category_id),
    FOREIGN KEY (category_id) REFERENCES rubric_categories(category_id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`);
  console.log('[Migration rubric_indicators] Complete.');
};
const down = async () => {
  await runAsync(`DROP TABLE IF EXISTS rubric_indicators`);
  console.log('[Migration rubric_indicators] Rolled back — rubric_indicators dropped.');
};
module.exports = { up, down, migrationName };