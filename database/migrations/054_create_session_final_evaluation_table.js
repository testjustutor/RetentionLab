/**
 * Migration: Create session_final_evaluation table
 * Single-row-per-session. session_id is UNIQUE and references meeting_sessions.id.
 */
const { runAsync } = require('../seedHelpers');

const migrationName = '017_create_session_final_evaluation_table';

const up = async () => {
  console.log(`[Migration ${migrationName}] Starting...`);

  await runAsync(`DROP TABLE IF EXISTS session_final_evaluation`);
  await runAsync(`
    CREATE TABLE session_final_evaluation (
      id INT AUTO_INCREMENT PRIMARY KEY,
      session_id INT NOT NULL UNIQUE,
      overall_session_rating VARCHAR(255) NOT NULL,
      teacher_performance VARCHAR(255) NOT NULL,
      student_engagement VARCHAR(255) NOT NULL,
      learning_impact VARCHAR(255) NOT NULL,
      parent_communication_readiness VARCHAR(255) NOT NULL,
      recommended_action VARCHAR(255) NOT NULL,
      summary_narrative TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_sfe_session (session_id),
      CONSTRAINT fk_sfe_session FOREIGN KEY (session_id) REFERENCES meeting_sessions(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('[Migration] Created session_final_evaluation');
  console.log(`[Migration ${migrationName}] Complete.`);
};

const down = async () => {
  await runAsync(`DROP TABLE IF EXISTS session_final_evaluation`);
  console.log(`[Migration ${migrationName}] Rolled back — session_final_evaluation dropped.`);
};

module.exports = { up, down, migrationName };

