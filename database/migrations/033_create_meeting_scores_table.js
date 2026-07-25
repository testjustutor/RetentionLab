/**
 * Migration: Create meeting_scores table
 */
const { runAsync } = require('../seedHelpers');

const migrationName = 'create_meeting_scores_table';

const up = async () => {
  console.log('[Migration meeting_scores] Starting...');

  await runAsync(
    `DROP TABLE IF EXISTS meeting_scores`
  );

  await runAsync(`
CREATE TABLE IF NOT EXISTS meeting_scores (
    id INT AUTO_INCREMENT PRIMARY KEY,
    meeting_id VARCHAR(255),
    indicator_id VARCHAR(255),
    reviewer_id INT,
    score DECIMAL(5,2),
    comment TEXT,
    score_type VARCHAR(50) DEFAULT 'AI',
    scored_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_ms_meeting (meeting_id),
    INDEX idx_ms_indicator (indicator_id),
    INDEX idx_ms_reviewer (reviewer_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`);

  console.log('[Migration meeting_scores] Complete.');
};

const down = async () => {
  await runAsync(`DROP TABLE IF EXISTS meeting_scores`);
  console.log('[Migration meeting_scores] Rolled back — meeting_scores dropped.');
};

module.exports = { up, down, migrationName };
