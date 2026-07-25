/**
 * Migration: Create meetings table
 */
const { runAsync } = require('../seedHelpers');

const migrationName = 'create_meetings_table';

const up = async () => {
  console.log('[Migration meetings] Starting...');

  await runAsync(
    `DROP TABLE IF EXISTS meetings`
  );

  await runAsync(`
CREATE TABLE IF NOT EXISTS meetings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    meeting_id VARCHAR(255) UNIQUE,
    title VARCHAR(500),
    description TEXT,
    start_time DATETIME,
    end_time DATETIME,
    platform VARCHAR(50),
    calendar_account VARCHAR(255),
    meeting_link TEXT,
    passcode VARCHAR(255),
    status VARCHAR(50) DEFAULT 'scheduled',
    created_by INT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_meetings_status (status),
    INDEX idx_meetings_platform (platform),
    INDEX idx_meetings_calendar (calendar_account),
    INDEX idx_meetings_start (start_time)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`);

  console.log('[Migration meetings] Complete.');
};

const down = async () => {
  await runAsync(`DROP TABLE IF EXISTS meetings`);
  console.log('[Migration meetings] Rolled back — meetings dropped.');
};

module.exports = { up, down, migrationName };
