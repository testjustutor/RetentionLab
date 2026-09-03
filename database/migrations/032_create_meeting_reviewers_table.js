/**
 * Migration: Create meeting_reviewers table
 * Includes all columns from subsequent fix migrations (059)
 */
const { runAsync } = require('../seedHelpers');

const migrationName = 'create_meeting_reviewers_table';

const up = async () => {
  console.log('[Migration meeting_reviewers] Starting...');

  await runAsync(
    `DROP TABLE IF EXISTS meeting_reviewers`
  );

  await runAsync(`
CREATE TABLE IF NOT EXISTS meeting_reviewers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    meeting_id INT,
    reviewer_id INT,
    assigned_by INT,
    review_status VARCHAR(50) DEFAULT 'pending',
    assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    reviewed_at DATETIME,
    comments TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_mr_meeting (meeting_id),
    INDEX idx_mr_reviewer (reviewer_id),
    FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`);

  console.log('[Migration meeting_reviewers] Complete.');
};

const down = async () => {
  await runAsync(`DROP TABLE IF EXISTS meeting_reviewers`);
  console.log('[Migration meeting_reviewers] Rolled back — meeting_reviewers dropped.');
};

module.exports = { up, down, migrationName };