/**
 * Migration: Create ai_audit_results table
 */
const { runAsync } = require('../seedHelpers');

const migrationName = 'create_ai_audit_results_table';

const up = async () => {
  console.log('[Migration ai_audit_results] Starting...');

  await runAsync(
    `DROP TABLE IF EXISTS ai_audit_results`
  );

  await runAsync(`
CREATE TABLE IF NOT EXISTS ai_audit_results (
    id INT AUTO_INCREMENT PRIMARY KEY,
    meeting_id VARCHAR(255),
    session_id VARCHAR(255),
    category_id VARCHAR(10),
    indicator_id VARCHAR(255),
    ai_score INT,
    ai_max_score INT,
    ai_raw_response JSON,
    oqi_score INT,
    evidence_quote TEXT,
    talk_ratio DECIMAL(5,2),
    scored_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_ar_meeting (meeting_id),
    INDEX idx_ar_indicator (indicator_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`);

  console.log('[Migration ai_audit_results] Complete.');
};

const down = async () => {
  await runAsync(`DROP TABLE IF EXISTS ai_audit_results`);
  console.log('[Migration ai_audit_results] Rolled back — ai_audit_results dropped.');
};

module.exports = { up, down, migrationName };
