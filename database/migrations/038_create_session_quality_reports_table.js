/**
 * Migration: Create session_quality_reports table
 */
const { runAsync } = require('../seedHelpers');

const migrationName = 'create_session_quality_reports_table';

const up = async () => {
  console.log('[Migration session_quality_reports] Starting...');

  await runAsync(
    `DROP TABLE IF EXISTS session_quality_reports`
  );

  await runAsync(`
CREATE TABLE IF NOT EXISTS session_quality_reports (
    id INT AUTO_INCREMENT PRIMARY KEY,
    meeting_id int(11) NOT NULL,
    session_id int(11) NOT NULL,
    overall_score INT,
    max_possible_score INT,
    percentage_score DECIMAL(5,2),
    overall_rating VARCHAR(100),
    student_engagement VARCHAR(100),
    learning_impact VARCHAR(100),
    parent_shareability VARCHAR(100),
    confidence_level VARCHAR(100),
    confidence_reason TEXT,
    executive_summary TEXT,
    generated_by VARCHAR(50) DEFAULT 'AI',
    generated_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_sqr_meeting (meeting_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`);

  console.log('[Migration session_quality_reports] Complete.');
};

const down = async () => {
  await runAsync(`DROP TABLE IF EXISTS session_quality_reports`);
  console.log('[Migration session_quality_reports] Rolled back — session_quality_reports dropped.');
};

module.exports = { up, down, migrationName };