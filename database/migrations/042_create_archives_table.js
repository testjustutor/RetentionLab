/**
 * Migration: Create archives table
 */
const { runAsync } = require('../seedHelpers');

const migrationName = 'create_archives_table';

const up = async () => {
  console.log('[Migration archives] Starting...');

  await runAsync(
    `DROP TABLE IF EXISTS archives`
  );

  await runAsync(`
CREATE TABLE IF NOT EXISTS archives (
    id INT AUTO_INCREMENT PRIMARY KEY,
    meeting_id VARCHAR(255),
    archive_type VARCHAR(50),
    archive_path TEXT,
    archive_json JSON,
    archived_by INT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_arch_meeting (meeting_id),
    INDEX idx_arch_type (archive_type),
    INDEX idx_arch_by (archived_by)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`);

  console.log('[Migration archives] Complete.');
};

const down = async () => {
  await runAsync(`DROP TABLE IF EXISTS archives`);
  console.log('[Migration archives] Rolled back — archives dropped.');
};

module.exports = { up, down, migrationName };