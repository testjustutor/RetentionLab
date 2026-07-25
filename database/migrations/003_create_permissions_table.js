/**
 * Migration: Create permissions table
 */
const { runAsync } = require('../seedHelpers');

const migrationName = 'create_permissions_table';

const up = async () => {
  console.log('[Migration permissions] Starting...');

  await runAsync(
    `DROP TABLE IF EXISTS permissions`
  );

  await runAsync(`
CREATE TABLE IF NOT EXISTS permissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    permission_key VARCHAR(255) UNIQUE NOT NULL,
    label VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`);

  console.log('[Migration permissions] Complete.');
};

const down = async () => {
  await runAsync(`DROP TABLE IF EXISTS permissions`);
  console.log('[Migration permissions] Rolled back — permissions dropped.');
};

module.exports = { up, down, migrationName };
