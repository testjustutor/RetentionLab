/**
 * Migration: Create student_learning_impact table
 */
const { runAsync } = require('../seedHelpers');

const migrationName = 'create_student_learning_impact_table';

const up = async () => {
  console.log('[Migration student_learning_impact] Starting...');

  await runAsync(
    `DROP TABLE IF EXISTS student_learning_impact`
  );

  await runAsync(`
CREATE TABLE IF NOT EXISTS student_learning_impact (
    id INT AUTO_INCREMENT PRIMARY KEY,
    meeting_id VARCHAR(255),
    impact_area VARCHAR(255),
    impact_level VARCHAR(50),
    observation TEXT,
    evidence TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_sli_meeting (meeting_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`);

  console.log('[Migration student_learning_impact] Complete.');
};

const down = async () => {
  await runAsync(`DROP TABLE IF EXISTS student_learning_impact`);
  console.log('[Migration student_learning_impact] Rolled back — student_learning_impact dropped.');
};

module.exports = { up, down, migrationName };
