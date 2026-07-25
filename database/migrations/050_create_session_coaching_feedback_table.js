/**
 * Migration: Create session_coaching_feedback table
 * Single-row-per-session. session_id is UNIQUE and references meeting_sessions.id.
 */
const { runAsync } = require('../seedHelpers');

const migrationName = '013_create_session_coaching_feedback_table';

const up = async () => {
  console.log(`[Migration ${migrationName}] Starting...`);

  await runAsync(`DROP TABLE IF EXISTS session_coaching_feedback`);
  await runAsync(`
    CREATE TABLE session_coaching_feedback (
      id INT AUTO_INCREMENT PRIMARY KEY,
      session_id INT NOT NULL UNIQUE,
      strengths JSON NOT NULL,
      areas_to_improve JSON NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_scf_session (session_id),
      CONSTRAINT fk_scf_session FOREIGN KEY (session_id) REFERENCES meeting_sessions(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('[Migration] Created session_coaching_feedback');
  console.log(`[Migration ${migrationName}] Complete.`);
};

const down = async () => {
  await runAsync(`DROP TABLE IF EXISTS session_coaching_feedback`);
  console.log(`[Migration ${migrationName}] Rolled back — session_coaching_feedback dropped.`);
};

module.exports = { up, down, migrationName };

