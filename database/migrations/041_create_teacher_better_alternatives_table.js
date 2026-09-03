/**
 * Migration: Create teacher_better_alternatives table
 */
const { runAsync } = require('../seedHelpers');

const migrationName = 'create_teacher_better_alternatives_table';

const up = async () => {
  console.log('[Migration teacher_better_alternatives] Starting...');

  await runAsync(
    `DROP TABLE IF EXISTS teacher_better_alternatives`
  );

  await runAsync(`
CREATE TABLE IF NOT EXISTS teacher_better_alternatives (
    id INT AUTO_INCREMENT PRIMARY KEY,
    meeting_id int(11) NOT NULL,
    session_id int(11) NOT NULL,
    transcript_situation TEXT,
    current_approach TEXT,
    better_alternative TEXT,
    purpose TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_tba_meeting (meeting_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`);

  console.log('[Migration teacher_better_alternatives] Complete.');
};

const down = async () => {
  await runAsync(`DROP TABLE IF EXISTS teacher_better_alternatives`);
  console.log('[Migration teacher_better_alternatives] Rolled back — teacher_better_alternatives dropped.');
};

module.exports = { up, down, migrationName };
