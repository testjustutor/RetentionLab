/**
 * Migration: Create session_snapshot table
 * Single-row-per-session. session_id is UNIQUE and references meeting_sessions.id.
 */
const { runAsync } = require('../seedHelpers');

const migrationName = '018_create_session_snapshot_table';

const up = async () => {
  console.log(`[Migration ${migrationName}] Starting...`);

  await runAsync(`DROP TABLE IF EXISTS session_snapshot`);
  await runAsync(`
    CREATE TABLE session_snapshot (
      id INT AUTO_INCREMENT PRIMARY KEY,
      session_id INT NOT NULL UNIQUE,
      student_grade VARCHAR(100) NOT NULL,
      curriculum VARCHAR(255) NOT NULL,
      location VARCHAR(255) NOT NULL,
      subject VARCHAR(255) NOT NULL,
      topics_covered JSON NOT NULL,
      session_objective_status VARCHAR(100) NOT NULL,
      overall_score_pct DECIMAL(5,2) DEFAULT NULL,
      overall_rating VARCHAR(100) NOT NULL,
      student_engagement VARCHAR(100) NOT NULL,
      learning_impact VARCHAR(100) NOT NULL,
      parent_shareability VARCHAR(100) NOT NULL,
      executive_summary TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_ss_session (session_id),
      CONSTRAINT fk_ss_session FOREIGN KEY (session_id) REFERENCES meeting_sessions(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('[Migration] Created session_snapshot');
  console.log(`[Migration ${migrationName}] Complete.`);
};

const down = async () => {
  await runAsync(`DROP TABLE IF EXISTS session_snapshot`);
  console.log(`[Migration ${migrationName}] Rolled back — session_snapshot dropped.`);
};

module.exports = { up, down, migrationName };

