/**
 * Migration: Create session_parent_summary table
 * Single-row-per-session. session_id is UNIQUE and references meeting_sessions.id.
 */
const { runAsync } = require('../seedHelpers');

const migrationName = '012_create_session_parent_summary_table';

const up = async () => {
  console.log(`[Migration ${migrationName}] Starting...`);

  await runAsync(`DROP TABLE IF EXISTS session_parent_summary`);
  await runAsync(`
    CREATE TABLE session_parent_summary (
      id INT AUTO_INCREMENT PRIMARY KEY,
      session_id INT NOT NULL UNIQUE,
      covered_text TEXT NOT NULL,
      participation_text TEXT NOT NULL,
      progress_text TEXT NOT NULL,
      needs_practice_text TEXT NOT NULL,
      home_support_tips JSON NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_sps_session (session_id),
      CONSTRAINT fk_sps_session FOREIGN KEY (session_id) REFERENCES meeting_sessions(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('[Migration] Created session_parent_summary');
  console.log(`[Migration ${migrationName}] Complete.`);
};

const down = async () => {
  await runAsync(`DROP TABLE IF EXISTS session_parent_summary`);
  console.log(`[Migration ${migrationName}] Rolled back — session_parent_summary dropped.`);
};

module.exports = { up, down, migrationName };

