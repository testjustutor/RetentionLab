/**
 * Migration: Create role_permissions table
 */
const { runAsync } = require('../seedHelpers');

const migrationName = 'create_role_permissions_table';

const up = async () => {
  console.log('[Migration role_permissions] Starting...');

  await runAsync(
    `DROP TABLE IF EXISTS role_permissions`
  );

  await runAsync(`
CREATE TABLE IF NOT EXISTS role_permissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    role_id INT NOT NULL,
    permission_id INT NOT NULL,
    company_id INT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_role_perm (role_id, permission_id, company_id),
    INDEX idx_rp_role (role_id),
    INDEX idx_rp_permission (permission_id),
    INDEX idx_rp_company (company_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`);

  console.log('[Migration role_permissions] Complete.');
};

const down = async () => {
  await runAsync(`DROP TABLE IF EXISTS role_permissions`);
  console.log('[Migration role_permissions] Rolled back — role_permissions dropped.');
};

module.exports = { up, down, migrationName };
