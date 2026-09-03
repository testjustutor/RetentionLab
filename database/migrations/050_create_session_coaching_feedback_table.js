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
      session_id INT NOT NULL,
      meeting_id INT NOT NULL,
      feedback_type VARCHAR(50) NOT NULL,
      feedback_content TEXT NOT NULL,
      action_items JSON DEFAULT NULL,
      priority ENUM('low', 'medium', 'high') NOT NULL DEFAULT 'medium',
      status ENUM('pending', 'in_progress', 'completed') NOT NULL DEFAULT 'pending',
      target_date DATETIME DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_scf_session (session_id),
      INDEX idx_scf_meeting (meeting_id),
      CONSTRAINT fk_scf_session
        FOREIGN KEY (session_id)
        REFERENCES meeting_sessions(id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB
      DEFAULT CHARSET=utf8mb4
      COLLATE=utf8mb4_unicode_ci
  `);

  console.log('[Migration] Created session_coaching_feedback');
  console.log(`[Migration ${migrationName}] Complete.`);
};

const down = async () => {
  await runAsync(`DROP TABLE IF EXISTS session_coaching_feedback`);
  console.log(`[Migration ${migrationName}] Rolled back — session_coaching_feedback dropped.`);
};

module.exports = { up, down, migrationName };