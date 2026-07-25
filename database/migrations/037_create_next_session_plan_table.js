/**
 * Migration: Create next_session_plan table
 */
const { runAsync } = require('../seedHelpers');

const migrationName = 'create_next_session_plan_table';

const up = async () => {
  console.log('[Migration next_session_plan] Starting...');

  await runAsync(
    `DROP TABLE IF EXISTS next_session_plan`
  );

  await runAsync(`
CREATE TABLE IF NOT EXISTS next_session_plan (
    id INT AUTO_INCREMENT PRIMARY KEY,
    meeting_id VARCHAR(255),
    recap_warmup TEXT,
    concept_reinforcement TEXT,
    guided_practice TEXT,
    independent_practice TEXT,
    review_homework TEXT,
    priority_focus TEXT,
    concepts_to_revise TEXT,
    suggested_practice_questions TEXT,
    suggested_homework TEXT,
    misconception_to_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_nsp_meeting (meeting_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`);

  console.log('[Migration next_session_plan] Complete.');
};

const down = async () => {
  await runAsync(`DROP TABLE IF EXISTS next_session_plan`);
  console.log('[Migration next_session_plan] Rolled back — next_session_plan dropped.');
};

module.exports = { up, down, migrationName };
