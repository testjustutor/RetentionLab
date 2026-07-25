/**
 * Migration: Create roles table
 */
const { runAsync } = require('../seedHelpers');

const migrationName = 'create_roles_table';

const up = async () => {
  console.log('[Migration roles] Starting...');

  await runAsync(
    `DROP TABLE IF EXISTS roles`
  );

  await runAsync(`
CREATE TABLE IF NOT EXISTS roles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    role_name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`);

  console.log('[Migration roles] Complete.');
};

const down = async () => {
  await runAsync(`DROP TABLE IF EXISTS roles`);
  console.log('[Migration roles] Rolled back — roles dropped.');
};

module.exports = { up, down, migrationName };
