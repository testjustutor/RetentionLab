/**
 * Migration: Create departments table
 * Includes all columns from subsequent fix migrations (064)
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
    created_by INT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    deleted_at DATETIME DEFAULT NULL,
    deleted_by INT DEFAULT NULL,
    updated_by INT DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_dept_company (company_id),
    INDEX idx_dept_deleted_at (deleted_at),
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (deleted_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`);

  console.log('[Migration departments] Complete.');
};

const down = async () => {
  await runAsync(`DROP TABLE IF EXISTS departments`);
  console.log('[Migration departments] Rolled back — departments dropped.');
};

module.exports = { up, down, migrationName };