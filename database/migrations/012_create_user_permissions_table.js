/**
 * Migration: Create user_permissions table
 */
const { runAsync } = require('../seedHelpers');

const migrationName = 'create_user_permissions_table';

const up = async () => {
  console.log('[Migration user_permissions] Starting...');

  await runAsync(
    `DROP TABLE IF EXISTS user_permissions`
  );

  await runAsync(`
CREATE TABLE IF NOT EXISTS user_permissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    permission_id INT NOT NULL,
    company_id INT,
    granted_by INT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_user_perm (user_id, permission_id, company_id),
    INDEX idx_up_user (user_id),
    INDEX idx_up_permission (permission_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`);

  console.log('[Migration user_permissions] Complete.');
};

const down = async () => {
  await runAsync(`DROP TABLE IF EXISTS user_permissions`);
  console.log('[Migration user_permissions] Rolled back — user_permissions dropped.');
};

module.exports = { up, down, migrationName };
