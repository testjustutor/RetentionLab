/**
 * Migration: Create teacher_coaching_feedback table
 */
const { runAsync } = require('../seedHelpers');

const migrationName = 'create_teacher_coaching_feedback_table';

const up = async () => {
  console.log('[Migration teacher_coaching_feedback] Starting...');

  await runAsync(
    `DROP TABLE IF EXISTS teacher_coaching_feedback`
  );

  await runAsync(`
CREATE TABLE IF NOT EXISTS teacher_coaching_feedback (
    id INT AUTO_INCREMENT PRIMARY KEY,
    meeting_id VARCHAR(255),
    feedback_type VARCHAR(50),
    area VARCHAR(255),
    evidence TEXT,
    why_it_matters TEXT,
    recommended_action TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_tcf_meeting (meeting_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`);

  console.log('[Migration teacher_coaching_feedback] Complete.');
};

const down = async () => {
  await runAsync(`DROP TABLE IF EXISTS teacher_coaching_feedback`);
  console.log('[Migration teacher_coaching_feedback] Rolled back — teacher_coaching_feedback dropped.');
};

module.exports = { up, down, migrationName };
