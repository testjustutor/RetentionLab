/**
 * root/database/migrations/000_comprehensive_schema.js
 * 
 * Complete database schema with all tables, indexes, foreign keys.
 * This replaces all individual migration files for fresh installs.
 * 
 * Features:
 * - AUTO_INCREMENT on all id columns
 * - utf8mb4 charset on all tables
 * - Proper indexes and foreign keys
 * - IF NOT EXISTS for idempotency
 */

const { runAsync } = require('../seedHelpers');

const migrationName = '000_comprehensive_schema';

const up = async () => {
  console.log('[Migration] Creating comprehensive schema...');

  // ─── 1. roles ─────────────────────────────────────────────────────────────
  await runAsync(`CREATE TABLE IF NOT EXISTS roles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    role_name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  // ─── 2. companies ─────────────────────────────────────────────────────────
  await runAsync(`CREATE TABLE IF NOT EXISTS companies (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_uuid VARCHAR(255) UNIQUE,
    company_name VARCHAR(255) NOT NULL,
    company_code VARCHAR(100) UNIQUE,
    domain VARCHAR(255),
    logo_url TEXT,
    status VARCHAR(50) DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  // ─── 3. users ─────────────────────────────────────────────────────────────
  await runAsync(`CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_uuid VARCHAR(255) UNIQUE,
    company_id INT,
    role_id INT,
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    phone VARCHAR(50),
    profile_image TEXT,
    status VARCHAR(50) DEFAULT 'active',
    is_active TINYINT(1) DEFAULT 1,
    email_verified TINYINT(1) DEFAULT 0,
    email_verified_at DATETIME,
    created_by INT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_by INT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_users_company (company_id),
    INDEX idx_users_role (role_id),
    INDEX idx_users_email (email),
    INDEX idx_users_status (status),
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL,
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  // ─── 4. permissions ───────────────────────────────────────────────────────
  await runAsync(`CREATE TABLE IF NOT EXISTS permissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    permission_key VARCHAR(255) UNIQUE NOT NULL,
    label VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  // ─── 5. role_permissions ──────────────────────────────────────────────────
  await runAsync(`CREATE TABLE IF NOT EXISTS role_permissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    role_id INT NOT NULL,
    permission_id INT NOT NULL,
    company_id INT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_role_perm (role_id, permission_id, company_id),
    INDEX idx_rp_role (role_id),
    INDEX idx_rp_permission (permission_id),
    INDEX idx_rp_company (company_id),
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  // ─── 6. departments ───────────────────────────────────────────────────────
  await runAsync(`CREATE TABLE IF NOT EXISTS departments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    deleted_at DATETIME DEFAULT NULL,
    deleted_by INT DEFAULT NULL,
    updated_by INT DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_dept_company (company_id),
    INDEX idx_dept_deleted_at (deleted_at),
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (deleted_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  // ─── 7. department_members ────────────────────────────────────────────────
  await runAsync(`CREATE TABLE IF NOT EXISTS department_members (
    id INT AUTO_INCREMENT PRIMARY KEY,
    department_id INT NOT NULL,
    user_id INT NOT NULL,
    role_id INT,
    joined_by INT,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) DEFAULT 'active',
    created_by INT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_by INT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME,
    deleted_by INT,
    UNIQUE KEY unique_dept_user (department_id, user_id),
    INDEX idx_dm_department (department_id),
    INDEX idx_dm_user (user_id),
    INDEX idx_dm_role (role_id),
    INDEX idx_dm_status (status),
    INDEX idx_dm_deleted_at (deleted_at),
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (deleted_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (joined_by) REFERENCES users(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  // ─── 8. meetings ──────────────────────────────────────────────────────────
  await runAsync(`CREATE TABLE IF NOT EXISTS meetings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    external_meeting_id VARCHAR(255),
    title VARCHAR(500),
    description TEXT,
    scheduled_start_time DATETIME,
    scheduled_end_time DATETIME,
    actual_start_time DATETIME NULL,
    actual_end_time DATETIME NULL,
    platform VARCHAR(50),
    calendar_account VARCHAR(255),
    meeting_link TEXT,
    passcode VARCHAR(255),
    status VARCHAR(50) DEFAULT 'scheduled',
    event_id VARCHAR(255),
    timezone VARCHAR(100),
    created_by INT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_meetings_status (status),
    INDEX idx_meetings_platform (platform),
    INDEX idx_meetings_calendar (calendar_account),
    INDEX idx_meetings_start (scheduled_start_time),
    INDEX idx_meetings_event_id (event_id),
    INDEX idx_meetings_owner_user_id (owner_user_id),
    INDEX idx_meetings_company_id (company_id),
    INDEX idx_meetings_session_id (session_id),
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  // ─── 9. meeting_sessions ──────────────────────────────────────────────────
  await runAsync(`CREATE TABLE IF NOT EXISTS meeting_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    meeting_id VARCHAR(255),
    transcript_file_name TEXT,
    audio_file_name TEXT,
    start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    end_time DATETIME,
    status VARCHAR(50) DEFAULT 'completed',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_ms_meeting (meeting_id),
    INDEX idx_ms_status (status),
    FOREIGN KEY (meeting_id) REFERENCES meetings(meeting_id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  // ─── 10. participants ─────────────────────────────────────────────────────
  await runAsync(`CREATE TABLE IF NOT EXISTS participants (
    id INT AUTO_INCREMENT PRIMARY KEY,
    meeting_id VARCHAR(255),
    participant_name VARCHAR(255),
    participant_email VARCHAR(255),
    participant_role VARCHAR(50),
    join_time DATETIME,
    leave_time DATETIME,
    deleted_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_part_meeting (meeting_id),
    INDEX idx_part_deleted_at (deleted_at),
    FOREIGN KEY (meeting_id) REFERENCES meetings(meeting_id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  // ─── 11. participant_sessions ─────────────────────────────────────────────
  await runAsync(`CREATE TABLE IF NOT EXISTS participant_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    meeting_id VARCHAR(255),
    session_id VARCHAR(255),
    participant_name VARCHAR(255),
    join_sequence INT,
    joined_at DATETIME,
    left_at DATETIME,
    session_duration_seconds INT,
    total_meeting_duration_seconds INT,
    participant_count_at_join INT,
    session_status VARCHAR(50),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_ps_meeting (meeting_id),
    FOREIGN KEY (meeting_id) REFERENCES meetings(meeting_id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  // ─── 12. participant_attendance_sessions ──────────────────────────────────
  await runAsync(`CREATE TABLE IF NOT EXISTS participant_attendance_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    meeting_id VARCHAR(255),
    participant_id INT,
    session_number INT,
    joined_at DATETIME,
    left_at DATETIME,
    duration_seconds INT,
    attendance_status VARCHAR(50),
    deleted_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_pas_meeting (meeting_id),
    INDEX idx_pas_participant (participant_id),
    INDEX idx_pas_deleted_at (deleted_at),
    FOREIGN KEY (meeting_id) REFERENCES meetings(meeting_id) ON DELETE CASCADE,
    FOREIGN KEY (participant_id) REFERENCES participants(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  // ─── 13. meeting_assets ───────────────────────────────────────────────────
  await runAsync(`CREATE TABLE IF NOT EXISTS meeting_assets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    meeting_id VARCHAR(255) NOT NULL,
    session_id VARCHAR(255) NOT NULL,
    audio_path TEXT,    
    wav_audio_path TEXT,
    transcript_path TEXT,
    audit_json_path TEXT,
    screenshots_json JSON,
    oqi_score DECIMAL(5,2) DEFAULT NULL,
    audit_summary JSON DEFAULT NULL,
    audit_completed_at DATETIME DEFAULT NULL,    
    status VARCHAR(50) DEFAULT NULL,
    processed_at DATETIME DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_ma_meeting (meeting_id),
    FOREIGN KEY (meeting_id) REFERENCES meetings(meeting_id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  // ─── 14. meeting_reviewers ────────────────────────────────────────────────
  await runAsync(`CREATE TABLE IF NOT EXISTS meeting_reviewers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    meeting_id VARCHAR(255),
    reviewer_id INT,
    assigned_by INT,
    review_status VARCHAR(50) DEFAULT 'pending',
    assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    reviewed_at DATETIME,
    comments TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_mr_meeting (meeting_id),
    INDEX idx_mr_reviewer (reviewer_id),
    FOREIGN KEY (meeting_id) REFERENCES meetings(meeting_id) ON DELETE CASCADE,
    FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  // ─── 15. meeting_scores ───────────────────────────────────────────────────
  await runAsync(`CREATE TABLE IF NOT EXISTS meeting_scores (
    id INT AUTO_INCREMENT PRIMARY KEY,
    meeting_id VARCHAR(255),
    indicator_id VARCHAR(255),
    reviewer_id INT,
    score DECIMAL(5,2),
    comment TEXT,
    score_type VARCHAR(50) DEFAULT 'AI',
    scored_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_ms_meeting (meeting_id),
    INDEX idx_ms_indicator (indicator_id),
    INDEX idx_ms_reviewer (reviewer_id),
    FOREIGN KEY (meeting_id) REFERENCES meetings(meeting_id) ON DELETE CASCADE,
    FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  // ─── 16. meeting_session_scores ───────────────────────────────────────────
  await runAsync(`CREATE TABLE IF NOT EXISTS meeting_session_scores (
    id INT AUTO_INCREMENT PRIMARY KEY,
    meeting_id VARCHAR(255),
    session_id VARCHAR(255),
    indicator_id VARCHAR(255),
    score DECIMAL(5,2),
    score_type VARCHAR(50) DEFAULT 'AI',
    comment TEXT,
    reviewer_id INT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_mss_meeting (meeting_id),
    INDEX idx_mss_session (session_id),
    INDEX idx_mss_indicator (indicator_id),
    FOREIGN KEY (meeting_id) REFERENCES meetings(meeting_id) ON DELETE CASCADE,
    FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  // ─── 17. rubric_categories ────────────────────────────────────────────────
  await runAsync(`CREATE TABLE IF NOT EXISTS rubric_categories (
    category_id VARCHAR(10) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    weight DECIMAL(5,2) NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  // ─── 18. rubric_indicators ────────────────────────────────────────────────
  await runAsync(`CREATE TABLE IF NOT EXISTS rubric_indicators (
    indicator_id VARCHAR(255) PRIMARY KEY,
    category_id VARCHAR(10),
    name VARCHAR(255) NOT NULL,
    type ENUM('AI', 'HUMAN') DEFAULT 'AI',
    is_gate TINYINT(1) DEFAULT 0,
    value INT DEFAULT 1,
    benchmark TEXT,
    requires_video TINYINT(1) DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_ri_category (category_id),
    FOREIGN KEY (category_id) REFERENCES rubric_categories(category_id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  // ─── 19. rubric_assignments ───────────────────────────────────────────────
  await runAsync(`CREATE TABLE IF NOT EXISTS rubric_assignments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id INT,
    rubric_type VARCHAR(50) DEFAULT 'default',
    rubric_id INT,
    assigned_by INT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_ra_session (session_id),
    INDEX idx_ra_assigned (assigned_by),
    FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  // ─── 20. rubric_audit_log ─────────────────────────────────────────────────
  await runAsync(`CREATE TABLE IF NOT EXISTS rubric_audit_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id INT,
    action VARCHAR(50),
    performed_by INT,
    details JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_ral_session (session_id),
    INDEX idx_ral_performed (performed_by),
    FOREIGN KEY (performed_by) REFERENCES users(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  // ─── 21. session_snapshot ─────────────────────────────────────────────────
  await runAsync(`CREATE TABLE IF NOT EXISTS session_snapshot (
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
    FOREIGN KEY (session_id) REFERENCES meeting_sessions(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  // ─── 22. session_analysis ─────────────────────────────────────────────────
  await runAsync(`CREATE TABLE IF NOT EXISTS session_analysis (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id INT NOT NULL UNIQUE,
    what_worked_well JSON NOT NULL,
    what_needs_improvement JSON NOT NULL,
    missed_opportunities JSON NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_sa_session (session_id),
    FOREIGN KEY (session_id) REFERENCES meeting_sessions(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  // ─── 23. session_learning_impact ──────────────────────────────────────────
  await runAsync(`CREATE TABLE IF NOT EXISTS session_learning_impact (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id INT NOT NULL UNIQUE,
    impact_areas JSON NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_sli_session (session_id),
    FOREIGN KEY (session_id) REFERENCES meeting_sessions(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  // ─── 24. session_parent_summary ───────────────────────────────────────────
  await runAsync(`CREATE TABLE IF NOT EXISTS session_parent_summary (
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
    FOREIGN KEY (session_id) REFERENCES meeting_sessions(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  // ─── 25. session_coaching_feedback ────────────────────────────────────────
  await runAsync(`CREATE TABLE IF NOT EXISTS session_coaching_feedback (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id INT NOT NULL UNIQUE,
    strengths JSON NOT NULL,
    areas_to_improve JSON NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_scf_session (session_id),
    FOREIGN KEY (session_id) REFERENCES meeting_sessions(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  // ─── 26. session_better_alternatives ──────────────────────────────────────
  await runAsync(`CREATE TABLE IF NOT EXISTS session_better_alternatives (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id INT NOT NULL UNIQUE,
    items JSON NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_sba_session (session_id),
    FOREIGN KEY (session_id) REFERENCES meeting_sessions(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  // ─── 27. session_next_plan ────────────────────────────────────────────────
  await runAsync(`CREATE TABLE IF NOT EXISTS session_next_plan (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id INT NOT NULL UNIQUE,
    segments JSON NOT NULL,
    priority_focus JSON NOT NULL,
    gaps_to_address JSON NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_snp_session (session_id),
    FOREIGN KEY (session_id) REFERENCES meeting_sessions(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  // ─── 28. session_quality_flags ────────────────────────────────────────────
  await runAsync(`CREATE TABLE IF NOT EXISTS session_quality_flags (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id INT NOT NULL UNIQUE,
    flags JSON NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_sqf_session (session_id),
    FOREIGN KEY (session_id) REFERENCES meeting_sessions(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  // ─── 29. session_final_evaluation ─────────────────────────────────────────
  await runAsync(`CREATE TABLE IF NOT EXISTS session_final_evaluation (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id INT NOT NULL UNIQUE,
    overall_session_rating VARCHAR(255),
    teacher_performance VARCHAR(255),
    student_engagement VARCHAR(255),
    learning_impact VARCHAR(255),
    parent_communication_readiness VARCHAR(255),
    recommended_action VARCHAR(255),
    summary_narrative TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_sfe_session (session_id),
    FOREIGN KEY (session_id) REFERENCES meeting_sessions(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  // ─── 30. session_rubric_evaluations ───────────────────────────────────────
  await runAsync(`CREATE TABLE IF NOT EXISTS session_rubric_evaluations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id INT NOT NULL,
    indicator_id VARCHAR(255) NOT NULL,
    rating ENUM('Met', 'Partial', 'Not met', 'N/A') DEFAULT 'N/A',
    evidence_text TEXT,
    comment TEXT,
    evaluated_by ENUM('AI', 'HUMAN') DEFAULT 'AI',
    confidence ENUM('High', 'Medium', 'Low') DEFAULT 'Medium',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_session_indicator (session_id, indicator_id),
    INDEX idx_sre_session (session_id),
    INDEX idx_sre_indicator (indicator_id),
    FOREIGN KEY (session_id) REFERENCES meeting_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (indicator_id) REFERENCES rubric_indicators(indicator_id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  // ─── 31. session_rubric_summary ───────────────────────────────────────────
  await runAsync(`CREATE TABLE IF NOT EXISTS session_rubric_summary (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id INT NOT NULL UNIQUE,
    weighted_score_pct DECIMAL(5,2) DEFAULT 0.00,
    gate_status ENUM('all_passed', 'gate_failed') DEFAULT 'all_passed',
    overall_rating VARCHAR(50) DEFAULT 'Developing',
    confidence_level VARCHAR(255) DEFAULT 'Medium',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_srs_session (session_id),
    FOREIGN KEY (session_id) REFERENCES meeting_sessions(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  // ─── 32. session_metadata ─────────────────────────────────────────────────
  await runAsync(`CREATE TABLE IF NOT EXISTS session_metadata (
    id INT AUTO_INCREMENT PRIMARY KEY,
    meeting_id VARCHAR(255),
    student_name VARCHAR(255),
    teacher_user_id INT,
    subject VARCHAR(255),
    student_grade VARCHAR(100),
    curriculum VARCHAR(255),
    topic VARCHAR(255),
    session_objective TEXT,
    session_type VARCHAR(50) DEFAULT 'one-to-one',
    student_location VARCHAR(255),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_sm_meeting (meeting_id),
    INDEX idx_sm_teacher (teacher_user_id),
    FOREIGN KEY (meeting_id) REFERENCES meetings(meeting_id) ON DELETE CASCADE,
    FOREIGN KEY (teacher_user_id) REFERENCES users(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  // ─── 33. transcripts ──────────────────────────────────────────────────────
  await runAsync(`CREATE TABLE IF NOT EXISTS transcripts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    meeting_id VARCHAR(255),
    session_id VARCHAR(255),
    transcript_text LONGTEXT,
    analysis_json JSON,
    language VARCHAR(50) DEFAULT 'en',
    duration_seconds INT,
    word_count INT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_tr_meeting (meeting_id),
    FOREIGN KEY (meeting_id) REFERENCES meetings(meeting_id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  // ─── 34. ai_audit_results ─────────────────────────────────────────────────
  await runAsync(`CREATE TABLE IF NOT EXISTS ai_audit_results (
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
    INDEX idx_ar_indicator (indicator_id),
    FOREIGN KEY (meeting_id) REFERENCES meetings(meeting_id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES rubric_categories(category_id) ON DELETE CASCADE,
    FOREIGN KEY (indicator_id) REFERENCES rubric_indicators(indicator_id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  // ─── 35. system_settings ──────────────────────────────────────────────────
  await runAsync(`CREATE TABLE IF NOT EXISTS system_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT,
    setting_key VARCHAR(255) NOT NULL,
    setting_value TEXT,
    setting_type VARCHAR(50) DEFAULT 'string',
    is_static TINYINT(1) DEFAULT 0,
    is_editable TINYINT(1) DEFAULT 1,
    editable_by_role VARCHAR(255),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_setting (company_id, setting_key),
    INDEX idx_ss_key (setting_key),
    INDEX idx_ss_company (company_id),
    INDEX idx_ss_editable (is_editable),
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  // ─── 36. user_settings ────────────────────────────────────────────────────
  await runAsync(`CREATE TABLE IF NOT EXISTS user_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    setting_key VARCHAR(255) NOT NULL,
    setting_value TEXT,
    setting_type VARCHAR(50) DEFAULT 'string',
    editable_by_role VARCHAR(255),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_user_setting (user_id, setting_key),
    INDEX idx_us_user (user_id),
    INDEX idx_us_key (setting_key),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  // ─── 37. header_role_configs ──────────────────────────────────────────────
  await runAsync(`CREATE TABLE IF NOT EXISTS header_role_configs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    role_id INT,
    home_href VARCHAR(500),
    home_label VARCHAR(255),
    events_href VARCHAR(500),
    events_label VARCHAR(255),
    archives_href VARCHAR(500),
    archives_label VARCHAR(255),
    profile_href VARCHAR(500),
    profile_label VARCHAR(255),
    settings_href VARCHAR(500),
    settings_label VARCHAR(255),
    is_active TINYINT(1) DEFAULT 1,
    created_by INT,
    updated_by INT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_hrc_role (role_id),
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  // ─── 38. header_page_configs ──────────────────────────────────────────────
  await runAsync(`CREATE TABLE IF NOT EXISTS header_page_configs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    role_id INT,
    page_key VARCHAR(255),
    title VARCHAR(500),
    description TEXT,
    role_title VARCHAR(255),
    show_stats TINYINT(1) DEFAULT 0,
    buttons_json JSON,
    is_active TINYINT(1) DEFAULT 1,
    created_by INT,
    updated_by INT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_hpc_role (role_id),
    INDEX idx_hpc_page (page_key),
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  // ─── 39. header_menu_items ────────────────────────────────────────────────
  await runAsync(`CREATE TABLE IF NOT EXISTS header_menu_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    role_id INT,
    menu_id VARCHAR(255),
    parent_id VARCHAR(255),
    label VARCHAR(255),
    icon VARCHAR(100),
    href VARCHAR(500),
    display_order INT DEFAULT 0,
    is_active TINYINT(1) DEFAULT 1,
    section VARCHAR(100) DEFAULT 'main',
    color VARCHAR(50) DEFAULT 'violet',
    created_by INT,
    updated_by INT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_hmi_role (role_id),
    INDEX idx_hmi_parent (parent_id),
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  // ─── 40. admin_rubric_indicators ──────────────────────────────────────────
  await runAsync(`CREATE TABLE IF NOT EXISTS admin_rubric_indicators (
    id INT AUTO_INCREMENT PRIMARY KEY,
    category_id INT,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    weight DECIMAL(5,2) DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_ari_category (category_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  // ─── 41. calendar_integrations ────────────────────────────────────────────
  await runAsync(`CREATE TABLE IF NOT EXISTS calendar_integrations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    platform VARCHAR(50),
    provider VARCHAR(50) DEFAULT 'google',
    provider_id INT DEFAULT NULL,
    access_token TEXT,
    refresh_token TEXT,
    expires_at DATETIME,
    token_expiry DATETIME,
    status VARCHAR(50) DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_ci_user (user_id),
    INDEX idx_ci_platform (platform),
    INDEX idx_ci_provider (provider),
    INDEX idx_ci_provider_id (provider_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (provider_id) REFERENCES calendar_providers(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  // ─── 42. calendar_verifications ───────────────────────────────────────────
  await runAsync(`CREATE TABLE IF NOT EXISTS calendar_verifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    provider VARCHAR(50) DEFAULT NULL,
    code VARCHAR(255),
    token TEXT DEFAULT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    expires_at DATETIME DEFAULT NULL,
    verified_at DATETIME DEFAULT NULL,
    connected_at DATETIME DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_cv_user (user_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  // ─── 43. calendar_credentials ─────────────────────────────────────────────
  await runAsync(`CREATE TABLE IF NOT EXISTS calendar_credentials (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    provider VARCHAR(50),
    credentials_json JSON,
    is_active TINYINT(1) DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_cc_user (user_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  // ─── 44. calendar_providers ───────────────────────────────────────────────
  await runAsync(`CREATE TABLE IF NOT EXISTS calendar_providers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    display_name VARCHAR(255),
    is_enabled TINYINT(1) DEFAULT 1,
    config_json JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  // ─── 45. google_oauth_credentials ─────────────────────────────────────────
  await runAsync(`CREATE TABLE IF NOT EXISTS google_oauth_credentials (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    redirect_uris JSON,
    auth_uri VARCHAR(500),
    token_uri VARCHAR(500),
    scopes JSON,
    is_active TINYINT(1) DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_goc_user (user_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  // ─── 46. email_logs ───────────────────────────────────────────────────────
  await runAsync(`CREATE TABLE IF NOT EXISTS email_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    recipient VARCHAR(255),
    subject VARCHAR(500),
    body TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    sent_at DATETIME,
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_el_recipient (recipient),
    INDEX idx_el_status (status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  // ─── 47. user_invitations ─────────────────────────────────────────────────
  await runAsync(`CREATE TABLE IF NOT EXISTS user_invitations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    token VARCHAR(255) UNIQUE NOT NULL,
    role_id INT,
    company_id INT,
    invited_by INT,
    status VARCHAR(50) DEFAULT 'pending',
    expires_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_ui_email (email),
    INDEX idx_ui_token (token),
    INDEX idx_ui_status (status),
    FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  // ─── 48. user_permissions ─────────────────────────────────────────────────
  await runAsync(`CREATE TABLE IF NOT EXISTS user_permissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    permission_id INT NOT NULL,
    company_id INT,
    granted_by INT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_user_perm (user_id, permission_id, company_id),
    INDEX idx_up_user (user_id),
    INDEX idx_up_permission (permission_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  // ─── 49. subscriptions ────────────────────────────────────────────────────
  await runAsync(`CREATE TABLE IF NOT EXISTS subscriptions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT,
    plan_type VARCHAR(100),
    status VARCHAR(50) DEFAULT 'active',
    start_date DATETIME,
    end_date DATETIME,
    features_json JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_sub_company (company_id),
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  // ─── 50. next_session_plan (legacy) ───────────────────────────────────────
  await runAsync(`CREATE TABLE IF NOT EXISTS next_session_plan (
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
    INDEX idx_nsp_meeting (meeting_id),
    FOREIGN KEY (meeting_id) REFERENCES meetings(meeting_id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  // ─── 51. session_quality_reports (legacy) ─────────────────────────────────
  await runAsync(`CREATE TABLE IF NOT EXISTS session_quality_reports (
    id INT AUTO_INCREMENT PRIMARY KEY,
    meeting_id VARCHAR(255),
    overall_score INT,
    max_possible_score INT,
    percentage_score DECIMAL(5,2),
    overall_rating VARCHAR(100),
    student_engagement VARCHAR(100),
    learning_impact VARCHAR(100),
    parent_shareability VARCHAR(100),
    confidence_level VARCHAR(100),
    confidence_reason TEXT,
    executive_summary TEXT,
    generated_by VARCHAR(50) DEFAULT 'AI',
    generated_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_sqr_meeting (meeting_id),
    FOREIGN KEY (meeting_id) REFERENCES meetings(meeting_id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  // ─── 52. student_learning_impact (legacy) ─────────────────────────────────
  await runAsync(`CREATE TABLE IF NOT EXISTS student_learning_impact (
    id INT AUTO_INCREMENT PRIMARY KEY,
    meeting_id VARCHAR(255),
    impact_area VARCHAR(255),
    impact_level VARCHAR(50),
    observation TEXT,
    evidence TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_sli_meeting (meeting_id),
    FOREIGN KEY (meeting_id) REFERENCES meetings(meeting_id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  // ─── 53. teacher_coaching_feedback (legacy) ───────────────────────────────
  await runAsync(`CREATE TABLE IF NOT EXISTS teacher_coaching_feedback (
    id INT AUTO_INCREMENT PRIMARY KEY,
    meeting_id VARCHAR(255),
    feedback_type VARCHAR(50),
    area VARCHAR(255),
    evidence TEXT,
    why_it_matters TEXT,
    recommended_action TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_tcf_meeting (meeting_id),
    FOREIGN KEY (meeting_id) REFERENCES meetings(meeting_id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  // ─── 54. teacher_better_alternatives (legacy) ─────────────────────────────
  await runAsync(`CREATE TABLE IF NOT EXISTS teacher_better_alternatives (
    id INT AUTO_INCREMENT PRIMARY KEY,
    meeting_id VARCHAR(255),
    transcript_situation TEXT,
    current_approach TEXT,
    better_alternative TEXT,
    purpose TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_tba_meeting (meeting_id),
    FOREIGN KEY (meeting_id) REFERENCES meetings(meeting_id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  // ─── 55. archives ─────────────────────────────────────────────────────────
  await runAsync(`CREATE TABLE IF NOT EXISTS archives (
    id INT AUTO_INCREMENT PRIMARY KEY,
    meeting_id VARCHAR(255),
    archive_type VARCHAR(50),
    archive_path TEXT,
    archive_json JSON,
    archived_by INT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_arch_meeting (meeting_id),
    INDEX idx_arch_type (archive_type),
    INDEX idx_arch_by (archived_by),
    FOREIGN KEY (meeting_id) REFERENCES meetings(meeting_id) ON DELETE CASCADE,
    FOREIGN KEY (archived_by) REFERENCES users(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  // ─── 56. menu_items ────────────────────────────────────────────────────────
  await runAsync(`CREATE TABLE IF NOT EXISTS menu_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    menu_key VARCHAR(100) UNIQUE NOT NULL,
    label VARCHAR(255) NOT NULL,
    icon VARCHAR(100),
    route_path VARCHAR(500),
    parent_id INT NULL,
    sort_order INT DEFAULT 0,
    is_active TINYINT(1) DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_parent (parent_id),
    INDEX idx_sort (sort_order),
    INDEX idx_active (is_active),
    FOREIGN KEY (parent_id) REFERENCES menu_items(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  // ─── 57. role_menu_permissions ─────────────────────────────────────────────
  await runAsync(`CREATE TABLE IF NOT EXISTS role_menu_permissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    role_id INT NOT NULL,
    menu_item_id INT NOT NULL,
    is_visible TINYINT(1) DEFAULT 1,
    sort_order INT DEFAULT 0,
    parent_id INT DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_role_menu (role_id, menu_item_id),
    INDEX idx_role (role_id),
    INDEX idx_menu_item (menu_item_id),
    INDEX idx_parent (parent_id),
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES role_menu_permissions(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  // ─── 58. user_menu_permissions ─────────────────────────────────────────────
  await runAsync(`CREATE TABLE IF NOT EXISTS user_menu_permissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    menu_item_id INT NOT NULL,
    parent_id INT DEFAULT NULL,
    is_visible TINYINT(1) DEFAULT 1,
    sort_order INT DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_user_menu (user_id, menu_item_id),
    INDEX idx_user (user_id),
    INDEX idx_menu_item (menu_item_id),
    INDEX idx_parent (parent_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES user_menu_permissions(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  // ─── 59. header_configs ───────────────────────────────────────────────────
  await runAsync(`CREATE TABLE IF NOT EXISTS header_configs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    config_key VARCHAR(255) UNIQUE NOT NULL,
    config_json JSON NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  console.log('[Migration] Comprehensive schema created — 58 tables');
};

const down = async () => {
  const tables = [
    'admin_rubric_categories', 'header_configs', 'menu_items', 'role_menu_permissions', 'user_menu_permissions',
    'archives', 'teacher_better_alternatives', 'teacher_coaching_feedback',
    'student_learning_impact', 'session_quality_reports', 'next_session_plan',
    'subscriptions', 'user_permissions', 'user_invitations', 'email_logs',
    'google_oauth_credentials', 'calendar_providers', 'calendar_credentials',
    'calendar_verifications', 'calendar_integrations', 'admin_rubric_indicators',
    'header_menu_items', 'header_page_configs',
    'header_role_configs', 'user_settings', 'system_settings', 'ai_audit_results',
    'transcripts', 'session_metadata', 'session_rubric_summary', 'session_rubric_evaluations',
    'session_final_evaluation', 'session_quality_flags', 'session_next_plan',
    'session_better_alternatives', 'session_coaching_feedback', 'session_parent_summary',
    'session_learning_impact', 'session_analysis', 'session_snapshot',
    'rubric_audit_log', 'rubric_assignments', 'rubric_indicators', 'rubric_categories',
    'meeting_session_scores', 'meeting_scores', 'meeting_reviewers', 'meeting_assets',
    'participant_attendance_sessions', 'participant_sessions', 'participants',
    'meeting_sessions', 'meetings', 'department_members', 'departments',
    'role_permissions', 'permissions', 'users', 'companies', 'roles'
  ];
  for (const t of tables) {
    await runAsync(`DROP TABLE IF EXISTS ${t}`);
  }
  console.log('[Migration] All tables dropped');
};

module.exports = { up, down, migrationName };