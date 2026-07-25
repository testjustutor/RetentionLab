/**
 * Migration: Create department_members table
 */
const { runAsync } = require('../seedHelpers');

const migrationName = 'create_department_members_table';

const up = async () => {
  console.log('[Migration department_members] Starting...');

  await runAsync(
    `DROP TABLE IF EXISTS department_members`
  );

  await runAsync(`
CREATE TABLE IF NOT EXISTS department_members (
    id INT AUTO_INCREMENT PRIMARY KEY,
    department_id INT NOT NULL,
    user_id INT NOT NULL,
    role VARCHAR(50) DEFAULT 'member',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_dept_user (department_id, user_id),
    INDEX idx_dm_department (department_id),
    INDEX idx_dm_user (user_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`);

  console.log('[Migration department_members] Complete.');
};

const down = async () => {
  await runAsync(`DROP TABLE IF EXISTS department_members`);
  console.log('[Migration department_members] Rolled back — department_members dropped.');
};

module.exports = { up, down, migrationName };
