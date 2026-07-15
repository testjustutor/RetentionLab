/**
 * root/database/migrations/009_create_session_quality_tables.js
 *
 * Creates the 9 Session Quality & Impact Report tables (single-row-per-session).
 * Each table is keyed by session_id (FK → meeting_sessions.id) with a UNIQUE constraint.
 * JSON columns are used for array/object fields (MySQL native JSON type).
 *
 * These tables REPLACE any existing tables with these names that have different schemas.
 * They are the canonical storage for AI-generated session quality report sections.
 */
const { runAsync } = require('../seedHelpers');

const migrationName = '009_create_session_quality_tables';

const up = async () => {
  console.log(`[Migration ${migrationName}] Starting...`);

  // ────────────────────────────────────
  // a) session_analysis — what worked, what didn't, missed opportunities
  // ────────────────────────────────────
  await runAsync(`DROP TABLE IF EXISTS session_analysis`);
  await runAsync(`
    CREATE TABLE session_analysis (
      id INT AUTO_INCREMENT PRIMARY KEY,
      session_id INT NOT NULL UNIQUE,
      what_worked_well JSON NOT NULL,
      what_needs_improvement JSON NOT NULL,
      missed_opportunities JSON NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_sa_session (session_id),
      CONSTRAINT fk_sa_session FOREIGN KEY (session_id) REFERENCES meeting_sessions(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('[Migration] Created session_analysis');

  // ────────────────────────────────────
  // b) session_learning_impact — impact areas with observations
  // ────────────────────────────────────
  await runAsync(`DROP TABLE IF EXISTS session_learning_impact`);
  await runAsync(`
    CREATE TABLE session_learning_impact (
      id INT AUTO_INCREMENT PRIMARY KEY,
      session_id INT NOT NULL UNIQUE,
      impact_areas JSON NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_sli_session (session_id),
      CONSTRAINT fk_sli_session FOREIGN KEY (session_id) REFERENCES meeting_sessions(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('[Migration] Created session_learning_impact');

  // ────────────────────────────────────
  // c) session_parent_summary — parent-facing summary text
  // ────────────────────────────────────
  await runAsync(`DROP TABLE IF EXISTS session_parent_summary`);
  await runAsync(`
    CREATE TABLE session_parent_summary (
      id INT AUTO_INCREMENT PRIMARY KEY,
      session_id INT NOT NULL UNIQUE,
      covered_text TEXT NOT NULL,
      participation_text TEXT NOT NULL,
      progress_text TEXT NOT NULL,
      needs_practice_text TEXT NOT NULL,
      home_support_tips JSON NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_sps_session (session_id),
      CONSTRAINT fk_sps_session FOREIGN KEY (session_id) REFERENCES meeting_sessions(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('[Migration] Created session_parent_summary');

  // ────────────────────────────────────
  // d) session_coaching_feedback — teacher coaching feedback
  // ────────────────────────────────────
  await runAsync(`DROP TABLE IF EXISTS session_coaching_feedback`);
  await runAsync(`
    CREATE TABLE session_coaching_feedback (
      id INT AUTO_INCREMENT PRIMARY KEY,
      session_id INT NOT NULL UNIQUE,
      strengths JSON NOT NULL,
      areas_to_improve JSON NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_scf_session (session_id),
      CONSTRAINT fk_scf_session FOREIGN KEY (session_id) REFERENCES meeting_sessions(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('[Migration] Created session_coaching_feedback');

  // ────────────────────────────────────
  // e) session_better_alternatives — alternative approaches
  // ────────────────────────────────────
  await runAsync(`DROP TABLE IF EXISTS session_better_alternatives`);
  await runAsync(`
    CREATE TABLE session_better_alternatives (
      id INT AUTO_INCREMENT PRIMARY KEY,
      session_id INT NOT NULL UNIQUE,
      items JSON NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_sba_session (session_id),
      CONSTRAINT fk_sba_session FOREIGN KEY (session_id) REFERENCES meeting_sessions(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('[Migration] Created session_better_alternatives');

  // ────────────────────────────────────
  // f) session_next_plan — next session plan segments
  // ────────────────────────────────────
  await runAsync(`DROP TABLE IF EXISTS session_next_plan`);
  await runAsync(`
    CREATE TABLE session_next_plan (
      id INT AUTO_INCREMENT PRIMARY KEY,
      session_id INT NOT NULL UNIQUE,
      segments JSON NOT NULL,
      priority_focus JSON NOT NULL,
      gaps_to_address JSON NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_snp_session (session_id),
      CONSTRAINT fk_snp_session FOREIGN KEY (session_id) REFERENCES meeting_sessions(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('[Migration] Created session_next_plan');

  // ────────────────────────────────────
  // g) session_quality_flags — quality issue flags
  // ────────────────────────────────────
  await runAsync(`DROP TABLE IF EXISTS session_quality_flags`);
  await runAsync(`
    CREATE TABLE session_quality_flags (
      id INT AUTO_INCREMENT PRIMARY KEY,
      session_id INT NOT NULL UNIQUE,
      flags JSON NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_sqf_session (session_id),
      CONSTRAINT fk_sqf_session FOREIGN KEY (session_id) REFERENCES meeting_sessions(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('[Migration] Created session_quality_flags');

  // ────────────────────────────────────
  // h) session_final_evaluation — overall evaluation summary
  // ────────────────────────────────────
  await runAsync(`DROP TABLE IF EXISTS session_final_evaluation`);
  await runAsync(`
    CREATE TABLE session_final_evaluation (
      id INT AUTO_INCREMENT PRIMARY KEY,
      session_id INT NOT NULL UNIQUE,
      overall_session_rating VARCHAR(255) NOT NULL,
      teacher_performance VARCHAR(255) NOT NULL,
      student_engagement VARCHAR(255) NOT NULL,
      learning_impact VARCHAR(255) NOT NULL,
      parent_communication_readiness VARCHAR(255) NOT NULL,
      recommended_action VARCHAR(255) NOT NULL,
      summary_narrative TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_sfe_session (session_id),
      CONSTRAINT fk_sfe_session FOREIGN KEY (session_id) REFERENCES meeting_sessions(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('[Migration] Created session_final_evaluation');

  // ────────────────────────────────────
  // i) session_snapshot — high-level session summary card
  // ────────────────────────────────────
  await runAsync(`DROP TABLE IF EXISTS session_snapshot`);
  await runAsync(`
    CREATE TABLE session_snapshot (
      id INT AUTO_INCREMENT PRIMARY KEY,
      session_id INT NOT NULL UNIQUE,
      student_grade VARCHAR(100) NOT NULL,
      curriculum VARCHAR(255) NOT NULL,
      location VARCHAR(255) NOT NULL,
      subject VARCHAR(255) NOT NULL,
      topics_covered JSON NOT NULL,
      session_objective_status VARCHAR(100) NOT NULL,
      overall_score_pct DECIMAL(5,2) DEFAULT NULL,
      overall_rating VARCHAR(100) NOT NULL,
      student_engagement VARCHAR(100) NOT NULL,
      learning_impact VARCHAR(100) NOT NULL,
      parent_shareability VARCHAR(100) NOT NULL,
      executive_summary TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_ss_session (session_id),
      CONSTRAINT fk_ss_session FOREIGN KEY (session_id) REFERENCES meeting_sessions(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('[Migration] Created session_snapshot');

  console.log(`[Migration ${migrationName}] Complete — 9 tables created.`);
};

const down = async () => {
  const tables = [
    'session_analysis',
    'session_learning_impact',
    'session_parent_summary',
    'session_coaching_feedback',
    'session_better_alternatives',
    'session_next_plan',
    'session_quality_flags',
    'session_final_evaluation',
    'session_snapshot'
  ];
  for (const t of tables) {
    await runAsync(`DROP TABLE IF EXISTS ${t}`);
  }
  console.log(`[Migration ${migrationName}] Rolled back — 9 tables dropped.`);
};

module.exports = { up, down, migrationName };