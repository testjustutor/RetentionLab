/**
 * Migration: Create departments table
 */
const { runAsync } = require('../seedHelpers');

const migrationName = 'create_departments_table';

const up = async () => {
  console.log('[Migration departments] Starting...');

  await runAsync(
    `DROP TABLE IF EXISTS departments`
  );

  await runAsync(`
CREATE TABLE IF NOT EXISTS departments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_dept_company (company_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`);

  console.log('[Migration departments] Complete.');
};

const down = async () => {
  await runAsync(`DROP TABLE IF EXISTS departments`);
  console.log('[Migration departments] Rolled back — departments dropped.');
};

module.exports = { up, down, migrationName };
