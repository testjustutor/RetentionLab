/**
 * Migration: Create participants table
 */
const { runAsync } = require('../seedHelpers');

const migrationName = 'create_participants_table';

const up = async () => {
  console.log('[Migration participants] Starting...');

  await runAsync(
    `DROP TABLE IF EXISTS participants`
  );

  await runAsync(`
CREATE TABLE IF NOT EXISTS participants (
    id INT AUTO_INCREMENT PRIMARY KEY,
    meeting_id VARCHAR(255),
    participant_name VARCHAR(255),
    participant_email VARCHAR(255),
    participant_role VARCHAR(50),
    join_time DATETIME,
    leave_time DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_part_meeting (meeting_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`);

  console.log('[Migration participants] Complete.');
};

const down = async () => {
  await runAsync(`DROP TABLE IF EXISTS participants`);
  console.log('[Migration participants] Rolled back — participants dropped.');
};

module.exports = { up, down, migrationName };
