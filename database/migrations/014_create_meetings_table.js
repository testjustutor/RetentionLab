/**
 * Migration: Create meetings table
 * Includes all columns from subsequent fix migrations (058)
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
    external_meeting_id VARCHAR(255),
    title VARCHAR(500),
    description TEXT,
    scheduled_start_time DATETIME,
    scheduled_end_time DATETIME,
    actual_start_time DATETIME NULL,
    actual_end_time DATETIME NULL,
    platform VARCHAR(50),
    calendar_account VARCHAR(255),
    meeting_link TEXT,
    passcode VARCHAR(255),
    event_id VARCHAR(255),
    timezone VARCHAR(100),
    status VARCHAR(50) DEFAULT 'scheduled',
    created_by INT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_meetings_status (status),
    INDEX idx_meetings_platform (platform),
    INDEX idx_meetings_calendar (calendar_account),
    INDEX idx_meetings_start (scheduled_start_time),
    INDEX idx_meetings_event_id (event_id),
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`);

  console.log('[Migration meetings] Complete.');
};

const down = async () => {
  await runAsync(`DROP TABLE IF EXISTS meetings`);
  console.log('[Migration meetings] Rolled back — meetings dropped.');
};

module.exports = { up, down, migrationName };