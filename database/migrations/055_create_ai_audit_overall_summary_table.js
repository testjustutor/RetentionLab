/**
 * Migration: Create ai_audit_overall_summary table
 *
 * Stores the final/overall score per session, weighted by criteria
 * count per category (not by configured category weight — see doc).
 * red_flag is only ever set on the 'submit' flow, per the doc.
 */
const { runAsync } = require('../seedHelpers');

const migrationName = 'create_ai_audit_overall_summary_table';

const up = async () => {
  console.log('[Migration ai_audit_overall_summary] Starting...');

  await runAsync(`DROP TABLE IF EXISTS ai_audit_overall_summary`);

  await runAsync(`
    CREATE TABLE IF NOT EXISTS ai_audit_overall_summary (
      id INT AUTO_INCREMENT PRIMARY KEY,
      meeting_id INT(11),
      session_id INT(11),

      -- Final Score = total_weighted_percent / total_criteria_all
      -- weighted by criteria COUNT per category, not category weight
      final_score DECIMAL(5,2) DEFAULT 0,
      total_weighted_percent DECIMAL(10,2) DEFAULT 0,
      total_criteria_all INT DEFAULT 0,

      calc_source ENUM('submit', 'update') NOT NULL DEFAULT 'submit',

      -- red_flag is only ever set on the 'submit' flow per the doc;
      -- left NULL when calc_source = 'update'
      red_flag TINYINT(1) DEFAULT NULL,

      overall_summary TEXT DEFAULT NULL,

      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

      INDEX idx_aos_meeting (meeting_id),
      UNIQUE KEY uq_aos_meeting_session_source (
        meeting_id, session_id, calc_source
      )
    ) ENGINE=InnoDB
      DEFAULT CHARSET=utf8mb4
      COLLATE=utf8mb4_unicode_ci
  `);

  console.log('[Migration ai_audit_overall_summary] Complete.');
};

const down = async () => {
  await runAsync(`DROP TABLE IF EXISTS ai_audit_overall_summary`);
  console.log('[Migration ai_audit_overall_summary] Rolled back — ai_audit_overall_summary dropped.');
};

module.exports = { up, down, migrationName };