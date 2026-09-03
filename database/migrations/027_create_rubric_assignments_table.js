/**
 * Migration: Create rubric_assignments table
 */
const { runAsync } = require('../seedHelpers');

const migrationName = 'create_rubric_assignments_table';

const up = async () => {
  console.log('[Migration rubric_assignments] Starting...');

  await runAsync(
    `DROP TABLE IF EXISTS rubric_assignments`
  );

  await runAsync(`
CREATE TABLE IF NOT EXISTS rubric_assignments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id INT,
    rubric_type VARCHAR(50) DEFAULT 'default',
    rubric_id INT,
    category_id VARCHAR(255) NOT NULL,
    admin_user_id INT NOT NULL,
    assigned_by INT NOT NULL,
    created_by INT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_ra_category (category_id),
    INDEX idx_ra_admin (admin_user_id),
    INDEX idx_ra_assigned (assigned_by),
    UNIQUE KEY unique_category_admin (category_id, admin_user_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`);

  console.log('[Migration rubric_assignments] Complete.');
};

const down = async () => {
  await runAsync(`DROP TABLE IF EXISTS rubric_assignments`);
  console.log('[Migration rubric_assignments] Rolled back — rubric_assignments dropped.');
};

module.exports = { up, down, migrationName };
