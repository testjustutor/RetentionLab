# RetentionLab Database Schema
## Session Quality & Meeting Intelligence System

**Purpose:** This document provides a complete reference of the database structure for AI agents and developers working on the RetentionLab codebase. It explains table relationships, key columns, and common query patterns.

---

## Table of Contents
1. [Core Tables](#core-tables)
2. [Session Quality Tables](#session-quality-tables)
3. [Calendar & Integration Tables](#calendar--integration-tables)
4. [User & Role Management](#user--role-management)
5. [Relationships & Query Patterns](#relationships--query-patterns)
6. [Common Query Examples](#common-query-examples)

---

## Core Tables

### `users`
**Purpose:** Stores all users (admins, instructors, reviewers, students)

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT (PK) | Internal user ID |
| `email` | VARCHAR | User email address (unique) |
| `first_name` | VARCHAR | First name |
| `last_name` | VARCHAR | Last name |
| `role_id` | INT (FK) | References `roles.id` |
| `status` | ENUM | 'active', 'inactive', 'pending' |
| `created_by` | INT (FK) | References `users.id` (admin who created this user) |
| `created_at` | DATETIME | Account creation timestamp |

**Key Notes:**
- `created_by` links instructors to their admin (multi-tenant security)
- `role_id` determines user type: admin, instructor, reviewer, student
- **Never expose `id` to frontend** - use internal IDs only

---

### `roles`
**Purpose:** Defines user roles and permissions

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT (PK) | Role ID |
| `role_name` | VARCHAR | Role name: 'admin', 'instructor', 'reviewer', 'student', 'super_admin' |
| `permissions` | JSON | Permission definitions |

**Key Notes:**
- Join with `users` table to filter by role: `JOIN roles r ON r.id = u.role_id`
- Check role: `WHERE r.role_name = 'instructor'`

---

### `meetings`
**Purpose:** Stores calendar meeting information from Google/Zoom

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT (PK) | **Internal meeting ID** (use this in frontend) |
| `meeting_id` | VARCHAR | **External meeting ID** (e.g., 'kvh-gnka-qxt') - NEVER expose to frontend |
| `title` | VARCHAR | Meeting title |
| `start_time` | DATETIME | Meeting start time |
| `end_time` | DATETIME | Meeting end time |
| `platform` | VARCHAR | 'zoom', 'google_meet', etc. |
| `calendar_account` | VARCHAR | Email of instructor's calendar (links to `users.email`) |
| `status` | ENUM | 'scheduled', 'completed', 'cancelled' |
| `created_at` | DATETIME | Record creation time |

**Key Notes:**
- **Security:** Never return `meeting_id` to frontend - always use `id` (internal)
- **Instructor lookup:** `JOIN users u ON meetings.calendar_account = u.email`
- **Filter by admin:** `WHERE u.created_by = ?` (ensures admin only sees their instructors' meetings)

---

### `meeting_sessions`
**Purpose:** Individual sessions within a meeting (for multi-session meetings)

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT (PK) | **Internal session ID** (use this in frontend) |
| `meeting_id` | VARCHAR (FK) | References `meetings.meeting_id` (external ID) |
| `session_id` | VARCHAR | External session identifier - NEVER expose to frontend |
| `start_time` | DATETIME | Session start time |
| `end_time` | DATETIME | Session end time |
| `status` | ENUM | 'active', 'completed', 'cancelled' |

**Key Notes:**
- **Security:** Never return `session_id` to frontend - always use `id` (internal)
- **Link to meeting:** `JOIN meetings m ON meeting_sessions.meeting_id = m.meeting_id`
- **Session quality tables reference this:** All `session_*` tables use `session_id` FK pointing to `meeting_sessions.id`

---

## Session Quality Tables

### `session_snapshot`
**Purpose:** Overall session snapshot/overview data

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT (PK) | Auto-increment ID |
| `session_id` | INT (FK) | References `meeting_sessions.id` (UNIQUE) |
| `student_grade` | VARCHAR | Student grade level |
| `curriculum` | VARCHAR | Curriculum/board name |
| `location` | VARCHAR | Session location |
| `subject` | VARCHAR | Subject taught |
| `topics_covered` | JSON | Array of topics covered |
| `session_objective_status` | VARCHAR | 'met', 'partially_met', 'not_met' |
| `overall_score_pct` | INT | Overall score percentage (0-100) |
| `overall_rating` | VARCHAR | Rating: 'excellent', 'good', 'fair', 'poor' |
| `student_engagement` | VARCHAR | Engagement level |
| `learning_impact` | VARCHAR | Learning impact assessment |
| `parent_shareability` | VARCHAR | Shareability rating |
| `executive_summary` | TEXT | AI-generated summary |
| `created_at` | DATETIME | Record creation time |
| `updated_at` | DATETIME | Last update time |

**Key Notes:**
- One row per session (UNIQUE constraint on `session_id`)
- `session_id` = `meeting_sessions.id` (internal ID)
- Contains aggregate scores used in dashboard charts

---

### `session_analysis`
**Purpose:** Detailed analysis of what worked, what didn't, missed opportunities

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT (PK) | Auto-increment ID |
| `session_id` | INT (FK) | References `meeting_sessions.id` (UNIQUE) |
| `what_worked_well` | JSON | Array of successful strategies |
| `what_needs_improvement` | JSON | Array of areas needing work |
| `missed_opportunities` | JSON | Array of missed teaching opportunities |
| `created_at` | DATETIME | Record creation time |
| `updated_at` | DATETIME | Last update time |

**Key Notes:**
- JSON arrays contain objects with: `description`, `evidence`, `impact`, `recommendation`
- One row per session

---

### `session_learning_impact`
**Purpose:** Learning impact areas with observations

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT (PK) | Auto-increment ID |
| `session_id` | INT (FK) | References `meeting_sessions.id` (UNIQUE) |
| `impact_areas` | JSON | Array of impact areas |
| `created_at` | DATETIME | Record creation time |
| `updated_at` | DATETIME | Last update time |

---

### `session_parent_summary`
**Purpose:** Parent-friendly summary of session

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT (PK) | Auto-increment ID |
| `session_id` | INT (FK) | References `meeting_sessions.id` (UNIQUE) |
| `summary` | TEXT | Parent-friendly summary |
| `key_highlights` | JSON | Array of highlights |
| `next_steps` | JSON | Array of recommended next steps |
| `created_at` | DATETIME | Record creation time |
| `updated_at` | DATETIME | Last update time |

---

### `session_coaching_feedback`
**Purpose:** Coaching feedback for instructor improvement

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT (PK) | Auto-increment ID |
| `session_id` | INT (FK) | References `meeting_sessions.id` (UNIQUE) |
| `strengths` | JSON | Array of observed strengths |
| `areas_to_improve` | JSON | Array of improvement areas |
| `action_items` | JSON | Array of actionable coaching items |
| `created_at` | DATETIME | Record creation time |
| `updated_at` | DATETIME | Last update time |

---

### `session_better_alternatives`
**Purpose:** Alternative teaching approaches

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT (PK) | Auto-increment ID |
| `session_id` | INT (FK) | References `meeting_sessions.id` (UNIQUE) |
| `alternatives` | JSON | Array of alternative approaches |
| `created_at` | DATETIME | Record creation time |
| `updated_at` | DATETIME | Last update time |

---

### `session_next_plan`
**Purpose:** Next session plan recommendations

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT (PK) | Auto-increment ID |
| `session_id` | INT (FK) | References `meeting_sessions.id` (UNIQUE) |
| `segments` | JSON | Array of planned segments |
| `priority_focus` | JSON | Array of priority focus areas |
| `gaps_to_address` | JSON | Array of learning gaps |
| `created_at` | DATETIME | Record creation time |
| `updated_at` | DATETIME | Last update time |

---

### `session_quality_flags`
**Purpose:** Quality flags and alerts

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT (PK) | Auto-increment ID |
| `session_id` | INT (FK) | References `meeting_sessions.id` (UNIQUE) |
| `flags` | JSON | Array of quality flags |
| `created_at` | DATETIME | Record creation time |
| `updated_at` | DATETIME | Last update time |

---

### `session_final_evaluation`
**Purpose:** Final evaluation and scoring

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT (PK) | Auto-increment ID |
| `session_id` | INT (FK) | References `meeting_sessions.id` (UNIQUE) |
| `final_score` | INT | Final calculated score |
| `grade` | VARCHAR | Final grade |
| `evaluator_notes` | TEXT | Evaluator comments |
| `created_at` | DATETIME | Record creation time |
| `updated_at` | DATETIME | Last update time |

---

### `rubric_summary`
**Purpose:** Rubric evaluation summary

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT (PK) | Auto-increment ID |
| `session_id` | INT (FK) | References `meeting_sessions.id` (UNIQUE) |
| `weighted_score_pct` | INT | Weighted score percentage |
| `overall_rating` | VARCHAR | Overall rating |
| `gate_status` | VARCHAR | 'all_passed', 'failed' |
| `confidence_level` | VARCHAR | Confidence in evaluation |
| `created_at` | DATETIME | Record creation time |
| `updated_at` | DATETIME | Last update time |

---

### `rubric_evaluations`
**Purpose:** Individual rubric criterion evaluations

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT (PK) | Auto-increment ID |
| `session_id` | INT (FK) | References `meeting_sessions.id` |
| `indicator_name` | VARCHAR | Rubric indicator name |
| `indicator_type` | VARCHAR | Category type |
| `rating` | VARCHAR | Rating: 'exemplary', 'proficient', 'developing', etc. |
| `weight` | DECIMAL | Weight of this indicator |
| `benchmark` | VARCHAR | Benchmark description |
| `evidence_text` | TEXT | Evidence from session |
| `created_at` | DATETIME | Record creation time |

**Key Notes:**
- Multiple rows per session (one per rubric indicator)
- Used in detailed rubric report view

---

## Calendar & Integration Tables

### `calendar_integrations`
**Purpose:** Tracks instructor calendar connections

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT (PK) | Integration ID |
| `user_id` | INT (FK) | References `users.id` |
| `platform` | VARCHAR | 'google', 'zoom', etc. |
| `access_token` | TEXT | OAuth access token (encrypted) |
| `refresh_token` | TEXT | OAuth refresh token (encrypted) |
| `expires_at` | DATETIME | Token expiration |
| `status` | ENUM | 'active', 'expired', 'revoked' |
| `created_at` | DATETIME | Record creation time |

**Key Notes:**
- Used to filter active instructors: `JOIN calendar_integrations ci ON ci.user_id = u.id WHERE ci.id IS NOT NULL`
- One integration per user per platform

---

### `calendar_verifications`
**Purpose:** Calendar verification codes and status

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT (PK) | Verification ID |
| `user_id` | INT (FK) | References `users.id` |
| `code` | VARCHAR | Verification code |
| `status` | ENUM | 'pending', 'verified', 'failed' |
| `created_at` | DATETIME | Record creation time |

---

## User & Role Management

### `companies`
**Purpose:** Multi-tenant company/organization data

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT (PK) | Company ID |
| `name` | VARCHAR | Company name |
| `domain` | VARCHAR | Company domain |
| `created_at` | DATETIME | Record creation time |

---

### `departments`
**Purpose:** Department within a company

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT (PK) | Department ID |
| `company_id` | INT (FK) | References `companies.id` |
| `name` | VARCHAR | Department name |
| `created_at` | DATETIME | Record creation time |

---

## Rubric & Evaluation Tables

### `rubric_categories`
**Purpose:** Rubric evaluation categories (A, B, C, D, E)

| Column | Type | Description |
|--------|------|-------------|
| `category_id` | VARCHAR(10) (PK) | Category ID (e.g., 'A', 'B', 'C') |
| `name` | VARCHAR | Category name |
| `weight` | DECIMAL | Weight in overall score |
| `created_at` | DATETIME | Record creation time |

**Key Notes:**
- Primary key is `category_id` (not auto-increment)
- Used for grouping rubric indicators

---

### `rubric_indicators`
**Purpose:** Individual rubric evaluation indicators

| Column | Type | Description |
|--------|------|-------------|
| `indicator_id` | VARCHAR(255) (PK) | Indicator ID (e.g., 'A1.1', 'B2.3') |
| `category_id` | VARCHAR(10) (FK) | References `rubric_categories.category_id` |
| `name` | VARCHAR | Indicator name |
| `type` | ENUM | 'AI', 'HUMAN' |
| `is_gate` | TINYINT | 1 if this is a gate indicator (must pass) |
| `value` | INT | Weight/points for this indicator |
| `benchmark` | TEXT | Expected performance description |
| `requires_video` | TINYINT | 1 if video is required for evaluation |
| `created_at` | DATETIME | Record creation time |

**Key Notes:**
- Primary key is `indicator_id` (not auto-increment)
- `is_gate` = 1 means session fails if this indicator is not met
- `requires_video` = 1 means this can only be evaluated with video

---

### `session_rubric_evaluations`
**Purpose:** Individual rubric criterion evaluations for a session

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT (PK) | Auto-increment ID |
| `session_id` | INT (FK) | References `meeting_sessions.id` |
| `indicator_id` | VARCHAR(255) (FK) | References `rubric_indicators.indicator_id` |
| `rating` | ENUM | 'Met', 'Partial', 'Not met', 'N/A' |
| `evidence_text` | TEXT | Evidence from session |
| `comment` | TEXT | Evaluator comment |
| `evaluated_by` | ENUM | 'AI', 'HUMAN' |
| `confidence` | ENUM | 'High', 'Medium', 'Low' |
| `created_at` | DATETIME | Record creation time |
| `updated_at` | DATETIME | Last update time |

**Key Notes:**
- UNIQUE constraint on (session_id, indicator_id)
- Multiple rows per session (one per rubric indicator)
- Used in detailed rubric report view

---

### `session_rubric_summary`
**Purpose:** Rubric evaluation summary for a session

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT (PK) | Auto-increment ID |
| `session_id` | INT (FK) | References `meeting_sessions.id` (UNIQUE) |
| `weighted_score_pct` | DECIMAL(5,2) | Weighted score percentage |
| `gate_status` | ENUM | 'all_passed', 'gate_failed' |
| `overall_rating` | VARCHAR | Overall rating |
| `confidence_level` | VARCHAR | Confidence in evaluation |
| `created_at` | DATETIME | Record creation time |
| `updated_at` | DATETIME | Last update time |

**Key Notes:**
- One row per session (UNIQUE constraint on session_id)
- `gate_status` = 'gate_failed' if any gate indicator was not met
- `confidence_level` indicates reliability of evaluation

---

### `admin_rubric_categories`
**Purpose:** Admin-defined custom rubric categories

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT (PK) | Auto-increment ID |
| `name` | VARCHAR | Category name |
| `description` | TEXT | Category description |
| `created_by` | INT (FK) | References `users.id` |
| `created_at` | DATETIME | Record creation time |

---

### `admin_rubric_indicators`
**Purpose:** Admin-defined custom rubric indicators

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT (PK) | Auto-increment ID |
| `category_id` | INT (FK) | References `admin_rubric_categories.id` |
| `name` | VARCHAR | Indicator name |
| `description` | TEXT | Indicator description |
| `weight` | DECIMAL | Weight in overall score |
| `created_at` | DATETIME | Record creation time |

---

### `rubric_assignments`
**Purpose:** Assign rubrics to sessions/meetings

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT (PK) | Auto-increment ID |
| `session_id` | INT (FK) | References `meeting_sessions.id` |
| `rubric_type` | VARCHAR | 'default', 'custom', 'admin' |
| `rubric_id` | INT | ID of the rubric being assigned |
| `assigned_by` | INT (FK) | References `users.id` |
| `created_at` | DATETIME | Record creation time |

---

### `rubric_audit_log`
**Purpose:** Audit trail for rubric evaluations

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT (PK) | Auto-increment ID |
| `session_id` | INT (FK) | References `meeting_sessions.id` |
| `action` | VARCHAR | 'created', 'updated', 'deleted' |
| `performed_by` | INT (FK) | References `users.id` |
| `details` | JSON | Audit details |
| `created_at` | DATETIME | Record creation time |

---

## Header Configuration Tables

### `header_configs`
**Purpose:** Dynamic header configuration for different user roles

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT (PK) | Auto-increment ID |
| `config_key` | VARCHAR (UNIQUE) | Configuration key |
| `config_json` | TEXT | JSON configuration |
| `description` | TEXT | Configuration description |
| `created_at` | DATETIME | Record creation time |
| `updated_at` | DATETIME | Last update time |

**Key Notes:**
- Used for role-based header customization
- `config_json` contains menu items, links, permissions

---

### `header_role_configs`
**Purpose:** Role-specific header configurations

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT (PK) | Auto-increment ID |
| `role_id` | INT (FK) | References `roles.id` |
| `home_href` | VARCHAR | Home page URL |
| `home_label` | VARCHAR | Home button label |
| `events_href` | VARCHAR | Events page URL |
| `events_label` | VARCHAR | Events button label |
| `archives_href` | VARCHAR | Archives page URL |
| `archives_label` | VARCHAR | Archives button label |
| `profile_href` | VARCHAR | Profile page URL |
| `profile_label` | VARCHAR | Profile button label |
| `settings_href` | VARCHAR | Settings page URL |
| `settings_label` | VARCHAR | Settings button label |
| `is_active` | TINYINT | 1 if active |
| `created_by` | INT (FK) | References `users.id` |
| `updated_by` | INT (FK) | References `users.id` |
| `created_at` | DATETIME | Record creation time |
| `updated_at` | DATETIME | Last update time |

---

### `header_page_configs`
**Purpose:** Page-specific header configurations

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT (PK) | Auto-increment ID |
| `role_id` | INT (FK) | References `roles.id` |
| `page_key` | VARCHAR | Page identifier |
| `title` | VARCHAR | Page title |
| `description` | TEXT | Page description |
| `role_title` | VARCHAR | Role-specific title |
| `show_stats` | TINYINT | 1 if stats should be shown |
| `buttons_json` | JSON | Array of button configurations |
| `is_active` | TINYINT | 1 if active |
| `created_by` | INT (FK) | References `users.id` |
| `updated_by` | INT (FK) | References `users.id` |
| `created_at` | DATETIME | Record creation time |
| `updated_at` | DATETIME | Last update time |

---

### `header_menu_items`
**Purpose:** Menu items for header navigation

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT (PK) | Auto-increment ID |
| `role_id` | INT (FK) | References `roles.id` |
| `menu_id` | VARCHAR | Menu identifier |
| `parent_id` | INT (FK) | References `header_menu_items.id` (for submenus) |
| `label` | VARCHAR | Menu item label |
| `icon` | VARCHAR | Icon class or name |
| `href` | VARCHAR | Link URL |
| `display_order` | INT | Sort order |
| `is_active` | TINYINT | 1 if active |
| `section` | VARCHAR | Menu section name |
| `color` | VARCHAR | Menu item color |
| `created_by` | INT (FK) | References `users.id` |
| `updated_by` | INT (FK) | References `users.id` |
| `created_at` | DATETIME | Record creation time |
| `updated_at` | DATETIME | Last update time |

---

## Meeting & Participant Tables

### `meeting_assets`
**Purpose:** Stores meeting-related files (audio, transcript, screenshots)

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT (PK) | Auto-increment ID |
| `meeting_id` | VARCHAR (FK) | References `meetings.meeting_id` |
| `audio_path` | VARCHAR | Path to audio recording |
| `transcript_path` | VARCHAR | Path to transcript file |
| `audit_json_path` | VARCHAR | Path to audit JSON |
| `screenshots_json` | JSON | Array of screenshot paths |
| `created_at` | DATETIME | Record creation time |
| `updated_at` | DATETIME | Last update time |

---

### `participants`
**Purpose:** Meeting participants/attendees

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT (PK) | Auto-increment ID |
| `meeting_id` | VARCHAR (FK) | References `meetings.meeting_id` |
| `participant_name` | VARCHAR | Participant name |
| `participant_email` | VARCHAR | Participant email |
| `participant_role` | VARCHAR | Role in meeting |
| `join_time` | DATETIME | When participant joined |
| `leave_time` | DATETIME | When participant left |
| `created_at` | DATETIME | Record creation time |

---

### `participant_sessions`
**Purpose:** Tracks participant attendance in individual sessions

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT (PK) | Auto-increment ID |
| `meeting_id` | VARCHAR (FK) | References `meetings.meeting_id` |
| `session_id` | VARCHAR | Session identifier |
| `participant_name` | VARCHAR | Participant name |
| `join_sequence` | INT | Order of joining |
| `joined_at` | DATETIME | Join timestamp |
| `left_at` | DATETIME | Leave timestamp |
| `session_duration_seconds` | INT | Duration in seconds |
| `total_meeting_duration_seconds` | INT | Total meeting duration |
| `participant_count_at_join` | INT | Count when joined |
| `session_status` | VARCHAR | Session status |
| `created_at` | DATETIME | Record creation time |

---

### `participant_attendance_sessions`
**Purpose:** Detailed participant attendance tracking

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT (PK) | Auto-increment ID |
| `meeting_id` | VARCHAR (FK) | References `meetings.meeting_id` |
| `participant_id` | INT (FK) | References `participants.id` |
| `session_number` | INT | Session number |
| `joined_at` | DATETIME | Join timestamp |
| `left_at` | DATETIME | Leave timestamp |
| `duration_seconds` | INT | Duration in seconds |
| `attendance_status` | VARCHAR | 'active', 'completed', 'partial' |
| `created_at` | DATETIME | Record creation time |

---

### `meeting_reviewers`
**Purpose:** Assigns reviewers to meetings

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT (PK) | Auto-increment ID |
| `meeting_id` | VARCHAR (FK) | References `meetings.meeting_id` |
| `reviewer_id` | INT (FK) | References `users.id` |
| `assigned_by` | INT (FK) | References `users.id` |
| `status` | VARCHAR | 'pending', 'in_progress', 'completed' |
| `created_at` | DATETIME | Record creation time |

---

### `meeting_scores`
**Purpose:** Stores meeting-level rubric scores

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT (PK) | Auto-increment ID |
| `meeting_id` | VARCHAR (FK) | References `meetings.meeting_id` |
| `indicator_id` | VARCHAR (FK) | References `rubric_indicators.indicator_id` |
| `reviewer_id` | INT (FK) | References `users.id` |
| `score` | DECIMAL | Score value |
| `comment` | TEXT | Reviewer comment |
| `score_type` | VARCHAR | 'AI', 'HUMAN' |
| `scored_at` | DATETIME | When scored |
| `created_at` | DATETIME | Record creation time |
| `updated_at` | DATETIME | Last update time |

---

### `meeting_session_scores`
**Purpose:** Stores session-level rubric scores

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT (PK) | Auto-increment ID |
| `meeting_id` | VARCHAR (FK) | References `meetings.meeting_id` |
| `session_id` | VARCHAR | Session identifier |
| `indicator_id` | VARCHAR (FK) | References `rubric_indicators.indicator_id` |
| `score` | DECIMAL | Score value |
| `score_type` | VARCHAR | 'AI', 'HUMAN' |
| `comment` | TEXT | Reviewer comment |
| `reviewer_id` | INT (FK) | References `users.id` |
| `created_at` | DATETIME | Record creation time |

---

## Session Metadata & Transcripts

### `session_metadata`
**Purpose:** Metadata for each session (student info, subject, etc.)

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT (PK) | Auto-increment ID |
| `meeting_id` | VARCHAR (FK) | References `meetings.meeting_id` |
| `student_grade` | VARCHAR | Student grade level |
| `curriculum` | VARCHAR | Curriculum/board name |
| `student_location` | VARCHAR | Student location |
| `subject` | VARCHAR | Subject taught |
| `topic` | VARCHAR | Specific topic |
| `session_objective` | TEXT | Session objective |
| `session_type` | VARCHAR | 'one-to-one', 'group', etc. |
| `teacher_user_id` | INT (FK) | References `users.id` (instructor) |
| `student_name` | VARCHAR | Student name |
| `created_at` | DATETIME | Record creation time |
| `updated_at` | DATETIME | Last update time |

**Key Notes:**
- Links meeting to instructor via `teacher_user_id`
- Contains student and session details
- Used for filtering and reporting

---

### `transcripts`
**Purpose:** Meeting transcripts and analysis

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT (PK) | Auto-increment ID |
| `meeting_id` | VARCHAR (FK) | References `meetings.meeting_id` |
| `session_id` | VARCHAR | Session identifier |
| `transcript_text` | TEXT | Full transcript text |
| `analysis_json` | JSON | AI analysis results |
| `language` | VARCHAR | Transcript language |
| `duration_seconds` | INT | Meeting duration |
| `word_count` | INT | Total words |
| `created_at` | DATETIME | Record creation time |
| `updated_at` | DATETIME | Last update time |

---

## Audit & Archive Tables

### `ai_audit_results`
**Purpose:** AI evaluation results for audit purposes

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT (PK) | Auto-increment ID |
| `meeting_id` | VARCHAR (FK) | References `meetings.meeting_id` |
| `session_id` | VARCHAR | Session identifier |
| `category_id` | VARCHAR (FK) | References `rubric_categories.category_id` |
| `indicator_id` | VARCHAR (FK) | References `rubric_indicators.indicator_id` |
| `ai_score` | INT | AI-assigned score |
| `ai_max_score` | INT | Maximum possible score |
| `ai_raw_response` | JSON | Raw AI response |
| `oqi_score` | INT | Overall quality index score |
| `evidence_quote` | TEXT | Quote from transcript as evidence |
| `talk_ratio` | DECIMAL | Teacher/student talk ratio |
| `scored_at` | DATETIME | When scored |
| `created_at` | DATETIME | Record creation time |
| `updated_at` | DATETIME | Last update time |

---

### `archives`
**Purpose:** Archived meetings and sessions

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT (PK) | Auto-increment ID |
| `meeting_id` | VARCHAR (FK) | References `meetings.meeting_id` |
| `archive_type` | VARCHAR | 'meeting', 'session', 'report' |
| `archive_path` | VARCHAR | Path to archived file |
| `archive_json` | JSON | Archived data |
| `archived_by` | INT (FK) | References `users.id` |
| `created_at` | DATETIME | Record creation time |

---

## Settings & Configuration Tables

### `system_settings`
**Purpose:** Global system settings

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT (PK) | Auto-increment ID |
| `company_id` | INT (FK) | References `companies.id` (null for global) |
| `setting_key` | VARCHAR | Setting key |
| `setting_value` | TEXT | Setting value |
| `setting_type` | VARCHAR | 'string', 'number', 'boolean', 'json' |
| `created_at` | DATETIME | Record creation time |
| `updated_at` | DATETIME | Last update time |

---

### `user_settings`
**Purpose:** User-specific settings

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT (PK) | Auto-increment ID |
| `user_id` | INT (FK) | References `users.id` |
| `setting_key` | VARCHAR | Setting key |
| `setting_value` | TEXT | Setting value |
| `created_at` | DATETIME | Record creation time |
| `updated_at` | DATETIME | Last update time |

---

## Legacy/Compatibility Tables

### `session_quality_reports`
**Purpose:** Legacy session quality reports (being phased out)

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT (PK) | Auto-increment ID |
| `meeting_id` | VARCHAR (FK) | References `meetings.meeting_id` |
| `overall_score` | INT | Overall score |
| `max_possible_score` | INT | Maximum possible score |
| `percentage_score` | DECIMAL | Percentage score |
| `overall_rating` | VARCHAR | Overall rating |
| `student_engagement` | VARCHAR | Engagement level |
| `learning_impact` | VARCHAR | Learning impact |
| `parent_shareability` | VARCHAR | Shareability rating |
| `confidence_level` | VARCHAR | Confidence level |
| `confidence_reason` | TEXT | Reason for confidence level |
| `executive_summary` | TEXT | AI-generated summary |
| `generated_by` | VARCHAR | 'AI' or 'HUMAN' |
| `generated_at` | DATETIME | When generated |
| `updated_at` | DATETIME | Last update time |

**Key Notes:**
- Legacy table, being replaced by `session_snapshot` and related tables
- Kept for backward compatibility

---

### `meeting_scores` (Legacy)
**Purpose:** Legacy meeting-level scores

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT (PK) | Auto-increment ID |
| `meeting_id` | VARCHAR (FK) | References `meetings.meeting_id` |
| `indicator_id` | VARCHAR | Rubric indicator ID |
| `reviewer_id` | INT (FK) | References `users.id` |
| `score` | DECIMAL | Score value |
| `comment` | TEXT | Reviewer comment |
| `score_type` | VARCHAR | 'AI', 'HUMAN' |
| `scored_at` | DATETIME | When scored |
| `created_at` | DATETIME | Record creation time |
| `updated_at` | DATETIME | Last update time |

---

### `next_session_plan` (Legacy)
**Purpose:** Legacy next session plan

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT (PK) | Auto-increment ID |
| `meeting_id` | VARCHAR (FK) | References `meetings.meeting_id` |
| `recap_warmup` | TEXT | Recap/warmup plan |
| `concept_reinforcement` | TEXT | Concept reinforcement plan |
| `guided_practice` | TEXT | Guided practice plan |
| `independent_practice` | TEXT | Independent practice plan |
| `review_homework` | TEXT | Homework review plan |
| `priority_focus` | TEXT | Priority focus areas |
| `concepts_to_revise` | TEXT | Concepts to revise |
| `suggested_practice_questions` | TEXT | Practice questions |
| `suggested_homework` | TEXT | Suggested homework |
| `misconception_to_address` | TEXT | Misconceptions to address |
| `created_at` | DATETIME | Record creation time |
| `updated_at` | DATETIME | Last update time |

---

## Complete Table List (Alphabetical)

1. `admin_rubric_categories` - Custom rubric categories
2. `admin_rubric_indicators` - Custom rubric indicators
3. `ai_audit_results` - AI evaluation results
4. `archives` - Archived data
5. `calendar_integrations` - Calendar connections
6. `calendar_verifications` - Calendar verification codes
7. `companies` - Multi-tenant companies
8. `departments` - Departments
9. `department_members` - Department memberships
10. `header_configs` - Header configurations
11. `header_menu_items` - Menu items
12. `header_page_configs` - Page configurations
13. `header_role_configs` - Role configurations
14. `meeting_assets` - Meeting files
15. `meeting_participant_sessions` - Participant session tracking
16. `meeting_reviewers` - Meeting reviewers
17. `meeting_scores` - Meeting scores (legacy)
18. `meeting_session_scores` - Session scores
19. `meetings` - Calendar meetings
20. `meeting_sessions` - Meeting sessions
21. `participants` - Meeting participants
22. `participant_attendance_sessions` - Attendance tracking
23. `participant_sessions` - Participant sessions
24. `roles` - User roles
25. `rubric_assignments` - Rubric assignments
26. `rubric_audit_log` - Rubric audit trail
27. `rubric_categories` - Rubric categories
28. `rubric_evaluations` - Rubric evaluations (legacy)
29. `rubric_indicators` - Rubric indicators
30. `rubric_summary` - Rubric summary (legacy)
31. `session_analysis` - Session analysis
32. `session_better_alternatives` - Alternative approaches
33. `session_coaching_feedback` - Coaching feedback
34. `session_final_evaluation` - Final evaluation
35. `session_learning_impact` - Learning impact
36. `session_metadata` - Session metadata
37. `session_next_plan` - Next session plan
38. `session_parent_summary` - Parent summary
39. `session_quality_flags` - Quality flags
40. `session_quality_reports` - Quality reports (legacy)
41. `session_rubric_evaluations` - Rubric evaluations
42. `session_rubric_summary` - Rubric summary
43. `session_snapshot` - Session snapshot
44. `session_snapshots` - Session snapshots (legacy)
45. `system_settings` - System settings
46. `transcripts` - Meeting transcripts
47. `user_settings` - User settings
48. `users` - All users

---

## Relationships & Query Patterns

### Entity Relationship Diagram (Text-Based)

```
users (id, email, role_id, created_by)
  ├─→ roles (id, role_name)
  ├─→ calendar_integrations (user_id)
  ├─→ meetings (calendar_account → users.email)
  │     └─→ meeting_sessions (meeting_id → meetings.meeting_id)
  │           ├─→ session_snapshot (session_id → meeting_sessions.id)
  │           ├─→ session_analysis (session_id → meeting_sessions.id)
  │           ├─→ session_learning_impact (session_id → meeting_sessions.id)
  │           ├─→ session_parent_summary (session_id → meeting_sessions.id)
  │           ├─→ session_coaching_feedback (session_id → meeting_sessions.id)
  │           ├─→ session_better_alternatives (session_id → meeting_sessions.id)
  │           ├─→ session_next_plan (session_id → meeting_sessions.id)
  │           ├─→ session_quality_flags (session_id → meeting_sessions.id)
  │           ├─→ session_final_evaluation (session_id → meeting_sessions.id)
  │           ├─→ rubric_summary (session_id → meeting_sessions.id)
  │           └─→ rubric_evaluations (session_id → meeting_sessions.id)
  └─→ (created_by → users.id) [self-referential for admin-instructor relationship]
```

---

## Common Query Patterns

### 1. Get all instructors created by logged-in admin
```sql
SELECT u.id, u.first_name, u.last_name, u.email
FROM users u
JOIN roles r ON r.id = u.role_id
LEFT JOIN calendar_integrations ci ON ci.user_id = u.id
WHERE r.role_name = 'instructor'
  AND u.status = 'active'
  AND u.created_by = ?  -- logged-in admin ID
  AND ci.id IS NOT NULL  -- only instructors with connected calendar
```

### 2. Get meetings for an instructor (SECURE - using internal ID)
```sql
SELECT m.id as internal_id, m.title, m.start_time
FROM meetings m
JOIN users u ON m.calendar_account = u.email
JOIN roles r ON r.id = u.role_id
WHERE u.created_by = ?  -- logged-in admin ID
  AND r.role_name = 'instructor'
  AND u.id = ?  -- instructor ID (optional filter)
ORDER BY m.start_time DESC
```

### 3. Get sessions for a meeting (SECURE - using internal ID)
```sql
SELECT ms.id as internal_id, ms.start_time
FROM meeting_sessions ms
JOIN meetings m ON ms.meeting_id = m.meeting_id
JOIN users u ON m.calendar_account = u.email
JOIN roles r ON r.id = u.role_id
WHERE m.id = ?  -- internal meeting ID (NEVER use meeting_id)
  AND u.created_by = ?  -- logged-in admin ID
  AND r.role_name = 'instructor'
ORDER BY ms.start_time DESC
```

### 4. Get session quality data (aggregate report)
```sql
-- All session_* tables join via session_id = meeting_sessions.id
SELECT 
  ss.overall_score_pct,
  ss.subject,
  ss.student_grade,
  sa.what_worked_well,
  sa.what_needs_improvement
FROM session_snapshot ss
LEFT JOIN session_analysis sa ON sa.session_id = ss.session_id
WHERE ss.session_id = ?  -- internal session ID
```

### 5. Dashboard aggregations
```sql
-- Score distribution
SELECT 
  CASE 
    WHEN overall_score_pct BETWEEN 0 AND 20 THEN '0-20'
    WHEN overall_score_pct BETWEEN 21 AND 40 THEN '21-40'
    WHEN overall_score_pct BETWEEN 41 AND 60 THEN '41-60'
    WHEN overall_score_pct BETWEEN 61 AND 80 THEN '61-80'
    ELSE '81-100'
  END as score_range,
  COUNT(*) as count
FROM session_snapshot ss
JOIN meeting_sessions ms ON ms.id = ss.session_id
JOIN meetings m ON m.meeting_id = ms.meeting_id
JOIN users u ON m.calendar_account = u.email
WHERE u.created_by = ?
GROUP BY score_range

-- Subject distribution with avg scores
SELECT 
  ss.subject,
  COUNT(*) as count,
  AVG(ss.overall_score_pct) as avg_score
FROM session_snapshot ss
JOIN meeting_sessions ms ON ms.id = ss.session_id
JOIN meetings m ON m.meeting_id = ms.meeting_id
JOIN users u ON m.calendar_account = u.email
WHERE u.created_by = ?
GROUP BY ss.subject
```

---

## Security Rules

### NEVER Expose to Frontend:
1. **`meetings.meeting_id`** - External meeting ID (e.g., 'kvh-gnka-qxt')
2. **`meeting_sessions.session_id`** - External session ID
3. **`users.id`** in dropdowns - Use internal IDs only for filtering
4. **`users.password`** - Never return in any API
5. **`calendar_integrations.access_token`** - Never return in any API

### ALWAYS Use Internal IDs:
- **Meetings:** Use `meetings.id` (not `meetings.meeting_id`)
- **Sessions:** Use `meeting_sessions.id` (not `meeting_sessions.session_id`)
- **Users:** Use `users.id` for filtering, but don't expose in frontend dropdowns

### Multi-Tenant Security:
- **Always filter by `created_by`:** `WHERE u.created_by = loggedInAdminId`
- **Never show cross-admin data:** Each admin only sees their own instructors' data
- **Verify ownership:** Join through `users.created_by` to ensure data belongs to logged-in admin

---

## API Response Format

### Standard Success Response
```json
{
  "statusCode": 200,
  "success": true,
  "data": {
    // Response data here
  }
}
```

### Standard Error Response
```json
{
  "statusCode": 400,
  "success": false,
  "error": "Error message here"
}
```

### Route Handler Pattern
```javascript
// routes/tutoring.js
function handle(fn) {
  return (req, res) => fn(req).then(r =>
    res.status(r.statusCode || (r.success === false ? 400 : 200)).json(r)
  );
}

// Usage
router.post('/endpoint', requireAuth, handle(controller.method));
```

---

## File Structure Reference

```
database/
├── SCHEMA.md                          ← This file - complete schema reference
├── db.js                              ← Database connection setup
├── migrations/                        ← Database migration files
│   ├── 001_initial_schema.js
│   ├── 002_add_roles.js
│   └── ...
├── seeders/                           ← Database seed files
│   ├── adminUserSeeder.js
│   ├── companiesSeeder.js
│   └── ...
└── seedHelpers.js                     ← Helper functions for migrations

controllers/
├── sessionQualityController.js        ← Main controller for reports
├── sessionQualityFilterController.js  ← Filter controller
└── ...

routes/
└── tutoring.js                        ← All session-quality routes

models/
├── SessionSnapshotModel.js
├── SessionAnalysisModel_v2.js
└── ...

public/js/admin/session-quality/
├── shared-filters.js                  ← Cascading filter logic
├── index.js                           ← Dashboard page
├── analysis.js                        ← Analysis page
└── ...
```

---

## Quick Reference: ID Usage

| Table | Column | Use In Frontend? | Description |
|-------|--------|------------------|-------------|
| `users` | `id` | ❌ NO | Internal user ID (for filtering only) |
| `users` | `email` | ❌ NO | Email (used for calendar_account matching) |
| `meetings` | `id` | ✅ YES | **Internal meeting ID** (safe to expose) |
| `meetings` | `meeting_id` | ❌ NO | External meeting ID (NEVER expose) |
| `meeting_sessions` | `id` | ✅ YES | **Internal session ID** (safe to expose) |
| `meeting_sessions` | `session_id` | ❌ NO | External session ID (NEVER expose) |

---

## Notes for AI Agents

1. **Always check this file first** when writing queries or debugging API issues
2. **Use internal IDs** (`id` columns) in all frontend API calls
3. **Never construct queries** that expose `meeting_id` or `session_id` to frontend
4. **Always filter by `created_by`** to ensure multi-tenant security
5. **All APIs return JSON** with `{ statusCode, success, data/error }` format
6. **Business logic belongs in controllers**, not in routes or frontend JS
7. **Frontend JS only renders** - all data processing happens in controllers

---

**Last Updated:** 2026-01-14  
**Maintained By:** RetentionLab Development Team  
**Version:** 1.0