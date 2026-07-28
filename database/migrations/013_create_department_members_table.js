/**
 * Migration: Create department_members table
 * Includes all columns from subsequent fix migrations (061)
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
    role_id INT DEFAULT NULL,
    joined_by INT DEFAULT NULL,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) DEFAULT 'active',
    created_by INT DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_by INT DEFAULT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME,
    deleted_by INT,
    UNIQUE KEY unique_dept_user (department_id, user_id),
    INDEX idx_dm_department (department_id),
    INDEX idx_dm_user (user_id),
    INDEX idx_dm_role_id (role_id),
    INDEX idx_dm_status (status),
    INDEX idx_dm_deleted_at (deleted_at),
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (deleted_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (joined_by) REFERENCES users(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`);

  console.log('[Migration department_members] Complete.');
};

const down = async () => {
  await runAsync(`DROP TABLE IF EXISTS department_members`);
  console.log('[Migration department_members] Rolled back — department_members dropped.');
};

module.exports = { up, down, migrationName };