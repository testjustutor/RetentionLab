/**
 * Migration: Create transcripts table
 */
const { runAsync } = require('../seedHelpers');

const migrationName = 'create_transcripts_table';

const up = async () => {
  console.log('[Migration transcripts] Starting...');

  await runAsync(
    `DROP TABLE IF EXISTS transcripts`
  );

  await runAsync(`
CREATE TABLE IF NOT EXISTS transcripts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    meeting_id VARCHAR(255),
    session_id VARCHAR(255),
    transcript_text LONGTEXT,
    analysis_json JSON,
    language VARCHAR(50) DEFAULT 'en',
    duration_seconds INT,
    word_count INT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_tr_meeting (meeting_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`);

  console.log('[Migration transcripts] Complete.');
};

const down = async () => {
  await runAsync(`DROP TABLE IF EXISTS transcripts`);
  console.log('[Migration transcripts] Rolled back — transcripts dropped.');
};

module.exports = { up, down, migrationName };