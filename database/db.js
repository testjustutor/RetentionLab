/**
 * root/database/db.js
 */
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '..', 'retention_lab.db');
const db = new sqlite3.Database(dbPath);

// ─── Shared helpers (module-level, reused by both initDB and runSeeder) ────────

const runAsync = (sql, params = []) => new Promise((res, rej) => {
    db.run(sql, params, function (err) {
        if (err) return rej(err);
        res(this);
    });
});

const allAsync = (sql, params = []) => new Promise((res, rej) => {
    db.all(sql, params, (err, rows) => {
        if (err) return rej(err);
        res(rows);
    });
});

const getAsync = (sql, params = []) => new Promise((res, rej) => {
    db.get(sql, params, (err, row) => {
        if (err) return rej(err);
        res(row);
    });
});

// ─── 1. Database Initialization (run once on startup) ─────────────────────────
// Only CREATE TABLE IF NOT EXISTS and CREATE INDEX IF NOT EXISTS.
// No seeding, no migrations, no ALTER TABLE.

const initDB = () => {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            (async () => {
                try {
                    await runAsync(`
                        CREATE TABLE IF NOT EXISTS companies (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            company_uuid TEXT UNIQUE,
                            company_name TEXT,
                            company_code TEXT UNIQUE,
                            domain TEXT,
                            logo_url TEXT,
                            status TEXT DEFAULT 'active',
                            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                            deleted_at DATETIME
                        )
                    `);

                    await runAsync(`
                        CREATE TABLE IF NOT EXISTS roles (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            role_name TEXT UNIQUE NOT NULL,
                            description TEXT,
                            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                        )
                    `);

                    await runAsync(`
                        CREATE TABLE IF NOT EXISTS users (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            user_uuid TEXT UNIQUE,
                            company_id INTEGER,
                            role_id INTEGER,
                            first_name TEXT,
                            last_name TEXT,
                            email TEXT UNIQUE,
                            password_hash TEXT,
                            phone TEXT,
                            profile_image TEXT,
                            status TEXT DEFAULT 'active',
                            last_login_at DATETIME,
                            created_by INTEGER,
                            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                            deleted_at DATETIME,
                            FOREIGN KEY (company_id) REFERENCES companies(id),
                            FOREIGN KEY (role_id) REFERENCES roles(id)
                        )
                    `);

                    await runAsync(`
                        CREATE TABLE IF NOT EXISTS system_settings (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            company_id INTEGER,
                            setting_key TEXT,
                            setting_value TEXT,
                            setting_type TEXT,
                            editable_by_role TEXT,
                            status TEXT DEFAULT 'active',
                            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                            FOREIGN KEY (company_id) REFERENCES companies(id)
                        )
                    `);

                    await runAsync(`
                        CREATE TABLE IF NOT EXISTS user_settings (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            user_id INTEGER,
                            setting_key TEXT,
                            setting_value TEXT,
                            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                            FOREIGN KEY (user_id) REFERENCES users(id)
                        )
                    `);

                    await runAsync(`
                        CREATE TABLE IF NOT EXISTS calendar_integrations (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            user_id INTEGER,
                            provider TEXT,
                            email TEXT UNIQUE,
                            access_token TEXT,
                            refresh_token TEXT,
                            token_expiry INTEGER,
                            status TEXT DEFAULT 'active',
                            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                            FOREIGN KEY (user_id) REFERENCES users(id)
                        )
                    `);

                    await runAsync(`
                        CREATE TABLE IF NOT EXISTS calendar_verifications (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            email TEXT UNIQUE NOT NULL,
                            token TEXT UNIQUE NOT NULL,
                            status TEXT DEFAULT 'pending',
                            expires_at DATETIME NOT NULL,
                            verified_at DATETIME,
                            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                        )
                    `);

                    await runAsync(`
                        CREATE TABLE IF NOT EXISTS meeting_reviewers (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            meeting_id TEXT,
                            reviewer_id INTEGER,
                            assigned_by INTEGER,
                            assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                            review_status TEXT DEFAULT 'pending',
                            reviewed_at DATETIME,
                            comments TEXT,
                            FOREIGN KEY (reviewer_id) REFERENCES users(id),
                            FOREIGN KEY (assigned_by) REFERENCES users(id)
                        )
                    `);

                    await runAsync(`
                        CREATE TABLE IF NOT EXISTS meeting_sessions (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            meeting_id TEXT UNIQUE,
                            transcript_file_name TEXT,
                            audio_file_name TEXT,
                            start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
                            end_time DATETIME
                        )
                    `);

                    await runAsync(`
                        CREATE TABLE IF NOT EXISTS meetings (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            meeting_id TEXT UNIQUE,
                            platform TEXT,
                            passcode TEXT,
                            event_id TEXT,
                            calendar_account TEXT,
                            meeting_link TEXT,
                            timezone TEXT,
                            start_time DATETIME,
                            end_time DATETIME,
                            title TEXT,
                            status TEXT DEFAULT 'joining',
                            session_id TEXT,
                            summary TEXT,
                            company_id INTEGER,
                            owner_user_id INTEGER,
                            reviewer_id INTEGER,
                            created_by_user_id INTEGER,
                            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                            FOREIGN KEY (company_id) REFERENCES companies(id),
                            FOREIGN KEY (owner_user_id) REFERENCES users(id),
                            FOREIGN KEY (reviewer_id) REFERENCES users(id),
                            FOREIGN KEY (created_by_user_id) REFERENCES users(id)
                        )
                    `);

                    await runAsync(`
                        CREATE TABLE IF NOT EXISTS meeting_assets (
                            meeting_id TEXT PRIMARY KEY,
                            audio_path TEXT,
                            transcript_path TEXT,
                            audit_json_path TEXT,
                            wav_audio_path TEXT,
                            whisper_path TEXT,
                            captions_raw_path TEXT,
                            diarization_path TEXT,
                            embeddings_path TEXT,
                            llm_prompts_path TEXT,
                            action_items_path TEXT,
                            sentiment_analysis_path TEXT,
                            talk_ratio_json_path TEXT,
                            user_silence_duration_path TEXT,
                            questions_asked_count_path TEXT,
                            topic_clusters_path TEXT,
                            summary_path TEXT,
                            oqi_score REAL,
                            evidence_quote TEXT,
                            status TEXT DEFAULT 'Start',
                            company_id INTEGER,
                            user_id INTEGER,
                            review_status TEXT DEFAULT 'pending',
                            reviewer_comments TEXT,
                            processed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                            FOREIGN KEY (company_id) REFERENCES companies(id),
                            FOREIGN KEY (user_id) REFERENCES users(id)
                        )
                    `);

                    // ─── MASTER RUBRIC TABLES (Super Admin maintains these) ──────────
                    await runAsync(`
                        CREATE TABLE IF NOT EXISTS rubric_categories (
                            category_id TEXT PRIMARY KEY,
                            name TEXT NOT NULL,
                            weight REAL NOT NULL DEFAULT 0,
                            company_id INTEGER DEFAULT 0
                        )
                    `);

                    await runAsync(`
                        CREATE TABLE IF NOT EXISTS rubric_indicators (
                            indicator_id TEXT PRIMARY KEY,
                            category_id TEXT NOT NULL,
                            name TEXT NOT NULL,
                            type TEXT CHECK(type IN ('AI', 'HUMAN')),
                            is_gate BOOLEAN DEFAULT 0,
                            value REAL DEFAULT 1,
                            company_id INTEGER DEFAULT 0,
                            FOREIGN KEY (category_id) REFERENCES rubric_categories(category_id)
                        )
                    `);

                    // ─── ADMIN RUBRIC ASSIGNMENT TABLES ─────────────────────────────
                    // When Super Admin assigns categories/indicators to an Admin,
                    // copies are created here with admin_id for data isolation.
                    await runAsync(`
                        CREATE TABLE IF NOT EXISTS rubric_assignments (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            category_id TEXT NOT NULL,
                            admin_user_id INTEGER NOT NULL,
                            created_by INTEGER,
                            assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                            FOREIGN KEY (category_id) REFERENCES rubric_categories(category_id),
                            FOREIGN KEY (admin_user_id) REFERENCES users(id),
                            FOREIGN KEY (created_by) REFERENCES users(id),
                            UNIQUE(category_id, admin_user_id)
                        )
                    `);

                    await runAsync(`
                        CREATE TABLE IF NOT EXISTS admin_rubric_categories (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            original_category_id TEXT NOT NULL,
                            admin_user_id INTEGER NOT NULL,
                            name TEXT NOT NULL,
                            weight REAL NOT NULL DEFAULT 0,
                            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                            UNIQUE(original_category_id, admin_user_id)
                        )
                    `);

                    await runAsync(`
                        CREATE TABLE IF NOT EXISTS admin_rubric_indicators (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            original_indicator_id TEXT NOT NULL,
                            original_category_id TEXT NOT NULL,
                            admin_user_id INTEGER NOT NULL,
                            name TEXT NOT NULL,
                            type TEXT CHECK(type IN ('AI', 'HUMAN')) DEFAULT 'HUMAN',
                            is_gate BOOLEAN DEFAULT 0,
                            value REAL DEFAULT 1,
                            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                            UNIQUE(original_indicator_id, admin_user_id)
                        )
                    `);

                    // ─── AUDIT LOG TABLE ───────────────────────────────────────────────
                    await runAsync(`
                        CREATE TABLE IF NOT EXISTS rubric_audit_log (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            action TEXT NOT NULL,
                            entity_type TEXT NOT NULL,
                            entity_id TEXT,
                            admin_user_id INTEGER,
                            performed_by INTEGER NOT NULL,
                            old_values TEXT,
                            new_values TEXT,
                            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                            FOREIGN KEY (performed_by) REFERENCES users(id)
                        )
                    `);

                    await runAsync(`
                        CREATE TABLE IF NOT EXISTS participant_sessions (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            meeting_id TEXT NOT NULL,
                            session_id INTEGER NOT NULL,
                            participant_name TEXT NOT NULL,
                            join_sequence INTEGER NOT NULL DEFAULT 1,
                            joined_at DATETIME NOT NULL,
                            left_at DATETIME,
                            session_duration_seconds INTEGER DEFAULT 0,
                            total_meeting_duration_seconds INTEGER DEFAULT 0,
                            participant_count_at_join INTEGER DEFAULT 0,
                            session_status TEXT CHECK(session_status IN ('active', 'left', 'deleted')) DEFAULT 'active',
                            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                            deleted_at DATETIME
                        )
                    `);

                    await runAsync(`
                        CREATE TABLE IF NOT EXISTS participants (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            meeting_id TEXT NOT NULL,
                            session_id INTEGER NOT NULL,
                            participant_name TEXT NOT NULL,
                            first_joined_at DATETIME NOT NULL,
                            last_left_at DATETIME,
                            total_duration_seconds INTEGER DEFAULT 0,
                            participant_status TEXT CHECK(participant_status IN ('joined', 'left', 'absent')) DEFAULT 'joined',
                            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                            deleted_at DATETIME,
                            UNIQUE(meeting_id, session_id, participant_name)
                        )
                    `);

                    await runAsync(`
                        CREATE TABLE IF NOT EXISTS participant_attendance_sessions (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            meeting_id TEXT NOT NULL,
                            participant_id INTEGER NOT NULL,
                            session_number INTEGER NOT NULL,
                            joined_at DATETIME NOT NULL,
                            left_at DATETIME,
                            duration_seconds INTEGER DEFAULT 0,
                            attendance_status TEXT CHECK(attendance_status IN ('active', 'left', 'deleted')) DEFAULT 'active',
                            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                            deleted_at DATETIME,
                            FOREIGN KEY (participant_id) REFERENCES participants(id),
                            UNIQUE(participant_id, session_number)
                        )
                    `);

                    await runAsync(`
                        CREATE TABLE IF NOT EXISTS meeting_scores (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            meeting_id TEXT NOT NULL,
                            indicator_id TEXT NOT NULL,
                            reviewer_id INTEGER,
                            score INTEGER DEFAULT 0,
                            score_type TEXT DEFAULT 'MANUAL',
                            comment TEXT,
                            scored_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                            FOREIGN KEY (meeting_id) REFERENCES meeting_assets(meeting_id),
                            FOREIGN KEY (indicator_id) REFERENCES rubric_indicators(indicator_id),
                            FOREIGN KEY (reviewer_id) REFERENCES users(id),
                            UNIQUE(meeting_id, indicator_id)
                        )
                    `);

                    // ─── AI AUDIT RESULTS TABLE ─────────────────────────────────────────
                    // Stores per-indicator AI audit scores after AI evaluation
                    await runAsync(`
                        CREATE TABLE IF NOT EXISTS ai_audit_results (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            meeting_id TEXT NOT NULL,
                            session_id INTEGER NOT NULL,
                            category_id TEXT NOT NULL,
                            indicator_id TEXT NOT NULL,
                            ai_score REAL DEFAULT 0,
                            ai_max_score REAL DEFAULT 2,
                            ai_raw_response TEXT,
                            oqi_score REAL DEFAULT 0,
                            evidence_quote TEXT,
                            talk_ratio TEXT,
                            scored_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                            FOREIGN KEY (meeting_id) REFERENCES meeting_assets(meeting_id),
                            FOREIGN KEY (session_id) REFERENCES meeting_sessions(id),
                            UNIQUE(meeting_id, session_id, indicator_id)
                        )
                    `);

                    // ─── Granular Session-Level Scores Table ──────────────────────────
                    await runAsync(`
                        CREATE TABLE IF NOT EXISTS meeting_session_scores (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            meeting_id TEXT NOT NULL,
                            session_id INTEGER NOT NULL,
                            category_id TEXT NOT NULL,
                            indicator_id TEXT NOT NULL,
                            reviewer_id INTEGER NULL,
                            score INTEGER DEFAULT 0,
                            score_type TEXT CHECK(score_type IN ('AI', 'MANUAL')) DEFAULT 'AI',
                            comment TEXT,
                            scored_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                            FOREIGN KEY (meeting_id) REFERENCES meeting_sessions(meeting_id),
                            FOREIGN KEY (indicator_id) REFERENCES rubric_indicators(indicator_id),
                            FOREIGN KEY (reviewer_id) REFERENCES users(id),
                            UNIQUE(meeting_id, session_id, indicator_id)
                        )
                    `);

                    // ─── header_role_configs ──────────────────────────────────────────
                    await runAsync(`
                        CREATE TABLE IF NOT EXISTS header_role_configs (
                            id          INTEGER PRIMARY KEY AUTOINCREMENT,
                            role_id     INTEGER NOT NULL UNIQUE,
                            home_href   TEXT    DEFAULT '/dashboard.html',
                            home_label  TEXT    DEFAULT 'Home',
                            events_href TEXT    DEFAULT '/events.html',
                            events_label TEXT   DEFAULT 'Events',
                            archives_href TEXT  DEFAULT '/archives.html',
                            archives_label TEXT DEFAULT 'Archives',
                            profile_href TEXT  DEFAULT '/profile.html',
                            profile_label TEXT DEFAULT 'Profile',
                            settings_href TEXT DEFAULT '/settings.html',
                            settings_label TEXT DEFAULT 'Settings',
                            is_active   INTEGER NOT NULL DEFAULT 1,
                            created_by  INTEGER,
                            updated_by  INTEGER,
                            created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                            updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                            deleted_at  DATETIME,
                            FOREIGN KEY (role_id)    REFERENCES roles(id),
                            FOREIGN KEY (created_by) REFERENCES users(id),
                            FOREIGN KEY (updated_by) REFERENCES users(id)
                        )
                    `);

                    // ─── header_menu_items ────────────────────────────────────────────
                    await runAsync(`
                        CREATE TABLE IF NOT EXISTS header_menu_items (
                            id          INTEGER PRIMARY KEY AUTOINCREMENT,
                            role_id     INTEGER NOT NULL,
                            menu_id     TEXT    NOT NULL,
                            parent_id   TEXT,
                            label       TEXT    NOT NULL,
                            icon        TEXT,
                            href        TEXT,
                            display_order INTEGER NOT NULL DEFAULT 0,
                            is_active   INTEGER NOT NULL DEFAULT 1,
                            created_by  INTEGER,
                            updated_by  INTEGER,
                            created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                            updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                            deleted_at  DATETIME,
                            UNIQUE(role_id, menu_id),
                            FOREIGN KEY (role_id)    REFERENCES roles(id),
                            FOREIGN KEY (created_by) REFERENCES users(id),
                            FOREIGN KEY (updated_by) REFERENCES users(id)
                        )
                    `);

                    // ─── header_page_configs ──────────────────────────────────────────
                    await runAsync(`
                        CREATE TABLE IF NOT EXISTS header_page_configs (
                            id          INTEGER PRIMARY KEY AUTOINCREMENT,
                            role_id     INTEGER NOT NULL,
                            page_key    TEXT    NOT NULL,
                            title       TEXT    NOT NULL DEFAULT '',
                            description TEXT    NOT NULL DEFAULT '',
                            role_title  TEXT    NOT NULL DEFAULT 'Console',
                            show_stats  INTEGER NOT NULL DEFAULT 0,
                            buttons_json TEXT   NOT NULL DEFAULT '[]',
                            is_active   INTEGER NOT NULL DEFAULT 1,
                            created_by  INTEGER,
                            updated_by  INTEGER,
                            created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                            updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                            deleted_at  DATETIME,
                            UNIQUE(role_id, page_key),
                            FOREIGN KEY (role_id)    REFERENCES roles(id),
                            FOREIGN KEY (created_by) REFERENCES users(id),
                            FOREIGN KEY (updated_by) REFERENCES users(id)
                        )
                    `);

                    // ═══════════════════════════════════════════════════════════════════
                    // ─── NEW: TUTORING SESSION QUALITY TABLES (JustTutors.com) ─────────
                    // ═══════════════════════════════════════════════════════════════════

                    // ─── 1. SESSION METADATA ──────────────────────────────────────────
                    // Stores tutoring-specific context per session (grade, curriculum, etc.)
                    await runAsync(`
                        CREATE TABLE IF NOT EXISTS session_metadata (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            meeting_id TEXT NOT NULL UNIQUE,
                            student_grade TEXT,
                            curriculum TEXT,
                            student_location TEXT,
                            subject TEXT,
                            topic TEXT,
                            session_objective TEXT,
                            session_type TEXT DEFAULT 'one-to-one',
                            teacher_user_id INTEGER,
                            student_name TEXT,
                            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                            FOREIGN KEY (meeting_id) REFERENCES meetings(meeting_id),
                            FOREIGN KEY (teacher_user_id) REFERENCES users(id)
                        )
                    `);

                    // ─── 2. SESSION QUALITY REPORTS ───────────────────────────────────
                    // Master report record: overall scores, ratings, executive summary
                    await runAsync(`
                        CREATE TABLE IF NOT EXISTS session_quality_reports (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            meeting_id TEXT NOT NULL UNIQUE,
                            overall_score REAL DEFAULT 0,
                            max_possible_score REAL DEFAULT 0,
                            percentage_score REAL DEFAULT 0,
                            overall_rating TEXT,
                            student_engagement TEXT,
                            learning_impact TEXT,
                            parent_shareability TEXT,
                            confidence_level TEXT CHECK(confidence_level IN ('High', 'Medium', 'Low')),
                            confidence_reason TEXT,
                            executive_summary TEXT,
                            generated_by TEXT DEFAULT 'AI',
                            generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                            FOREIGN KEY (meeting_id) REFERENCES meetings(meeting_id)
                        )
                    `);

                    // ─── 3. SESSION ANALYSIS ──────────────────────────────────────────
                    // Stores strengths, improvement areas, and missed opportunities
                    await runAsync(`
                        CREATE TABLE IF NOT EXISTS session_analysis (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            meeting_id TEXT NOT NULL,
                            analysis_type TEXT CHECK(analysis_type IN (
                                'strength', 'improvement', 'missed_opportunity'
                            )) NOT NULL,
                            description TEXT NOT NULL,
                            evidence TEXT,
                            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                            FOREIGN KEY (meeting_id) REFERENCES meetings(meeting_id)
                        )
                    `);

                    // ─── 4. STUDENT LEARNING IMPACT ───────────────────────────────────
                    // Per-area impact tracking (concept understanding, confidence, etc.)
                    await runAsync(`
                        CREATE TABLE IF NOT EXISTS student_learning_impact (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            meeting_id TEXT NOT NULL,
                            impact_area TEXT NOT NULL,
                            observation TEXT,
                            evidence TEXT,
                            impact_level TEXT CHECK(impact_level IN (
                                'Strong', 'Moderate', 'Limited', 'Not evident'
                            )),
                            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                            FOREIGN KEY (meeting_id) REFERENCES meetings(meeting_id)
                        )
                    `);

                    // ─── 5. PARENT SUMMARY ────────────────────────────────────────────
                    // Parent-friendly report section per session
                    await runAsync(`
                        CREATE TABLE IF NOT EXISTS session_parent_summary (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            meeting_id TEXT NOT NULL UNIQUE,
                            what_was_covered TEXT,
                            how_student_participated TEXT,
                            progress_noticed TEXT,
                            needs_more_practice TEXT,
                            home_support_suggestions TEXT,
                            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                            FOREIGN KEY (meeting_id) REFERENCES meetings(meeting_id)
                        )
                    `);

                    // ─── 6. TEACHER COACHING FEEDBACK ────────────────────────────────
                    // Stores individual strength and improvement feedback items per session
                    await runAsync(`
                        CREATE TABLE IF NOT EXISTS teacher_coaching_feedback (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            meeting_id TEXT NOT NULL,
                            feedback_type TEXT CHECK(feedback_type IN ('strength', 'improvement')) NOT NULL,
                            area TEXT NOT NULL,
                            evidence TEXT,
                            why_it_matters TEXT,
                            recommended_action TEXT,
                            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                            FOREIGN KEY (meeting_id) REFERENCES meetings(meeting_id)
                        )
                    `);

                    // ─── 7. TEACHER BETTER ALTERNATIVES ──────────────────────────────
                    // Suggested better language or teaching moves for the teacher
                    await runAsync(`
                        CREATE TABLE IF NOT EXISTS teacher_better_alternatives (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            meeting_id TEXT NOT NULL,
                            transcript_situation TEXT NOT NULL,
                            current_approach TEXT,
                            better_alternative TEXT,
                            purpose TEXT,
                            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                            FOREIGN KEY (meeting_id) REFERENCES meetings(meeting_id)
                        )
                    `);

                    // ─── 8. NEXT SESSION PLAN ─────────────────────────────────────────
                    // Recommended next session plan based on transcript gaps and rubric findings
                    await runAsync(`
                        CREATE TABLE IF NOT EXISTS next_session_plan (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            meeting_id TEXT NOT NULL UNIQUE,
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
                            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                            FOREIGN KEY (meeting_id) REFERENCES meetings(meeting_id)
                        )
                    `);

                    // ─── 9. SESSION QUALITY FLAGS ─────────────────────────────────────
                    // Flags with severity levels raised against a session
                    await runAsync(`
                        CREATE TABLE IF NOT EXISTS session_quality_flags (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            meeting_id TEXT NOT NULL,
                            flag_description TEXT NOT NULL,
                            severity TEXT CHECK(severity IN ('High', 'Medium', 'Low')) NOT NULL,
                            evidence TEXT,
                            recommended_fix TEXT,
                            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                            FOREIGN KEY (meeting_id) REFERENCES meetings(meeting_id)
                        )
                    `);

                    // ─── 10. SESSION FINAL EVALUATION ─────────────────────────────────
                    // AQ team's final evaluation summary per session
                    await runAsync(`
                        CREATE TABLE IF NOT EXISTS session_final_evaluation (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            meeting_id TEXT NOT NULL UNIQUE,
                            overall_session_rating TEXT,
                            teacher_performance TEXT,
                            student_engagement TEXT,
                            learning_impact TEXT,
                            parent_communication_readiness TEXT,
                            recommended_action TEXT CHECK(recommended_action IN (
                                'Continue', 'Minor Coaching', 'Moderate Coaching', 'Intensive Support'
                            )),
                            aq_team_summary TEXT,
                            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                            FOREIGN KEY (meeting_id) REFERENCES meetings(meeting_id)
                        )
                    `);

                    // ═══════════════════════════════════════════════════════════════════
                    // ─── EXISTING INDEXES ─────────────────────────────────────────────
                    // ═══════════════════════════════════════════════════════════════════

                    await runAsync(`CREATE INDEX IF NOT EXISTS idx_ai_audit_results_meeting ON ai_audit_results(meeting_id)`);
                    await runAsync(`CREATE INDEX IF NOT EXISTS idx_ai_audit_results_session ON ai_audit_results(session_id)`);
                    await runAsync(`CREATE INDEX IF NOT EXISTS idx_ai_audit_results_meeting_session ON ai_audit_results(meeting_id, session_id)`);
                    await runAsync(`CREATE INDEX IF NOT EXISTS idx_calendar_integrations_user_id ON calendar_integrations(user_id)`);
                    await runAsync(`CREATE INDEX IF NOT EXISTS idx_meeting_reviewers_meeting_id ON meeting_reviewers(meeting_id)`);
                    await runAsync(`CREATE INDEX IF NOT EXISTS idx_participant_sessions_meeting_id ON participant_sessions(meeting_id)`);
                    await runAsync(`CREATE INDEX IF NOT EXISTS idx_participant_sessions_session_id ON participant_sessions(session_id)`);
                    await runAsync(`CREATE INDEX IF NOT EXISTS idx_participant_sessions_participant_name ON participant_sessions(participant_name)`);
                    await runAsync(`CREATE INDEX IF NOT EXISTS idx_participants_meeting_id ON participants(meeting_id)`);
                    await runAsync(`CREATE INDEX IF NOT EXISTS idx_participants_participant_name ON participants(participant_name)`);
                    await runAsync(`CREATE INDEX IF NOT EXISTS idx_participants_status ON participants(participant_status)`);
                    await runAsync(`CREATE INDEX IF NOT EXISTS idx_attendance_sessions_meeting_id ON participant_attendance_sessions(meeting_id)`);
                    await runAsync(`CREATE INDEX IF NOT EXISTS idx_attendance_sessions_participant_id ON participant_attendance_sessions(participant_id)`);
                    await runAsync(`CREATE INDEX IF NOT EXISTS idx_attendance_sessions_status ON participant_attendance_sessions(attendance_status)`);
                    await runAsync(`CREATE INDEX IF NOT EXISTS idx_header_role_configs_role_id   ON header_role_configs(role_id)`);
                    await runAsync(`CREATE INDEX IF NOT EXISTS idx_header_role_configs_is_active  ON header_role_configs(is_active)`);
                    await runAsync(`CREATE INDEX IF NOT EXISTS idx_header_menu_items_role_id    ON header_menu_items(role_id)`);
                    await runAsync(`CREATE INDEX IF NOT EXISTS idx_header_menu_items_parent_id  ON header_menu_items(parent_id)`);
                    await runAsync(`CREATE INDEX IF NOT EXISTS idx_header_page_configs_role_id    ON header_page_configs(role_id)`);
                    await runAsync(`CREATE INDEX IF NOT EXISTS idx_header_page_configs_page_key   ON header_page_configs(page_key)`);
                    await runAsync(`CREATE INDEX IF NOT EXISTS idx_header_page_configs_role_page  ON header_page_configs(role_id, page_key)`);
                    await runAsync(`CREATE INDEX IF NOT EXISTS idx_session_scores_lookup         ON meeting_session_scores(meeting_id, session_id)`);
                    await runAsync(`CREATE INDEX IF NOT EXISTS idx_admin_rubric_categories_admin ON admin_rubric_categories(admin_user_id)`);
                    await runAsync(`CREATE INDEX IF NOT EXISTS idx_admin_rubric_indicators_admin ON admin_rubric_indicators(admin_user_id)`);
                    await runAsync(`CREATE INDEX IF NOT EXISTS idx_rubric_audit_log_performed    ON rubric_audit_log(performed_by)`);
                    await runAsync(`CREATE INDEX IF NOT EXISTS idx_rubric_audit_log_entity       ON rubric_audit_log(entity_type, entity_id)`);

                    // ═══════════════════════════════════════════════════════════════════
                    // ─── NEW INDEXES: TUTORING SESSION QUALITY TABLES ──────────────────
                    // ═══════════════════════════════════════════════════════════════════

                    await runAsync(`CREATE INDEX IF NOT EXISTS idx_session_metadata_meeting        ON session_metadata(meeting_id)`);
                    await runAsync(`CREATE INDEX IF NOT EXISTS idx_session_metadata_teacher         ON session_metadata(teacher_user_id)`);
                    await runAsync(`CREATE INDEX IF NOT EXISTS idx_quality_reports_meeting          ON session_quality_reports(meeting_id)`);
                    await runAsync(`CREATE INDEX IF NOT EXISTS idx_session_analysis_meeting         ON session_analysis(meeting_id)`);
                    await runAsync(`CREATE INDEX IF NOT EXISTS idx_session_analysis_type            ON session_analysis(analysis_type)`);
                    await runAsync(`CREATE INDEX IF NOT EXISTS idx_learning_impact_meeting          ON student_learning_impact(meeting_id)`);
                    await runAsync(`CREATE INDEX IF NOT EXISTS idx_learning_impact_level            ON student_learning_impact(impact_level)`);
                    await runAsync(`CREATE INDEX IF NOT EXISTS idx_parent_summary_meeting           ON session_parent_summary(meeting_id)`);
                    await runAsync(`CREATE INDEX IF NOT EXISTS idx_coaching_feedback_meeting        ON teacher_coaching_feedback(meeting_id)`);
                    await runAsync(`CREATE INDEX IF NOT EXISTS idx_coaching_feedback_type           ON teacher_coaching_feedback(feedback_type)`);
                    await runAsync(`CREATE INDEX IF NOT EXISTS idx_better_alternatives_meeting      ON teacher_better_alternatives(meeting_id)`);
                    await runAsync(`CREATE INDEX IF NOT EXISTS idx_next_session_plan_meeting        ON next_session_plan(meeting_id)`);
                    await runAsync(`CREATE INDEX IF NOT EXISTS idx_quality_flags_meeting            ON session_quality_flags(meeting_id)`);
                    await runAsync(`CREATE INDEX IF NOT EXISTS idx_quality_flags_severity           ON session_quality_flags(severity)`);
                    await runAsync(`CREATE INDEX IF NOT EXISTS idx_final_evaluation_meeting         ON session_final_evaluation(meeting_id)`);
                    await runAsync(`CREATE INDEX IF NOT EXISTS idx_final_evaluation_action          ON session_final_evaluation(recommended_action)`);

                    resolve();
                } catch (err) {
                    reject(err);
                }
            })();
        });
    });
};

