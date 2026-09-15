/**
 * Migration: Create calendar_connections table
 *
 * Merges `calendar_integrations` (OAuth connection side) and
 * `calendar_verifications` (email-verification side) into ONE table, then
 * DROPS both old tables (data is temporary - no safety net needed).
 * `platform` and `provider` are intentionally dropped (same concept); the
 * identity/linkage is via `provider_id` from calendar_providers.
 *
 * Field mapping:
 *  - status  -> connection_status (active/invalid) + verification_status (pending/verified/expired/connected)
 *  - expires_at -> token_expires_at (OAuth) + verification_expires_at (link)
 *  - token_expiry (redundant with expires_at) -> collapsed into token_expires_at
 *  - provider/platform -> dropped; provider_id is the identity key
 */
const { runAsync } = require('../seedHelpers');

const migrationName = 'create_calendar_connections_table';

const up = async () => {
  console.log('[Migration calendar_connections] Starting...');

  // 1. Create the merged table
  await runAsync(`
    CREATE TABLE IF NOT EXISTS calendar_connections (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT,
        provider_id INT DEFAULT NULL,
        access_token TEXT,
        refresh_token TEXT,
        token_expires_at DATETIME DEFAULT NULL,
        connection_status VARCHAR(50) DEFAULT 'active',
        code VARCHAR(255),
        verification_token TEXT DEFAULT NULL,
        verification_status VARCHAR(50) DEFAULT 'pending',
        verification_expires_at DATETIME DEFAULT NULL,
        verified_at DATETIME DEFAULT NULL,
        connected_at DATETIME DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_cc_user_provider_id (user_id, provider_id),
        INDEX idx_cc_user (user_id),
        INDEX idx_cc_provider_id (provider_id),
        INDEX idx_cc_connection_status (connection_status),
        INDEX idx_cc_verification_status (verification_status),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (provider_id) REFERENCES calendar_providers(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // 2. Backfill pass 1 - every calendar_integrations row (connection side).
  await runAsync(`
    INSERT INTO calendar_connections (
        user_id, provider_id,
        access_token, refresh_token, token_expires_at, connection_status,
        created_at, updated_at
    )
    SELECT
        ci.user_id, ci.provider_id,
        ci.access_token, ci.refresh_token,
        COALESCE(ci.expires_at, ci.token_expiry),
        COALESCE(ci.status, 'active'),
        ci.created_at, ci.updated_at
    FROM calendar_integrations ci
  `);

  // 3. Backfill pass 2 - merge calendar_verifications rows (verification side).
  await runAsync(`
    INSERT INTO calendar_connections (
        user_id, provider_id,
        code, verification_token, verification_status,
        verification_expires_at, verified_at, connected_at,
        created_at, updated_at
    )
    SELECT
        cv.user_id,
        (SELECT cp.id FROM calendar_providers cp
          WHERE cp.name = CASE cv.provider
                WHEN 'google' THEN 'google-meet'
                WHEN 'microsoft-teams' THEN 'teams'
                ELSE cv.provider END
          LIMIT 1),
        cv.code, cv.token, cv.status,
        cv.expires_at, cv.verified_at, cv.connected_at,
        cv.created_at, cv.updated_at
    FROM calendar_verifications cv
    ON DUPLICATE KEY UPDATE
        code = VALUES(code),
        verification_token = VALUES(verification_token),
        verification_status = VALUES(verification_status),
        verification_expires_at = VALUES(verification_expires_at),
        verified_at = VALUES(verified_at),
        connected_at = VALUES(connected_at),
        created_at = LEAST(calendar_connections.created_at, VALUES(created_at)),
        updated_at = CURRENT_TIMESTAMP
  `);

  // 4. Drop the old source tables - data is temporary, no safety net needed.
  await runAsync(`DROP TABLE IF EXISTS calendar_integrations`);
  await runAsync(`DROP TABLE IF EXISTS calendar_verifications`);

  console.log('[Migration calendar_connections] Complete. Old tables dropped.');
};

const down = async () => {
  await runAsync(`DROP TABLE IF EXISTS calendar_connections`);
  console.log('[Migration calendar_connections] Rolled back.');
};

module.exports = { up, down, migrationName };
