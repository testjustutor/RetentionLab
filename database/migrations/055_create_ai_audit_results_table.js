/**
 * Migration: Create ai_audit_results table
 *
 * Stores per-indicator scoring results.
 * - status_code: 1 = Met, 2 = Not Met, 3 = Not Applicable (per calc-logic doc)
 * - category_name / indicator_name intentionally NOT stored —
 *   resolve via category_id / indicator_id joins to their lookup tables.
 * - ai_evidence: per-indicator supporting quote from the transcript
 *   (merged from previously separate ai_evidence / evidence_quote fields).
 */
const { runAsync } = require('../seedHelpers');

const migrationName = 'create_ai_audit_results_table';

const up = async () => {
  console.log('[Migration ai_audit_results] Starting...');

  await runAsync(`DROP TABLE IF EXISTS ai_audit_results`);

  await runAsync(`
    CREATE TABLE IF NOT EXISTS ai_audit_results (
      id INT AUTO_INCREMENT PRIMARY KEY,
      meeting_id INT(11),
      session_id INT(11),
      category_id INT(11),
      indicator_id INT(11),
      status_code TINYINT(1) DEFAULT NULL,
      is_gate TINYINT(1) DEFAULT 0,
      ai_evidence TEXT DEFAULT NULL,
      reason TEXT DEFAULT NULL,
      scored_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_ar_meeting (meeting_id),
      INDEX idx_ar_indicator (indicator_id),
      INDEX idx_ar_category (category_id),
      UNIQUE KEY uq_ar_meeting_session_indicator (
        meeting_id, session_id, indicator_id
      )
    ) ENGINE=InnoDB
      DEFAULT CHARSET=utf8mb4
      COLLATE=utf8mb4_unicode_ci
  `);

  console.log('[Migration ai_audit_results] Complete.');
};

const down = async () => {
  await runAsync(`DROP TABLE IF EXISTS ai_audit_results`);
  console.log('[Migration ai_audit_results] Rolled back — ai_audit_results dropped.');
};

module.exports = { up, down, migrationName };