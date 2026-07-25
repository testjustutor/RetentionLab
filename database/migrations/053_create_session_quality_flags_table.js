/**
 * Migration: Create session_quality_flags table
 * Single-row-per-session. session_id is UNIQUE and references meeting_sessions.id.
 */
const { runAsync } = require('../seedHelpers');

const migrationName = '016_create_session_quality_flags_table';

const up = async () => {
  console.log(`[Migration ${migrationName}] Starting...`);

  await runAsync(`DROP TABLE IF EXISTS session_quality_flags`);
  await runAsync(`
    CREATE TABLE session_quality_flags (
      id INT AUTO_INCREMENT PRIMARY KEY,
      session_id INT NOT NULL UNIQUE,
      flags JSON NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_sqf_session (session_id),
      CONSTRAINT fk_sqf_session FOREIGN KEY (session_id) REFERENCES meeting_sessions(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('[Migration] Created session_quality_flags');
  console.log(`[Migration ${migrationName}] Complete.`);
};

const down = async () => {
  await runAsync(`DROP TABLE IF EXISTS session_quality_flags`);
  console.log(`[Migration ${migrationName}] Rolled back — session_quality_flags dropped.`);
};

module.exports = { up, down, migrationName };

