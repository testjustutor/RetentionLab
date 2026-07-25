/**
 * Migration: Create meeting_assets table
 */
const { runAsync } = require('../seedHelpers');

const migrationName = 'create_meeting_assets_table';

const up = async () => {
  console.log('[Migration meeting_assets] Starting...');

  await runAsync(
    `DROP TABLE IF EXISTS meeting_assets`
  );

  await runAsync(`
CREATE TABLE IF NOT EXISTS meeting_assets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    meeting_id VARCHAR(255),
    audio_path TEXT,
    transcript_path TEXT,
    audit_json_path TEXT,
    screenshots_json JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_ma_meeting (meeting_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`);

  console.log('[Migration meeting_assets] Complete.');
};

const down = async () => {
  await runAsync(`DROP TABLE IF EXISTS meeting_assets`);
  console.log('[Migration meeting_assets] Rolled back — meeting_assets dropped.');
};

module.exports = { up, down, migrationName };
