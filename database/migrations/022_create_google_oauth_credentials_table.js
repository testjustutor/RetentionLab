/**
 * Migration: Create google_oauth_credentials table
 */
const { runAsync } = require('../seedHelpers');

const migrationName = 'create_google_oauth_credentials_table';

const up = async () => {
  console.log('[Migration google_oauth_credentials] Starting...');

  await runAsync(
    `DROP TABLE IF EXISTS google_oauth_credentials`
  );

  await runAsync(`
CREATE TABLE IF NOT EXISTS google_oauth_credentials (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    redirect_uris JSON,
    auth_uri VARCHAR(500),
    token_uri VARCHAR(500),
    scopes JSON,
    is_active TINYINT(1) DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_goc_user (user_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`);

  console.log('[Migration google_oauth_credentials] Complete.');
};

const down = async () => {
  await runAsync(`DROP TABLE IF EXISTS google_oauth_credentials`);
  console.log('[Migration google_oauth_credentials] Rolled back — google_oauth_credentials dropped.');
};

module.exports = { up, down, migrationName };
