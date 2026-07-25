/**
 * Migration: Create participant_attendance_sessions table
 */
const { runAsync } = require('../seedHelpers');

const migrationName = 'create_participant_attendance_sessions_table';

const up = async () => {
  console.log('[Migration participant_attendance_sessions] Starting...');

  await runAsync(
    `DROP TABLE IF EXISTS participant_attendance_sessions`
  );

  await runAsync(`
CREATE TABLE IF NOT EXISTS participant_attendance_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    meeting_id VARCHAR(255),
    participant_id INT,
    session_number INT,
    joined_at DATETIME,
    left_at DATETIME,
    duration_seconds INT,
    attendance_status VARCHAR(50),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_pas_meeting (meeting_id),
    INDEX idx_pas_participant (participant_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`);

  console.log('[Migration participant_attendance_sessions] Complete.');
};

const down = async () => {
  await runAsync(`DROP TABLE IF EXISTS participant_attendance_sessions`);
  console.log('[Migration participant_attendance_sessions] Rolled back — participant_attendance_sessions dropped.');
};

module.exports = { up, down, migrationName };
