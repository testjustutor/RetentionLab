/**
 * Migration: Create companies table
 */
const { runAsync } = require('../seedHelpers');

const migrationName = 'create_companies_table';

const up = async () => {
  console.log('[Migration companies] Starting...');

  await runAsync(
    `DROP TABLE IF EXISTS companies`
  );

  await runAsync(`
CREATE TABLE IF NOT EXISTS companies (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_uuid VARCHAR(255) UNIQUE,
    company_name VARCHAR(255) NOT NULL,
    company_code VARCHAR(100) UNIQUE,
    domain VARCHAR(255),
    logo_url TEXT,
    status VARCHAR(50) DEFAULT 'active',
    deleted_at DATETIME DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_status (status),
    INDEX idx_deleted_at (deleted_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`);

  console.log('[Migration companies] Complete.');
};

const down = async () => {
  await runAsync(`DROP TABLE IF EXISTS companies`);
  console.log('[Migration companies] Rolled back — companies dropped.');
};

module.exports = { up, down, migrationName };
