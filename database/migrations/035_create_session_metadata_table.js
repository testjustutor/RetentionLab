/**
 * Migration: Create session_metadata table
 */
const { runAsync } = require('../seedHelpers');

const migrationName = 'create_session_metadata_table';

const up = async () => {
  console.log('[Migration session_metadata] Starting...');

  await runAsync(
    `DROP TABLE IF EXISTS session_metadata`
  );

  await runAsync(`
CREATE TABLE IF NOT EXISTS session_metadata (
    id INT AUTO_INCREMENT PRIMARY KEY,
    meeting_id VARCHAR(255),
    student_name VARCHAR(255),
    teacher_user_id INT,
    subject VARCHAR(255),
    student_grade VARCHAR(100),
    curriculum VARCHAR(255),
    topic VARCHAR(255),
    session_objective TEXT,
    session_type VARCHAR(50) DEFAULT 'one-to-one',
    student_location VARCHAR(255),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_sm_meeting (meeting_id),
    INDEX idx_sm_teacher (teacher_user_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`);

  console.log('[Migration session_metadata] Complete.');
};

const down = async () => {
  await runAsync(`DROP TABLE IF EXISTS session_metadata`);
  console.log('[Migration session_metadata] Rolled back — session_metadata dropped.');
};

module.exports = { up, down, migrationName };
