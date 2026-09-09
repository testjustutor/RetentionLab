/**
 * Migration: Create tutor_evaluation tables
 * Stores the tutor-evaluation review-calculation values documented in
 * review_calculation_logic.txt:
 *   - per-category Met / Not Met / Not Applicable counts
 *   - per-category score (%)
 *   - category weightage snapshot (weight / cat_score)
 *   - overall (criteria-count-weighted) final score (%)
 *   - red_flag
 *
 * Two normalized tables:
 *   tutor_evaluation_summary          -> one row per (session, reviewer, flow)
 *   tutor_evaluation_category_score   -> one row per category per summary
 */
const { runAsync } = require('../seedHelpers');

const migrationName = 'create_tutor_evaluation_tables';

const up = async () => {
  console.log('[Migration tutor_evaluation] Starting...');

  await runAsync(`DROP TABLE IF EXISTS tutor_evaluation_category_score`);
  await runAsync(`DROP TABLE IF EXISTS tutor_evaluation_summary`);

  await runAsync(`
    CREATE TABLE IF NOT EXISTS tutor_evaluation_summary (
      id INT AUTO_INCREMENT PRIMARY KEY,
      session_id INT NOT NULL,
      reviewer_id INT NULL,
      flow ENUM('submit', 'update') NOT NULL DEFAULT 'submit',
      total_criteria_all INT NOT NULL DEFAULT 0,
      final_score_pct DECIMAL(5,2) NOT NULL DEFAULT 0,
      red_flag TINYINT(1) NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_tes_session_reviewer_flow (session_id, reviewer_id, flow),
      INDEX idx_tes_session (session_id),
      INDEX idx_tes_reviewer (reviewer_id),
      CONSTRAINT fk_tes_session
        FOREIGN KEY (session_id)
        REFERENCES meeting_sessions(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
      CONSTRAINT fk_tes_reviewer
        FOREIGN KEY (reviewer_id)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL
    ) ENGINE=InnoDB
      DEFAULT CHARSET=utf8mb4
      COLLATE=utf8mb4_unicode_ci
  `);

  await runAsync(`
    CREATE TABLE IF NOT EXISTS tutor_evaluation_category_score (
      id INT AUTO_INCREMENT PRIMARY KEY,
      summary_id INT NOT NULL,
      category_id INT NULL,
      category_code VARCHAR(10) NULL,
      category_name VARCHAR(255) NOT NULL,
      weight DECIMAL(5,2) NOT NULL DEFAULT 0,
      total_criteria INT NOT NULL DEFAULT 0,
      count_met INT NOT NULL DEFAULT 0,
      count_not_met INT NOT NULL DEFAULT 0,
      count_not_applicable INT NOT NULL DEFAULT 0,
      category_score_pct DECIMAL(5,2) NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_tecs_summary_category (summary_id, category_id),
      INDEX idx_tecs_summary (summary_id),
      INDEX idx_tecs_category (category_id),
      CONSTRAINT fk_tecs_summary
        FOREIGN KEY (summary_id)
        REFERENCES tutor_evaluation_summary(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
      CONSTRAINT fk_tecs_category
        FOREIGN KEY (category_id)
        REFERENCES admin_rubric_categories(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL
    ) ENGINE=InnoDB
      DEFAULT CHARSET=utf8mb4
      COLLATE=utf8mb4_unicode_ci
  `);

  console.log('[Migration tutor_evaluation] Complete.');
};

const down = async () => {
  await runAsync(`DROP TABLE IF EXISTS tutor_evaluation_category_score`);
  await runAsync(`DROP TABLE IF EXISTS tutor_evaluation_summary`);
  console.log('[Migration tutor_evaluation] Rolled back — tutor_evaluation tables dropped.');
};

module.exports = { up, down, migrationName };