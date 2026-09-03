/**
 * Migration: Create session_rubric_summary table
 */
const { runAsync } = require('../seedHelpers');

const migrationName = 'create_session_rubric_summary_table';

const up = async () => {
  console.log('[Migration session_rubric_summary] Starting...');

  await runAsync(
    `DROP TABLE IF EXISTS session_rubric_summary`
  );

  await runAsync(`
CREATE TABLE IF NOT EXISTS session_rubric_summary (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id INT NOT NULL UNIQUE,
    weighted_score_pct DECIMAL(5,2) DEFAULT 0.00,
    gate_status ENUM('all_passed', 'gate_failed') DEFAULT 'all_passed',
    overall_rating VARCHAR(50) DEFAULT 'Developing',
    confidence_level VARCHAR(255) DEFAULT 'Medium',
    red_flag TINYINT(1) DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_srs_session (session_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`);

  console.log('[Migration session_rubric_summary] Complete.');
};

const down = async () => {
  await runAsync(`DROP TABLE IF EXISTS session_rubric_summary`);
  console.log('[Migration session_rubric_summary] Rolled back — session_rubric_summary dropped.');
};

module.exports = { up, down, migrationName };
