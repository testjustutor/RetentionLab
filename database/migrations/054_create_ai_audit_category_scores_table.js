/**
 * Migration: Create ai_audit_category_scores table
 *
 * Stores per-category rollups (count_1/2/3 + category_score) per session.
 * - calc_source distinguishes 'submit' vs 'update' flows, since the
 *   count_2/count_3 mapping is swapped between them (see calc-logic doc),
 *   producing different category_score results for the same statuses.
 * - category_name intentionally NOT stored — resolve via category_id join.
 */
const { runAsync } = require('../seedHelpers');

const migrationName = 'create_ai_audit_category_scores_table';

const up = async () => {
  console.log('[Migration ai_audit_category_scores] Starting...');

  await runAsync(`DROP TABLE IF EXISTS ai_audit_category_scores`);

  await runAsync(`
    CREATE TABLE IF NOT EXISTS ai_audit_category_scores (
      id INT AUTO_INCREMENT PRIMARY KEY,
      meeting_id INT(11),
      session_id INT(11),
      category_id INT(11),

      -- raw counts, matching the doc's count_1/count_2/count_3
      count_met INT DEFAULT 0,            -- count_1
      count_not_met INT DEFAULT 0,        -- count_2
      count_not_applicable INT DEFAULT 0, -- count_3
      total_criteria INT DEFAULT 0,

      category_score DECIMAL(5,2) DEFAULT 0,

      -- which formula produced this score, since submit vs update
      -- give different results for the same statuses (see doc "Known Discrepancies")
      calc_source ENUM('submit', 'update') NOT NULL DEFAULT 'submit',

      -- NOT currently applied to final score calc; stored for future use only
      category_weight DECIMAL(5,2) DEFAULT NULL,

      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

      INDEX idx_acs_meeting (meeting_id),
      INDEX idx_acs_category (category_id),
      UNIQUE KEY uq_acs_meeting_session_category_source (
        meeting_id, session_id, category_id, calc_source
      )
    ) ENGINE=InnoDB
      DEFAULT CHARSET=utf8mb4
      COLLATE=utf8mb4_unicode_ci
  `);

  console.log('[Migration ai_audit_category_scores] Complete.');
};

const down = async () => {
  await runAsync(`DROP TABLE IF EXISTS ai_audit_category_scores`);
  console.log('[Migration ai_audit_category_scores] Rolled back — ai_audit_category_scores dropped.');
};

module.exports = { up, down, migrationName };