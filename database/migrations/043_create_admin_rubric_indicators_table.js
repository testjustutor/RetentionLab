/**
 * Migration: Create admin_rubric_indicators table
 */
const { runAsync } = require('../seedHelpers');

const migrationName = 'create_admin_rubric_indicators_table';

const up = async () => {
  console.log('[Migration admin_rubric_indicators] Starting...');

  await runAsync(
    `DROP TABLE IF EXISTS admin_rubric_indicators`
  );

  await runAsync(`
    CREATE TABLE IF NOT EXISTS admin_rubric_indicators (
      id INT AUTO_INCREMENT PRIMARY KEY,
      original_indicator_id VARCHAR(255) NOT NULL,
      original_category_id VARCHAR(10) NOT NULL,
      admin_user_id INT NOT NULL,
      source ENUM('master', 'custom') DEFAULT 'master',
      name VARCHAR(255) NOT NULL,
      type ENUM('AI', 'HUMAN') DEFAULT 'HUMAN',
      is_gate TINYINT(1) DEFAULT 0,
      value DECIMAL(5,2) DEFAULT 1,
      description TEXT,
      status VARCHAR(50) DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY unique_admin_indicator (original_indicator_id, admin_user_id),
      INDEX idx_ari_admin (admin_user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('[Migration admin_rubric_indicators] Complete.');
};

const down = async () => {
  await runAsync(`DROP TABLE IF EXISTS admin_rubric_indicators`);
  console.log('[Migration admin_rubric_indicators] Rolled back — admin_rubric_indicators dropped.');
};

module.exports = { up, down, migrationName };