/**
 * Migration: Create users table
 */
const { runAsync } = require('../seedHelpers');

const migrationName = 'create_users_table';

const up = async () => {
  console.log('[Migration users] Starting...');

  await runAsync(
    `DROP TABLE IF EXISTS users`
  );

  await runAsync(`
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_uuid VARCHAR(255) UNIQUE,
    company_id INT,
    role_id INT,
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    phone VARCHAR(50),
    profile_image TEXT,
    status VARCHAR(50) DEFAULT 'active',
    is_active TINYINT(1) DEFAULT 1,
    email_verified TINYINT(1) DEFAULT 0,
    email_verified_at DATETIME,
    last_login_at DATETIME,
    is_deleted TINYINT(1) DEFAULT 0,
    deleted_at DATETIME DEFAULT NULL,
    created_by INT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_by INT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_users_company (company_id),
    INDEX idx_users_role (role_id),
    INDEX idx_users_email (email),
    INDEX idx_users_status (status),
    INDEX idx_users_deleted_at (deleted_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`);

  console.log('[Migration users] Complete.');
};

const down = async () => {
  await runAsync(`DROP TABLE IF EXISTS users`);
  console.log('[Migration users] Rolled back — users dropped.');
};

module.exports = { up, down, migrationName };
