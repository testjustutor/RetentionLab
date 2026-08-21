/**
 * Migration: Create participant_sessions table
 */
const { runAsync } = require('../seedHelpers');

const migrationName = 'create_participant_sessions_table';

const up = async () => {
  console.log('[Migration participant_sessions] Starting...');

  await runAsync(
    `DROP TABLE IF EXISTS participant_sessions`
  );

  await runAsync(`
CREATE TABLE IF NOT EXISTS participant_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    meeting_id int(11) NOT NULL,
    session_id int(11) NOT NULL,
    participant_name VARCHAR(255),
    join_sequence INT,
    joined_at DATETIME,
    left_at DATETIME,
    session_duration_seconds INT,
    total_meeting_duration_seconds INT,
    participant_count_at_join INT,
    session_status VARCHAR(50),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_ps_meeting (meeting_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`);

  console.log('[Migration participant_sessions] Complete.');
};

const down = async () => {
  await runAsync(`DROP TABLE IF EXISTS participant_sessions`);
  console.log('[Migration participant_sessions] Rolled back — participant_sessions dropped.');
};

module.exports = { up, down, migrationName };
