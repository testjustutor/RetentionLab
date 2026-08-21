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
    meeting_id int(11) NOT NULL,
    session_id int(11) NOT NULL,
    audio_path TEXT,
    transcript_path TEXT,
    summary_path TEXT,
    video_path TEXT,
    oqi_score DECIMAL(5,2) DEFAULT NULL,
    audit_summary JSON DEFAULT NULL,
    audit_completed_at DATETIME DEFAULT NULL,  
    status VARCHAR(50) DEFAULT NULL,
    processed_at DATETIME DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_ma_meeting (meeting_id),
    UNIQUE KEY uq_ma_meeting_session (meeting_id, session_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`);

  console.log('[Migration meeting_assets] Complete.');
};

const down = async () => {
  await runAsync(`DROP TABLE IF EXISTS meeting_assets`);
  console.log('[Migration meeting_assets] Rolled back — meeting_assets dropped.');
};

module.exports = { up, down, migrationName };
