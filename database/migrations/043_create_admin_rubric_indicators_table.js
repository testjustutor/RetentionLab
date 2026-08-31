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
      admin_category_id INT NOT NULL,
      master_indicator_id INT NULL,
      indicator_code VARCHAR(255) NOT NULL,
      master_category_id INT NULL,
      category_code VARCHAR(10) NOT NULL,
      admin_user_id INT NOT NULL,
      source ENUM('master', 'custom') DEFAULT 'master',
      subgroup_name VARCHAR(255),
      name VARCHAR(255) NOT NULL,
      type ENUM('AI', 'HUMAN') DEFAULT 'AI',
      is_gate TINYINT(1) DEFAULT 0,
      value INT DEFAULT 1,
      benchmark TEXT,
      requires_video TINYINT(1) DEFAULT 0,
      status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_ari_admin_category_id (admin_category_id),
      FOREIGN KEY (admin_category_id) REFERENCES admin_rubric_categories(id) ON DELETE RESTRICT,
      INDEX idx_ari_admin (admin_user_id),
      INDEX idx_ari_master_indicator_id (master_indicator_id),
      INDEX idx_ari_indicator_code (indicator_code),
      INDEX idx_ari_master_category_id (master_category_id),
      INDEX idx_ari_category_code (category_code),
      UNIQUE KEY uq_ari_admin_indicator (admin_user_id, master_indicator_id),
      CONSTRAINT fk_ari_master_indicator_id
        FOREIGN KEY (master_indicator_id) REFERENCES rubric_indicators(id)
        ON UPDATE CASCADE ON DELETE SET NULL,
      CONSTRAINT fk_ari_indicator_code
        FOREIGN KEY (indicator_code) REFERENCES rubric_indicators(indicator_code)
        ON UPDATE CASCADE ON DELETE CASCADE,
      CONSTRAINT fk_ari_master_category_id
        FOREIGN KEY (master_category_id) REFERENCES rubric_categories(id)
        ON UPDATE CASCADE ON DELETE SET NULL,
      CONSTRAINT fk_ari_category_code
        FOREIGN KEY (category_code) REFERENCES rubric_categories(category_code)
        ON UPDATE CASCADE ON DELETE CASCADE
      -- If you have a users/admins table, uncomment and adjust:
      -- , CONSTRAINT fk_ari_admin_user
      --     FOREIGN KEY (admin_user_id) REFERENCES admin_users(id)
      --     ON UPDATE CASCADE ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('[Migration admin_rubric_indicators] Complete.');
};
const down = async () => {
  await runAsync(`DROP TABLE IF EXISTS admin_rubric_indicators`);
  console.log('[Migration admin_rubric_indicators] Rolled back — admin_rubric_indicators dropped.');
};
module.exports = { up, down, migrationName };