// ─── 2. Migration Helper: Add columns if they don't exist ──────────────────────

const migrateDB = async () => {
    try {
        // Add 'value' column to rubric_indicators if not exists
        const indTableInfo = await allAsync("PRAGMA table_info(rubric_indicators)");
        if (!indTableInfo.some(col => col.name === 'value')) {
            await runAsync("ALTER TABLE rubric_indicators ADD COLUMN value REAL DEFAULT 1");
            console.log('[DB] Added value column to rubric_indicators');
        }

        // Add 'company_id' column to rubric_categories if not exists
        const catTableInfo = await allAsync("PRAGMA table_info(rubric_categories)");
        if (!catTableInfo.some(col => col.name === 'company_id')) {
            await runAsync("ALTER TABLE rubric_categories ADD COLUMN company_id INTEGER DEFAULT 0");
            console.log('[DB] Added company_id column to rubric_categories');
        }

        // Add 'company_id' column to rubric_indicators if not exists
        if (!indTableInfo.some(col => col.name === 'company_id')) {
            await runAsync("ALTER TABLE rubric_indicators ADD COLUMN company_id INTEGER DEFAULT 0");
            console.log('[DB] Added company_id column to rubric_indicators');
        }

        // Add 'value' column to admin_rubric_indicators if not exists
        const adminIndTableInfo = await allAsync("PRAGMA table_info(admin_rubric_indicators)");
        if (!adminIndTableInfo.some(col => col.name === 'value')) {
            try {
                await runAsync("ALTER TABLE admin_rubric_indicators ADD COLUMN value REAL DEFAULT 1");
                console.log('[DB] Added value column to admin_rubric_indicators');
            } catch (e) {
                // table might not exist yet, that's fine
            }
        }

        console.log('[DB] Migrations completed successfully');
    } catch (err) {
        console.error('[DB] Migration error:', err.message);
    }
};

// ─── 3. Utilities ──────────────────────────────────────────────────────────────

const closeDB = () => {
    return new Promise((resolve, reject) => {
        db.close((err) => {
            if (err) reject(err);
            else resolve();
        });
    });
};

module.exports = { db, initDB, closeDB, runAsync, allAsync, getAsync, migrateDB };