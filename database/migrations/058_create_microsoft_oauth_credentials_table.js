/**
 * Migration: Create microsoft_oauth_credentials table
 * Mirrors 021_create_google_oauth_credentials_table.js for the Microsoft
 * (Azure AD / Microsoft Graph) calendar integration. Sensitive values
 * (client_id, client_secret, tenant_id) come from .env — see
 * models/calendar/MicrosoftOAuthCredentialsModel.js — this table only
 * stores non-sensitive, editable config (mirrors the Google table's shape).
 */
const { runAsync } = require('../seedHelpers');

const migrationName = 'create_microsoft_oauth_credentials_table';

const up = async () => {
  console.log('[Migration microsoft_oauth_credentials] Starting...');

  await runAsync(
    `DROP TABLE IF EXISTS microsoft_oauth_credentials`
  );

  await runAsync(`
CREATE TABLE IF NOT EXISTS microsoft_oauth_credentials (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    redirect_uris JSON,
    auth_uri VARCHAR(500),
    token_uri VARCHAR(500),
    scopes JSON,
    is_active TINYINT(1) DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_moc_user (user_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`);

  console.log('[Migration microsoft_oauth_credentials] Complete.');
};

const down = async () => {
  await runAsync(`DROP TABLE IF EXISTS microsoft_oauth_credentials`);
  console.log('[Migration microsoft_oauth_credentials] Rolled back — microsoft_oauth_credentials dropped.');
};

module.exports = { up, down, migrationName };
