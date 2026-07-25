/**
 * Migration: Create session_analysis table
 * Single-row-per-session. session_id is UNIQUE and references meeting_sessions.id.
 */
const { runAsync } = require('../seedHelpers');

const migrationName = '010_create_session_analysis_table';

const up = async () => {
  console.log(`[Migration ${migrationName}] Starting...`);

  await runAsync(`DROP TABLE IF EXISTS session_analysis`);
  await runAsync(`
    CREATE TABLE session_analysis (
      id INT AUTO_INCREMENT PRIMARY KEY,
      session_id INT NOT NULL UNIQUE,
      what_worked_well JSON NOT NULL,
      what_needs_improvement JSON NOT NULL,
      missed_opportunities JSON NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_sa_session (session_id),
      CONSTRAINT fk_sa_session FOREIGN KEY (session_id) REFERENCES meeting_sessions(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('[Migration] Created session_analysis');
  console.log(`[Migration ${migrationName}] Complete.`);
};

const down = async () => {
  await runAsync(`DROP TABLE IF EXISTS session_analysis`);
  console.log(`[Migration ${migrationName}] Rolled back — session_analysis dropped.`);
};

module.exports = { up, down, migrationName };

