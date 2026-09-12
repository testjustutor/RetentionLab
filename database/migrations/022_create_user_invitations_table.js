/**
 * Migration: Create user_invitations table
 */
const { runAsync } = require('../seedHelpers');

const migrationName = 'create_user_invitations_table';

const up = async () => {
  console.log('[Migration user_invitations] Starting...');

  await runAsync(
    `DROP TABLE IF EXISTS user_invitations`
  );

  await runAsync(`
CREATE TABLE IF NOT EXISTS user_invitations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    token VARCHAR(255) UNIQUE NOT NULL,
    role_id INT,
    company_id INT,
    invited_by INT,
    status VARCHAR(50) DEFAULT 'pending',
    expires_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_ui_email (email),
    INDEX idx_ui_token (token),
    INDEX idx_ui_status (status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`);

  console.log('[Migration user_invitations] Complete.');
};

const down = async () => {
  await runAsync(`DROP TABLE IF EXISTS user_invitations`);
  console.log('[Migration user_invitations] Rolled back — user_invitations dropped.');
};

module.exports = { up, down, migrationName };
