/**
 * Migration: Create session_rubric_evaluations table
 */
const { runAsync } = require('../seedHelpers');

const migrationName = 'create_session_rubric_evaluations_table';

const up = async () => {
  console.log('[Migration session_rubric_evaluations] Starting...');

  await runAsync(
    `DROP TABLE IF EXISTS session_rubric_evaluations`
  );

  await runAsync(`
CREATE TABLE IF NOT EXISTS session_rubric_evaluations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id INT NOT NULL,
    indicator_id VARCHAR(255) NOT NULL,
    rating ENUM('Met', 'Partial', 'Not met', 'N/A') DEFAULT 'N/A',
    evidence_text TEXT,
    comment TEXT,
    evaluated_by ENUM('AI', 'HUMAN') DEFAULT 'AI',
    confidence ENUM('High', 'Medium', 'Low') DEFAULT 'Medium',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_session_indicator (session_id, indicator_id),
    INDEX idx_sre_session (session_id),
    INDEX idx_sre_indicator (indicator_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`);

  console.log('[Migration session_rubric_evaluations] Complete.');
};

const down = async () => {
  await runAsync(`DROP TABLE IF EXISTS session_rubric_evaluations`);
  console.log('[Migration session_rubric_evaluations] Rolled back — session_rubric_evaluations dropped.');
};

module.exports = { up, down, migrationName };
