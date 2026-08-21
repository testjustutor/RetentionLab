/**
 * Migration: Create meeting_sessions table
 */
const { runAsync } = require('../seedHelpers');

const migrationName = 'create_meeting_sessions_table';

const up = async () => {
  console.log('[Migration meeting_sessions] Starting...');

  await runAsync(
    `DROP TABLE IF EXISTS meeting_sessions`
  );

  await runAsync(`
CREATE TABLE IF NOT EXISTS meeting_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    meeting_id int(11),
    transcript_file_name TEXT,
    audio_file_name TEXT,
    start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    end_time DATETIME,
    status VARCHAR(50) DEFAULT 'completed',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_ms_meeting (meeting_id),
    INDEX idx_ms_status (status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`);

  console.log('[Migration meeting_sessions] Complete.');
};

const down = async () => {
  await runAsync(`DROP TABLE IF EXISTS meeting_sessions`);
  console.log('[Migration meeting_sessions] Rolled back — meeting_sessions dropped.');
};

module.exports = { up, down, migrationName };
