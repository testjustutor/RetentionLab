/**
 * root/database/seeders/000_comprehensive_seeder.js
 *
 * COMPREHENSIVE SEEDER - Seeds ALL tables in the RetentionLab database.
 *
 * This is the single-file alternative to running 19 individual seeders.
 * It seeds EVERY table defined in 000_comprehensive_schema.js with
 * realistic default data. All operations are idempotent via INSERT IGNORE
 * and existence checks.
 *
 * Usage:
 *   node database/seeders/000_comprehensive_seeder.js          # standalone
 *   const { seedAll } = require('./000_comprehensive_seeder')  # programmatic
 *
 * Seeding order (respects FK dependencies):
 *   1. roles
 *   2. companies
 *   3. permissions + role_permissions
 *   4. users (super_admin, admin, instructor, solo_instructor, reviewer)
 *   5. rubric_categories + rubric_indicators
 *   6. departments + department_members
 *   7. meetings + meeting_sessions
 *   8. participants + participant_sessions + participant_attendance_sessions
 *   9. meeting_assets + meeting_reviewers + meeting_scores + meeting_session_scores
 *  10. system_settings + user_settings
 *  11. header_role_configs + header_page_configs + header_menu_items
 *  12. subscriptions
 *  13. header_configs
 *  14. calendar_providers
 *  15. menu_items + role_menu_permissions + user_menu_permissions
 *  16. session_snapshot + session_analysis + session_learning_impact
 *      + session_parent_summary + session_coaching_feedback
 *      + session_better_alternatives + session_next_plan
 *      + session_quality_flags + session_final_evaluation
 *      + session_rubric_evaluations + session_rubric_summary
 *  17. transcripts + ai_audit_results + archives + next_session_plan
 *      + session_quality_reports + student_learning_impact
 *      + teacher_coaching_feedback + teacher_better_alternatives
 *  18. user_invitations + email_logs + google_oauth_credentials
 *      + calendar_integrations + calendar_credentials + calendar_verifications
 *      + admin_rubric_indicators + rubric_assignments + rubric_audit_log
 *      + session_metadata
 */

const crypto = require('crypto');
const { runAsync, getAsync, allAsync } = require('../seedHelpers');

const seederName = '000_comprehensive_seeder';

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS: All seed data
// ═══════════════════════════════════════════════════════════════════════════════

// ─── 1. ROLES ──────────────────────────────────────────────────────────────
const ROLES = [
  { role_name: 'super_admin',    description: 'Full platform administrator' },
  { role_name: 'admin',          description: 'Company-level administrator' },
  { role_name: 'instructor',     description: 'Instructor or tutor being reviewed' },
  { role_name: 'reviewer',       description: 'Meeting reviewer' },
  { role_name: 'solo_instructor',description: 'Self-registered individual instructor with their own workspace' },
];

// ─── 2. COMPANIES ──────────────────────────────────────────────────────────
const COMPANIES = [
  {
    company_uuid: 'comp_001_default',
    company_name: 'Default Organization',
    company_code: process.env.ADMIN_COMPANY_CODE || 'DEFAULT',
    domain: 'default.local',
    logo_url: null,
    status: 'active',
  },
];

// ─── 3. PERMISSIONS ────────────────────────────────────────────────────────
const PERMISSIONS = [
  { key: 'users.view',         label: 'View Users',           category: 'Users',    description: 'View company user list' },
  { key: 'users.manage',       label: 'Manage Users',         category: 'Users',    description: 'Create/edit/deactivate users' },
  { key: 'users.invite',       label: 'Invite Users',         category: 'Users',    description: 'Send user invitations' },
  { key: 'roles.manage',       label: 'Manage Roles',         category: 'Users',    description: 'Create/edit roles' },
  { key: 'permissions.manage', label: 'Manage Permissions',   category: 'Users',    description: 'Assign permissions to roles/users' },
  { key: 'rubrics.view',       label: 'View Rubrics',         category: 'Rubrics',  description: 'View rubric library' },
  { key: 'rubrics.manage',     label: 'Manage Rubrics',       category: 'Rubrics',  description: 'Create/edit/delete rubrics' },
  { key: 'reviews.view',       label: 'View Reviews',         category: 'Reviews',  description: 'View review assignments and scores' },
  { key: 'reviews.assign',     label: 'Assign Reviews',       category: 'Reviews',  description: 'Assign reviewers to sessions' },
  { key: 'reviews.score',      label: 'Score Sessions',       category: 'Reviews',  description: 'Submit scores against a rubric' },
  { key: 'meetings.view',      label: 'View Meetings',        category: 'Meetings', description: 'View meeting/session list' },
  { key: 'meetings.manage',    label: 'Manage Meetings',      category: 'Meetings', description: 'Create/edit meetings, manage participants' },
  { key: 'reports.view',       label: 'View Reports',         category: 'Reports',  description: 'View quality/AI audit reports' },
  { key: 'reports.export',     label: 'Export Reports',       category: 'Reports',  description: 'Export reports/data' },
  { key: 'ai_audit.view',      label: 'View AI Audit Results',category: 'Reports',  description: 'View AI audit engine output' },
  { key: 'archive.view',       label: 'View Archive',         category: 'Archive',  description: 'View archived meetings/sessions' },
  { key: 'archive.manage',     label: 'Manage Archive',       category: 'Archive',  description: 'Archive/restore meetings' },
  { key: 'settings.manage',    label: 'Manage Settings',      category: 'Settings', description: 'Edit company-level settings' },
  { key: 'company.manage',     label: 'Manage Company',       category: 'Settings', description: 'Owner-level: billing, ownership transfer, deletion' },
  { key: 'meetings.view_own',  label: 'View Own Meetings',    category: 'Meetings', description: 'View only meetings owned by the current user' },
  { key: 'meetings.manage_own',label: 'Manage Own Meetings',  category: 'Meetings', description: 'Create/edit meetings owned by the current user' },
  { key: 'calendar.connect',   label: 'Connect Calendar',     category: 'Calendar', description: 'Connect and manage personal calendar integrations' },
  { key: 'reports.view_own',   label: 'View Own Reports',     category: 'Reports',  description: 'View AI/quality reports for own sessions only' },
  { key: 'profile.edit',       label: 'Edit Profile',         category: 'Profile',  description: 'Edit own profile and account details' },
];

// ─── 4. ROLE PERMISSION DEFAULTS ──────────────────────────────────────────
const ROLE_PERMISSION_DEFAULTS = {
  super_admin: PERMISSIONS.map(p => p.key),
  admin: [
    'users.view', 'users.manage', 'users.invite', 'roles.manage', 'permissions.manage',
    'rubrics.view', 'rubrics.manage',
    'reviews.view', 'reviews.assign',
    'meetings.view', 'meetings.manage',
    'reports.view', 'reports.export', 'ai_audit.view',
    'archive.view', 'archive.manage',
    'settings.manage', 'company.manage',
  ],
  reviewer: [
    'rubrics.view',
    'reviews.view', 'reviews.score',
    'meetings.view',
    'reports.view',
    'archive.view',
  ],
  instructor: [
    'meetings.view',
    'reports.view',
    'archive.view',
  ],
  solo_instructor: [
    'meetings.view_own',
    'meetings.manage_own',
    'calendar.connect',
    'reports.view_own',
    'archive.view',
    'profile.edit',
  ],
};

// ─── 5. USERS ──────────────────────────────────────────────────────────────
const USERS = [
  {
    first_name: 'Super', last_name: 'Admin',
    email: process.env.SUPER_ADMIN_EMAIL || 'superadmin@retentionlab.local',
    password: process.env.SUPER_ADMIN_PASSWORD || 'Admin@123',
    role_name: 'super_admin',
  },
  {
    first_name: 'Demo', last_name: 'Admin',
    email: process.env.ADMIN_EMAIL || 'admin@demo.local',
    password: process.env.ADMIN_PASSWORD || 'AdminDemo@123',
    role_name: 'admin',
  },
  {
    first_name: 'John', last_name: 'Instructor',
    email: 'instructor@test.com',
    password: 'Password123!',
    role_name: 'instructor',
  },
  {
    first_name: 'Jane', last_name: 'Solo',
    email: 'solo@test.com',
    password: 'Password123!',
    role_name: 'solo_instructor',
  },
  {
    first_name: 'Bob', last_name: 'Reviewer',
    email: 'reviewer@test.com',
    password: 'Password123!',
    role_name: 'reviewer',
  },
];

// ─── 6. RUBRIC DATA ────────────────────────────────────────────────────────
const RUBRIC_DATA = {
  A: {
    name: 'Instructional Quality & Pedagogy', weight: 0.22, indicators: {
      'A1.1': { name: 'Opening states purpose/objective', type: 'AI', gate: false, value: 1, benchmark: 'Tutor should state session objective at start.', requires_video: false },
      'A1.2': { name: 'Instruction follows logical sequence', type: 'AI', gate: false, value: 1, benchmark: 'Content progresses from simple to complex in logical order.', requires_video: false },
      'A1.3': { name: 'Practice activities align to instruction', type: 'AI', gate: false, value: 1, benchmark: 'Practice tasks directly reinforce the taught concept.', requires_video: false },
      'A1.4': { name: 'Session includes meaningful closure', type: 'AI', gate: false, value: 1, benchmark: 'Session ends with summary or check for understanding.', requires_video: false },
      'A2.1': { name: 'Uses evidence-based strategy', type: 'AI', gate: false, value: 1, benchmark: 'Instructional approach is supported by research.', requires_video: false },
      'A2.2': { name: 'Modeling precedes guided practice', type: 'AI', gate: false, value: 1, benchmark: 'Tutor demonstrates skill before student attempts it.', requires_video: false },
      'A2.3': { name: 'Strategy matches learning objective', type: 'HUMAN', gate: false, value: 1, benchmark: 'Chosen method directly supports the stated goal.', requires_video: false },
      'A2.4': { name: 'Adjusts strategy based on learner response', type: 'HUMAN', gate: false, value: 1, benchmark: 'Tutor modifies approach when student shows confusion.', requires_video: false },
      'A3.1': { name: 'Explanations accurate and clear', type: 'AI', gate: true, value: 1, benchmark: 'Information presented is correct and easy to follow.', requires_video: false },
      'A3.2': { name: 'Examples are age/level appropriate', type: 'AI', gate: false, value: 1, benchmark: 'Illustrations match student\'s grade and ability.', requires_video: false },
      'A3.3': { name: 'Uses think-alouds/worked examples', type: 'AI', gate: false, value: 1, benchmark: 'Tutor verbalizes problem-solving process.', requires_video: false },
      'A3.4': { name: 'Avoids cognitive overload', type: 'HUMAN', gate: false, value: 1, benchmark: 'Information presented in manageable chunks.', requires_video: false },
      'A4.1': { name: 'Instruction adjusted to learner level', type: 'HUMAN', gate: false, value: 1, benchmark: 'Pacing and complexity match student\'s current level.', requires_video: false },
      'A4.2': { name: 'Uses prompts or cues to support', type: 'AI', gate: false, value: 1, benchmark: 'Hints guide student toward correct answer.', requires_video: false },
      'A4.3': { name: 'Gradual release of responsibility observed', type: 'AI', gate: false, value: 1, benchmark: 'Support fades as student demonstrates independence.', requires_video: false },
      'A4.4': { name: 'Support provided when learner struggles', type: 'HUMAN', gate: false, value: 1, benchmark: 'Additional help offered when student shows difficulty.', requires_video: false },
    },
  },
  B: {
    name: 'Curriculum Alignment & Accuracy', weight: 0.15, indicators: {
      'B1.1': { name: 'Objective aligns to curriculum', type: 'AI', gate: false, value: 1, benchmark: 'Session objective matches grade-level standards.', requires_video: false },
      'B1.2': { name: 'Content matches scope & sequence', type: 'AI', gate: false, value: 1, benchmark: 'Topics follow the planned curriculum sequence.', requires_video: false },
      'B1.3': { name: 'No off-grade/irrelevant content', type: 'AI', gate: false, value: 1, benchmark: 'All content is on-grade level and relevant.', requires_video: false },
      'B2.1': { name: 'No factual/conceptual errors', type: 'AI', gate: true, value: 1, benchmark: 'Information presented is factually accurate.', requires_video: false },
      'B2.2': { name: 'Terminology used correctly', type: 'AI', gate: true, value: 1, benchmark: 'Subject-specific terms are used properly.', requires_video: false },
      'B2.3': { name: 'Corrects own mistakes', type: 'HUMAN', gate: true, value: 1, benchmark: 'Tutor acknowledges and fixes errors immediately.', requires_video: false },
      'B3.1': { name: 'Adequate depth for learner level', type: 'HUMAN', gate: false, value: 1, benchmark: 'Complexity is appropriate for student\'s grade.', requires_video: false },
      'B3.2': { name: 'Avoids unnecessary digressions', type: 'AI', gate: false, value: 1, benchmark: 'Discussion stays focused on the objective.', requires_video: false },
      'B3.3': { name: 'Maintains focus on objective', type: 'AI', gate: false, value: 1, benchmark: 'All activities connect to the learning goal.', requires_video: false },
      'B4.1': { name: 'Tasks support objective', type: 'AI', gate: false, value: 1, benchmark: 'Assignments directly practice the target skill.', requires_video: false },
      'B4.2': { name: 'Materials are grade-appropriate', type: 'AI', gate: false, value: 1, benchmark: 'Resources match student\'s reading and skill level.', requires_video: false },
      'B4.3': { name: 'Resources used effectively', type: 'HUMAN', gate: false, value: 1, benchmark: 'Materials enhance rather than distract from learning.', requires_video: false },
    },
  },
  C: {
    name: 'Learner Engagement & Responsiveness', weight: 0.14, indicators: {
      'C1.1': { name: 'Learner required to think/respond', type: 'AI', gate: false, value: 1, benchmark: 'Student actively participates in learning activities.', requires_video: false },
      'C1.2': { name: 'Questions promote reasoning', type: 'HUMAN', gate: false, value: 1, benchmark: 'Questions require explanation, not just recall.', requires_video: false },
      'C1.3': { name: 'Opportunities for application provided', type: 'AI', gate: false, value: 1, benchmark: 'Student applies knowledge through practice tasks.', requires_video: false },
      'C2.1': { name: 'Learner remains on-task', type: 'AI', gate: false, value: 1, benchmark: 'Student stays focused on assigned activities.', requires_video: true },
      'C2.2': { name: 'Instructor monitors engagement', type: 'AI', gate: false, value: 1, benchmark: 'Tutor checks student understanding regularly.', requires_video: true },
      'C2.3': { name: 'Off-task behavior addressed', type: 'HUMAN', gate: false, value: 1, benchmark: 'Tutor redirects student when attention drifts.', requires_video: true },
      'C3.1': { name: 'Positive reinforcement used', type: 'AI', gate: false, value: 1, benchmark: 'Tutor acknowledges student effort and progress.', requires_video: true },
      'C3.2': { name: 'Instructor tone is encouraging', type: 'AI', gate: false, value: 1, benchmark: 'Voice conveys support and confidence in student.', requires_video: true },
      'C3.3': { name: 'Responds to learner frustration', type: 'HUMAN', gate: false, value: 1, benchmark: 'Tutor recognizes and addresses student emotions.', requires_video: true },
      'C4.1': { name: 'Acknowledges learner responses', type: 'AI', gate: false, value: 1, benchmark: 'Tutor confirms receipt of student input.', requires_video: false },
      'C4.2': { name: 'Adjusts instruction based on input', type: 'HUMAN', gate: false, value: 1, benchmark: 'Teaching changes in response to student feedback.', requires_video: false },
      'C4.3': { name: 'Follows up on incorrect responses', type: 'AI', gate: false, value: 1, benchmark: 'Errors are addressed and clarified.', requires_video: false },
    },
  },
  D: {
    name: 'Assessment & Feedback Quality', weight: 0.12, indicators: {
      'D1.1': { name: 'Checks for understanding embedded', type: 'AI', gate: false, value: 1, benchmark: 'Tutor verifies comprehension throughout session.', requires_video: false },
      'D1.2': { name: 'Questions/tasks used diagnostically', type: 'HUMAN', gate: false, value: 1, benchmark: 'Assessments reveal student thinking process.', requires_video: false },
      'D1.3': { name: 'Assessment aligned to objective', type: 'AI', gate: false, value: 1, benchmark: 'Checks directly measure the learning goal.', requires_video: false },
      'D2.1': { name: 'Feedback is timely', type: 'AI', gate: false, value: 1, benchmark: 'Corrections given immediately after errors.', requires_video: false },
      'D2.2': { name: 'Feedback is specific/actionable', type: 'HUMAN', gate: false, value: 1, benchmark: 'Feedback tells student what to improve and how.', requires_video: false },
      'D2.3': { name: 'Feedback focuses on process', type: 'AI', gate: false, value: 1, benchmark: 'Comments address how to improve, not just outcome.', requires_video: false },
      'D3.1': { name: 'Errors identified correctly', type: 'AI', gate: false, value: 1, benchmark: 'Mistakes are recognized and explained.', requires_video: false },
      'D3.2': { name: 'Misconceptions explicitly addressed', type: 'HUMAN', gate: false, value: 1, benchmark: 'Root causes of errors are clarified.', requires_video: false },
      'D3.3': { name: 'Corrective feedback is respectful', type: 'AI', gate: false, value: 1, benchmark: 'Corrections maintain student dignity.', requires_video: true },
      'D4.1': { name: 'Tracks performance during session', type: 'AI', gate: false, value: 1, benchmark: 'Tutor monitors progress toward objective.', requires_video: false },
      'D4.2': { name: 'Adjusts pacing based on progress', type: 'HUMAN', gate: false, value: 1, benchmark: 'Speed changes based on student mastery.', requires_video: false },
      'D4.3': { name: 'Uses evidence for next steps', type: 'HUMAN', gate: false, value: 1, benchmark: 'Future planning is based on session observations.', requires_video: false },
    },
  },
  E: {
    name: 'Classroom Management & Pacing', weight: 0.10, indicators: {
      'E1.1': { name: 'Pacing appropriate for learner', type: 'HUMAN', gate: false, value: 1, benchmark: 'Speed matches student\'s processing ability.', requires_video: false },
      'E1.2': { name: 'Time allocated proportionally', type: 'AI', gate: false, value: 1, benchmark: 'Activities receive appropriate time allocation.', requires_video: false },
      'E1.3': { name: 'No prolonged idle time', type: 'AI', gate: false, value: 1, benchmark: 'Learning continues without unnecessary pauses.', requires_video: false },
      'E2.1': { name: 'Instructor maintains control', type: 'AI', gate: false, value: 1, benchmark: 'Tutor directs session effectively.', requires_video: true },
      'E2.2': { name: 'Clear directions provided', type: 'AI', gate: false, value: 1, benchmark: 'Instructions are easy to understand and follow.', requires_video: false },
      'E2.3': { name: 'Manages disruptions effectively', type: 'HUMAN', gate: false, value: 1, benchmark: 'Interruptions handled without losing instructional time.', requires_video: true },
      'E3.1': { name: 'Smooth transitions', type: 'AI', gate: false, value: 1, benchmark: 'Movement between activities is seamless.', requires_video: false },
      'E3.2': { name: 'Maintains instructional momentum', type: 'HUMAN', gate: false, value: 1, benchmark: 'Session progresses without losing focus.', requires_video: false },
      'E3.3': { name: 'Minimizes downtime', type: 'AI', gate: false, value: 1, benchmark: 'Non-instructional time is minimized.', requires_video: false },
      'E4.1': { name: 'Instructional time maximized', type: 'AI', gate: false, value: 1, benchmark: 'Majority of time spent on learning activities.', requires_video: false },
      'E4.2': { name: 'Minimal off-task talk', type: 'AI', gate: false, value: 1, benchmark: 'Conversation stays focused on learning.', requires_video: false },
      'E4.3': { name: 'Administrative tasks minimized', type: 'AI', gate: false, value: 1, benchmark: 'Paperwork and logistics kept to minimum.', requires_video: false },
    },
  },
  F: {
    name: 'Communication & Language Use', weight: 0.10, indicators: {
      'F1.1': { name: 'Speech is clear/audible', type: 'AI', gate: false, value: 1, benchmark: 'Tutor\'s voice is easy to understand.', requires_video: true },
      'F1.2': { name: 'Instructions are concise', type: 'AI', gate: false, value: 1, benchmark: 'Directions are brief and to the point.', requires_video: false },
      'F1.3': { name: 'Rephrases when confused', type: 'HUMAN', gate: false, value: 1, benchmark: 'Tutor restates explanations when needed.', requires_video: false },
      'F2.1': { name: 'Vocabulary appropriate for level', type: 'AI', gate: false, value: 1, benchmark: 'Words match student\'s comprehension level.', requires_video: false },
      'F2.2': { name: 'Avoids unnecessary jargon', type: 'AI', gate: false, value: 1, benchmark: 'Complex terms are explained or avoided.', requires_video: false },
      'F2.3': { name: 'Adjusts language for learner', type: 'HUMAN', gate: false, value: 1, benchmark: 'Speech adapts to student\'s understanding.', requires_video: false },
      'F3.1': { name: 'Uses open-ended questions', type: 'AI', gate: false, value: 1, benchmark: 'Questions require more than yes/no answers.', requires_video: false },
      'F3.2': { name: 'Provides adequate wait time', type: 'HUMAN', gate: false, value: 1, benchmark: 'Tutor allows time for student to think.', requires_video: true },
      'F3.3': { name: 'Probes learner thinking', type: 'HUMAN', gate: false, value: 1, benchmark: 'Tutor asks follow-up questions to check depth.', requires_video: false },
      'F4.1': { name: 'Listens without interruption', type: 'AI', gate: false, value: 1, benchmark: 'Tutor lets student finish speaking.', requires_video: true },
      'F4.2': { name: 'Allows sufficient learner talk time', type: 'HUMAN', gate: false, value: 1, benchmark: 'Student speaks more than tutor.', requires_video: true },
      'F4.3': { name: 'Responds appropriately to cues', type: 'HUMAN', gate: false, value: 1, benchmark: 'Tutor picks up on student\'s verbal and nonverbal signals.', requires_video: true },
    },
  },
  G: {
    name: 'Professionalism & Compliance', weight: 0.09, indicators: {
      'G1.1': { name: 'Maintains respectful tone', type: 'AI', gate: true, value: 1, benchmark: 'Tutor speaks politely and supportively.', requires_video: true },
      'G1.2': { name: 'Demonstrates patience', type: 'AI', gate: false, value: 1, benchmark: 'Tutor remains calm and supportive.', requires_video: true },
      'G1.3': { name: 'Maintains appropriate body language', type: 'HUMAN', gate: false, value: 1, benchmark: 'Nonverbal cues are professional and engaged.', requires_video: true },
      'G2.1': { name: 'Uses platform tools correctly', type: 'AI', gate: false, value: 1, benchmark: 'Whiteboard, chat, and tools used effectively.', requires_video: false },
      'G2.2': { name: 'Follows session protocols', type: 'AI', gate: true, value: 1, benchmark: 'Tutor adheres to platform guidelines.', requires_video: false },
      'G2.3': { name: 'No prohibited actions observed', type: 'AI', gate: true, value: 1, benchmark: 'Session follows all safety and policy rules.', requires_video: true },
      'G3.1': { name: 'Learner safety maintained', type: 'AI', gate: true, value: 1, benchmark: 'Student\'s wellbeing is prioritized throughout.', requires_video: true },
      'G3.2': { name: 'No inappropriate content', type: 'AI', gate: true, value: 1, benchmark: 'All material is age-appropriate and professional.', requires_video: false },
      'G3.3': { name: 'Handles sensitive situations', type: 'HUMAN', gate: true, value: 1, benchmark: 'Tutor responds appropriately to concerns.', requires_video: true },
    },
  },
  H: {
    name: 'Learning Outcomes & Evidence', weight: 0.08, indicators: {
      'H1.1': { name: 'Objective meaningfully addressed', type: 'AI', gate: false, value: 1, benchmark: 'Session successfully covers the stated goal.', requires_video: false },
      'H1.2': { name: 'Evidence of learner understanding', type: 'HUMAN', gate: false, value: 1, benchmark: 'Student demonstrates grasp of the concept.', requires_video: false },
      'H1.3': { name: 'Learner can articulate learning', type: 'AI', gate: false, value: 1, benchmark: 'Student explains the concept in their own words.', requires_video: false },
      'H2.1': { name: 'Learner demonstrates target skill', type: 'AI', gate: false, value: 1, benchmark: 'Student performs the skill correctly.', requires_video: false },
      'H2.2': { name: 'Improvement within session', type: 'HUMAN', gate: false, value: 1, benchmark: 'Student shows progress during the session.', requires_video: false },
      'H2.3': { name: 'Errors reduce over time', type: 'HUMAN', gate: false, value: 1, benchmark: 'Mistake frequency decreases with practice.', requires_video: false },
      'H3.1': { name: 'Key learning summarized', type: 'AI', gate: false, value: 1, benchmark: 'Main points are reviewed at the end.', requires_video: false },
      'H3.2': { name: 'Reinforcement/practice suggested', type: 'AI', gate: false, value: 1, benchmark: 'Student receives guidance for continued practice.', requires_video: false },
      'H3.3': { name: 'Next steps communicated', type: 'AI', gate: false, value: 1, benchmark: 'Future learning goals are clearly stated.', requires_video: false },
    },
  },
};

// ─── 7. DEPARTMENTS ────────────────────────────────────────────────────────
const DEPARTMENTS = [
  { name: 'Mathematics', description: 'Math department covering Algebra, Geometry, Calculus' },
  { name: 'Science', description: 'Science department covering Physics, Chemistry, Biology' },
];

// ─── 8. SYSTEM SETTINGS ────────────────────────────────────────────────────
const SETTINGS_BY_GROUP = {
  organization: [
    { setting_key: 'company_timezone', setting_value: 'Asia/Kolkata' },
    { setting_key: 'company_locale', setting_value: 'en-IN' },
    { setting_key: 'default_meeting_platform', setting_value: 'zoom' },
    { setting_key: 'support_email', setting_value: 'support@retentionlab.local' },
    { setting_key: 'support_phone', setting_value: '' },
  ],
  platforms: [
    { setting_key: 'platforms.zoom.enabled', setting_value: 'true' },
    { setting_key: 'platforms.zoom.bot_name', setting_value: 'RetentionLab Bot' },
    { setting_key: 'platforms.zoom.base_url', setting_value: 'https://us05web.zoom.us/wc/' },
    { setting_key: 'platforms.zoom.requires_passcode', setting_value: 'true' },
    { setting_key: 'platforms.zoom.auto_enable_captions', setting_value: 'true' },
    { setting_key: 'platforms.google-meet.enabled', setting_value: 'true' },
    { setting_key: 'platforms.google-meet.bot_name', setting_value: 'RetentionLab Bot' },
    { setting_key: 'platforms.google-meet.base_url', setting_value: 'https://meet.google.com/' },
    { setting_key: 'platforms.google-meet.auto_join', setting_value: 'true' },
    { setting_key: 'platforms.google-meet.auto_enable_captions', setting_value: 'true' },
    { setting_key: 'platforms.teams.enabled', setting_value: 'false' },
    { setting_key: 'platforms.teams.bot_name', setting_value: 'RetentionLab Bot' },
    { setting_key: 'platforms.teams.base_url', setting_value: 'https://teams.live.com/meet/' },
    { setting_key: 'platforms.teams.auto_join', setting_value: 'false' },
    { setting_key: 'platforms.teams.auto_enable_captions', setting_value: 'false' },
    { setting_key: 'recording.audio_recording', setting_value: 'true' },
    { setting_key: 'recording.video_recording', setting_value: 'true' },
    { setting_key: 'recording.transcript_recording', setting_value: 'true' },
  ],
  access_control: [
    { setting_key: 'allow_instructor_self_registration', setting_value: 'false' },
    { setting_key: 'allow_guest_access', setting_value: 'false' },
    { setting_key: 'allow_reviewer_assignment', setting_value: 'true' },
    { setting_key: 'allow_score_editing_after_submit', setting_value: 'false' },
    { setting_key: 'allow_meeting_deletion', setting_value: 'false' },
    { setting_key: 'allow_transcript_download', setting_value: 'true' },
    { setting_key: 'allow_audio_download', setting_value: 'true' },
    { setting_key: 'allow_report_export', setting_value: 'true' },
    { setting_key: 'require_admin_approval_for_new_users', setting_value: 'false' },
    { setting_key: 'session_auto_logout_minutes', setting_value: '60' },
  ],
  notifications: [
    { setting_key: 'notify_on_meeting_completed', setting_value: 'true' },
    { setting_key: 'notify_on_review_assigned', setting_value: 'true' },
    { setting_key: 'notify_on_score_submitted', setting_value: 'true' },
    { setting_key: 'notify_on_transcript_ready', setting_value: 'true' },
    { setting_key: 'notify_on_error', setting_value: 'true' },
    { setting_key: 'notify_on_failed_upload', setting_value: 'true' },
    { setting_key: 'digest_frequency', setting_value: 'weekly' },
    { setting_key: 'digest_delivery_time', setting_value: '09:00' },
    { setting_key: 'notification_channels', setting_value: JSON.stringify(['email', 'in_app']) },
  ],
};

const USER_SETTING_DEFAULTS = {
  super_admin: [
    { setting_key: 'default_dashboard_view', setting_value: 'overview' },
    { setting_key: 'default_items_per_page', setting_value: '50' },
    { setting_key: 'privacy_mode', setting_value: 'standard' },
  ],
  admin: [
    { setting_key: 'default_dashboard_view', setting_value: 'overview' },
    { setting_key: 'default_items_per_page', setting_value: '25' },
    { setting_key: 'digest_frequency', setting_value: 'daily' },
    { setting_key: 'default_review_mode', setting_value: 'manual' },
  ],
  reviewer: [
    { setting_key: 'default_dashboard_view', setting_value: 'meetings' },
    { setting_key: 'default_items_per_page', setting_value: '25' },
    { setting_key: 'privacy_mode', setting_value: 'strict' },
    { setting_key: 'captions_enabled', setting_value: 'true' },
  ],
  instructor: [
    { setting_key: 'default_dashboard_view', setting_value: 'overview' },
    { setting_key: 'default_items_per_page', setting_value: '10' },
    { setting_key: 'privacy_mode', setting_value: 'strict' },
    { setting_key: 'show_tips', setting_value: 'true' },
  ],
};

// ─── 9. HEADER ROLE CONFIGS ───────────────────────────────────────────────
const HEADER_NAV_BY_ROLE = {
  super_admin: {
    home: { label: 'Dashboard', href: '/super_admin' },
    events: { label: 'Events', href: '/super_admin/integrations/bot' },
    archives: { label: 'Archives', href: '/super_admin/storage/archives' },
    profile: { label: 'Profile', href: '/super_admin/people/profile' },
    settings: { label: 'Settings', href: '/super_admin/settings/settings' },
  },
  admin: {
    home: { label: 'Dashboard', href: '/admin/index.html' },
    events: { label: 'Events', href: '/admin/calendar-events.html' },
    archives: { label: 'Archives', href: '/admin/archives.html' },
    profile: { label: 'Profile', href: '/admin/profile.html' },
    settings: { label: 'Settings', href: '/admin/settings.html' },
  },
  reviewer: {
    home: { label: 'Dashboard', href: '/reviewer/dashboard' },
    events: { label: 'Reviews', href: '/reviewer/reviews' },
    archives: { label: 'Sessions', href: '/reviewer/sessions' },
    profile: { label: 'Profile', href: '/reviewer/profile' },
    settings: { label: 'Settings', href: '/reviewer/settings' },
  },
  instructor: {
    home: { label: 'Dashboard', href: '/instructor/index.html' },
    events: { label: 'Events', href: '/instructor/calendar-events.html' },
    archives: { label: 'Archives', href: '/instructor/archives.html' },
    profile: { label: 'Profile', href: '/instructor/profile.html' },
    settings: { label: 'Settings', href: '/instructor/settings.html' },
  },
  solo_instructor: {
    home: { label: 'Dashboard', href: '/instructor/index.html' },
    events: { label: 'Meetings', href: '/meetings' },
    archives: { label: 'Content', href: '/content/recordings' },
    profile: { label: 'Profile', href: '/profile' },
    settings: { label: 'Settings', href: '/settings' },
  },
};

// ─── 10. HEADER PAGE CONFIGS ──────────────────────────────────────────────
const HEADER_PAGES = {
  dashboard:        { title: 'Session Quality Dashboard',            description: 'Teaching performance, student engagement, and session outcomes',                            roleTitle: 'Dashboard', showStats: true,  buttons: [] },
  profile:          { title: 'My Profile',         description: 'View and update your profile',                              roleTitle: 'Console', showStats: false, buttons: [] },
  settings:         { title: 'Settings',           description: 'Manage your preferences',                                   roleTitle: 'Console', showStats: false, buttons: [] },
  archives:         { title: 'Archives',           description: 'Browse archived records',                                   roleTitle: 'Console', showStats: false, buttons: [] },
  events:           { title: 'Events',             description: 'View event timeline',                                       roleTitle: 'Console', showStats: false, buttons: [] },
  calendarAccounts: { title: 'Calendar Accounts',  description: 'Manage connected calendar accounts and email sources.',     roleTitle: 'Console', showStats: false, buttons: [] },
  bot:              { title: 'Bot Engine Console', description: 'Monitor real-time orchestrator instances and active bots.', roleTitle: 'Console', showStats: false, buttons: [] },
  assets:           { title: 'Media Assets',       description: 'View partitioned audio chunks and raw exports.',            roleTitle: 'Console', showStats: false, buttons: [] },
  audit:            { title: 'Audit Timeline',     description: 'Review system audit logs and compliance tracking.',         roleTitle: 'Console', showStats: false, buttons: [] },
  dataArchitecture: { title: 'Data Architecture',  description: 'Inspect schema models, retention flows, and topology.',    roleTitle: 'Console', showStats: false, buttons: [] },
  addUser:          { title: 'Add User',           description: 'Create new users and assign roles.',                         roleTitle: 'Super Admin', showStats: false, buttons: [] },
  manageUsers:      { title: 'Manage Users',       description: 'View, update, and delete user accounts.',                   roleTitle: 'Super Admin', showStats: false, buttons: [] },
  rolesAccess:      { title: 'Roles & Access',      description: 'Define and manage user roles and permissions.',             roleTitle: 'Super Admin', showStats: false, buttons: [] },
  userSettings:     { title: 'User Settings',      description: 'Configure global user-related settings.',                  roleTitle: 'Super Admin', showStats: false, buttons: [] },
  rubricManagement: { title: 'Rubric Management',   description: 'Create, manage, and assign rubric categories and indicators.', roleTitle: 'Super Admin', showStats: false, buttons: [] },
  sidebarMenuManagement: { title: 'Sidebar Menu Management', description: 'Create, edit, and delete sidebar menu items for all roles.', roleTitle: 'Super Admin', showStats: false, buttons: [] },
  server:           { title: 'Server Performance', description: 'Monitor server CPU, memory, storage, and database metrics.', roleTitle: 'Super Admin', showStats: false, buttons: [] },
  headerManagement: { title: 'Header Management', description: 'Manage header page configurations for all roles.', roleTitle: 'Super Admin', showStats: false, buttons: [] },
  sessionQualityIndex: { title: 'Session Quality Reports', description: 'Comprehensive 10-section session evaluation and coaching insights.', roleTitle: 'Admin', showStats: false, buttons: [] },
  sessionQualityRubric: { title: 'Rubric Evaluation', description: 'Domain groupings, criteria codes, ratings, and evidence.', roleTitle: 'Admin', showStats: false, buttons: [] },
  sessionQualityAnalysis: { title: 'Session Analysis', description: 'What worked well, needs improvement, and missed opportunities.', roleTitle: 'Admin', showStats: false, buttons: [] },
  sessionQualityImpact: { title: 'Learning Impact', description: 'Impact areas with evidence and learning level assessment.', roleTitle: 'Admin', showStats: false, buttons: [] },
  sessionQualityParentSummary: { title: 'Parent Summary', description: 'Plain-language version for parent-facing view.', roleTitle: 'Admin', showStats: false, buttons: [] },
  sessionQualityCoaching: { title: 'Coaching Feedback', description: 'Strengths and areas to improve for tutor/coach audience.', roleTitle: 'Admin', showStats: false, buttons: [] },
  sessionQualityBetterAlternatives: { title: 'Better Alternatives', description: 'Situation, current approach, better alternative, and purpose.', roleTitle: 'Admin', showStats: false, buttons: [] },
  sessionQualityNextPlan: { title: 'Next Session Plan', description: 'Time-blocked plan with priority focus and gaps to address.', roleTitle: 'Admin', showStats: false, buttons: [] },
  sessionQualityFlags: { title: 'Quality Flags', description: 'Flagged issues with severity, evidence, and recommended fixes.', roleTitle: 'Admin', showStats: false, buttons: [] },
  sessionQualityFinalEval: { title: 'Final Evaluation', description: 'Aggregated ratings and QA team narrative summary.', roleTitle: 'Admin', showStats: false, buttons: [] },
  adminReportsSessionQuality: { title: 'Session Quality Reports', description: 'Access the 10-section session quality and impact report viewer.', roleTitle: 'Admin', showStats: false, buttons: [] },
  contentAssets: { title: 'Media Assets', description: 'View and manage audio, video, and document assets.', roleTitle: 'Admin', showStats: false, buttons: [] },
  contentRecordings: { title: 'Recordings', description: 'Browse and manage session recordings.', roleTitle: 'Admin', showStats: false, buttons: [] },
  contentSummaries: { title: 'Summaries', description: 'View AI-generated session summaries.', roleTitle: 'Admin', showStats: false, buttons: [] },
  contentTranscripts: { title: 'Transcripts', description: 'Browse and search session transcripts.', roleTitle: 'Admin', showStats: false, buttons: [] },
  evaluationPerformance: { title: 'Performance', description: 'View performance metrics and evaluations.', roleTitle: 'Admin', showStats: false, buttons: [] },
  evaluationReviews: { title: 'Reviews', description: 'Manage and review session evaluations.', roleTitle: 'Admin', showStats: false, buttons: [] },
  evaluationRubrics: { title: 'Rubrics', description: 'View and manage evaluation rubrics.', roleTitle: 'Admin', showStats: false, buttons: [] },
  evaluationScores: { title: 'Scores', description: 'View session scores and grading.', roleTitle: 'Admin', showStats: false, buttons: [] },
  insightsActions: { title: 'Action Items', description: 'Track and manage action items from sessions.', roleTitle: 'Admin', showStats: false, buttons: [] },
  insightsAnalytics: { title: 'Analytics', description: 'View detailed analytics and trends.', roleTitle: 'Admin', showStats: false, buttons: [] },
  insightsDecisions: { title: 'Decisions', description: 'Track decisions made during sessions.', roleTitle: 'Admin', showStats: false, buttons: [] },
  insightsEngagement: { title: 'Engagement', description: 'Monitor student engagement metrics.', roleTitle: 'Admin', showStats: false, buttons: [] },
  insightsRisks: { title: 'Risk Assessment', description: 'View and manage identified risks.', roleTitle: 'Admin', showStats: false, buttons: [] },
  meetingsCalendar: { title: 'Calendar', description: 'View and manage meeting calendar.', roleTitle: 'Admin', showStats: false, buttons: [] },
  meetingsCompleted: { title: 'Completed Meetings', description: 'Browse past completed meetings.', roleTitle: 'Admin', showStats: false, buttons: [] },
  meetingsLive: { title: 'Live Meetings', description: 'Monitor and manage live sessions.', roleTitle: 'Admin', showStats: false, buttons: [] },
  meetingsSchedule: { title: 'Schedule', description: 'Schedule and manage upcoming meetings.', roleTitle: 'Admin', showStats: false, buttons: [] },
  peopleDepartments: { title: 'Departments', description: 'Manage departments and teams.', roleTitle: 'Admin', showStats: false, buttons: [] },
  peopleRoles: { title: 'Roles', description: 'Manage user roles and permissions.', roleTitle: 'Admin', showStats: false, buttons: [] },
  peopleUsers: { title: 'Users', description: 'Manage organization users and roles', roleTitle: 'Admin', showStats: false, buttons: [] },
  reportsAudits: { title: 'Audit Reports', description: 'View audit logs and compliance reports.', roleTitle: 'Admin', showStats: false, buttons: [] },
  reportsEvaluations: { title: 'Evaluation Reports', description: 'View evaluation and assessment reports.', roleTitle: 'Admin', showStats: false, buttons: [] },
  reportsMeetings: { title: 'Meeting Reports', description: 'View meeting analytics and reports.', roleTitle: 'Admin', showStats: false, buttons: [] },
  reportsReports: { title: 'Reports', description: 'Access all system reports and analytics.', roleTitle: 'Admin', showStats: false, buttons: [] },
  reportsSessionQuality: { title: 'Session Quality Reports', description: 'Access session quality and impact reports.', roleTitle: 'Admin', showStats: false, buttons: [] },
  reportsTeams: { title: 'Team Reports', description: 'View team performance and analytics.', roleTitle: 'Admin', showStats: false, buttons: [] },
  settingsIntegrations: { title: 'Integrations', description: 'Manage third-party integrations and APIs.', roleTitle: 'Admin', showStats: false, buttons: [] },
  settingsMeetings: { title: 'Meeting Settings', description: 'Configure meeting and session settings.', roleTitle: 'Admin', showStats: false, buttons: [] },
  settingsNotifications: { title: 'Notifications', description: 'Manage notification preferences and settings.', roleTitle: 'Admin', showStats: false, buttons: [] },
  settingsOrganization: { title: 'Organization', description: 'Manage organization settings and branding.', roleTitle: 'Admin', showStats: false, buttons: [] },
};

// ─── 11. SUBSCRIPTION PLANS ──────────────────────────────────────────────
const SUBSCRIPTION_PLANS = [
  {
    plan_type: 'free',
    features_json: JSON.stringify({
      max_users: 5, max_meetings: 20, max_storage_gb: 5,
      ai_features: false, priority_support: false, custom_branding: false, api_access: false,
    }),
  },
  {
    plan_type: 'starter',
    features_json: JSON.stringify({
      max_users: 20, max_meetings: 100, max_storage_gb: 25,
      ai_features: true, priority_support: false, custom_branding: false, api_access: false,
    }),
  },
  {
    plan_type: 'professional',
    features_json: JSON.stringify({
      max_users: 100, max_meetings: 500, max_storage_gb: 100,
      ai_features: true, priority_support: true, custom_branding: true, api_access: false,
    }),
  },
  {
    plan_type: 'enterprise',
    features_json: JSON.stringify({
      max_users: -1, max_meetings: -1, max_storage_gb: 500,
      ai_features: true, priority_support: true, custom_branding: true, api_access: true,
    }),
  },
];

// ─── 12. HEADER CONFIGS ──────────────────────────────────────────────────
const HEADER_CONFIGS = [
  {
    config_key: 'app_logo',
    config_json: JSON.stringify({ light: '/images/logo-light.png', dark: '/images/logo-dark.png', favicon: '/favicon.ico', alt_text: 'RetentionLab' }),
    description: 'Application logo and branding',
  },
  {
    config_key: 'app_title',
    config_json: JSON.stringify({ default: 'RetentionLab', separator: ' | ', show_page_title: true }),
    description: 'Application title configuration',
  },
  {
    config_key: 'header_theme',
    config_json: JSON.stringify({ background: 'slate-950', border_color: 'slate-800', text_color: 'white', height: 'auto', sticky: true, shadow: true }),
    description: 'Header visual theme settings',
  },
  {
    config_key: 'header_navigation',
    config_json: JSON.stringify({ show_search: true, show_notifications: true, show_messages: false, show_help: true, max_menu_items: 10 }),
    description: 'Header navigation features',
  },
  {
    config_key: 'user_menu',
    config_json: JSON.stringify({ show_profile: true, show_settings: true, show_switch_role: true, show_logout: true, show_theme_toggle: true }),
    description: 'User dropdown menu items',
  },
];

// ─── 13. CALENDAR PROVIDERS ──────────────────────────────────────────────
const CALENDAR_PROVIDERS = [
  {
    name: 'zoom', display_name: 'Zoom', is_active: 1,
    config_json: JSON.stringify({
      auth_url: 'https://zoom.us/oauth/authorize', token_url: 'https://zoom.us/oauth/token',
      scopes: ['meeting:write:admin', 'meeting:read:admin'], join_strategy: 'webclient', requires_passcode: true,
    }),
  },
  {
    name: 'google-meet', display_name: 'Google Meet', is_active: 1,
    config_json: JSON.stringify({
      auth_url: 'https://accounts.google.com/o/oauth2/v2/auth', token_url: 'https://oauth2.googleapis.com/token',
      scopes: ['https://www.googleapis.com/auth/calendar.readonly', 'https://www.googleapis.com/auth/calendar.events'],
      join_strategy: 'direct-link', requires_passcode: false,
    }),
  },
  {
    name: 'teams', display_name: 'Microsoft Teams', is_active: 1,
    config_json: JSON.stringify({
      auth_url: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize', token_url: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      scopes: ['Calendars.ReadWrite', 'OnlineMeetings.ReadWrite'], join_strategy: 'direct-link', requires_passcode: false,
    }),
  },
];

// ─── 14. MENU ITEMS ──────────────────────────────────────────────────────
const MENU_ITEMS = [
  { menu_key: 'dashboard', label: 'Dashboard', icon: 'grid', route_path: '/super_admin/dashboard/index', parent_key: null, sort_order: 1 },
  { menu_key: 'people', label: 'People & Access', icon: 'users', route_path: null, parent_key: null, sort_order: 2,
    children: [
      { menu_key: 'add-user', label: 'Add User', route_path: '/super_admin/people/add-user.html', sort_order: 1 },
      { menu_key: 'manage-users', label: 'Manage Users', route_path: '/super_admin/people/manage-users.html', sort_order: 2 },
      { menu_key: 'access-control', label: 'Access Control', route_path: '/super_admin/people/access-control.html', sort_order: 3 },
      { menu_key: 'permission-rubrics', label: 'Permission Rubrics', route_path: '/super_admin/people/permission-rubrics.html', sort_order: 4 },
    ],
  },
  { menu_key: 'content', label: 'Content', icon: 'folder', route_path: null, parent_key: null, sort_order: 3,
    children: [
      { menu_key: 'archives', label: 'Archives', route_path: '/super_admin/storage/archives', sort_order: 1 },
      { menu_key: 'media-assets', label: 'Media Assets', route_path: '/super_admin/storage/assets', sort_order: 2 },
    ],
  },
  { menu_key: 'settings', label: 'Settings', icon: 'settings', route_path: null, parent_key: null, sort_order: 4,
    children: [
      { menu_key: 'bot-config', label: 'Bot Configuration', route_path: '/super_admin/configuration/bot-configuration', sort_order: 1 },
      { menu_key: 'ai-providers', label: 'AI Providers', route_path: '/super_admin/configuration/ai-providers', sort_order: 2 },
      { menu_key: 'platforms', label: 'Platform Integrations', route_path: '/super_admin/configuration/platforms', sort_order: 3 },
      { menu_key: 'user-defaults', label: 'User Defaults', route_path: '/super_admin/settings/user-defaults', sort_order: 4 },
    ],
  },
  { menu_key: 'monitoring', label: 'Monitoring', icon: 'activity', route_path: null, parent_key: null, sort_order: 5,
    children: [
      { menu_key: 'server-performance', label: 'Server Performance', route_path: '/super_admin/monitoring/server', sort_order: 1 },
      { menu_key: 'audit-logs', label: 'Audit Logs', route_path: '/super_admin/reports/audit.html', sort_order: 2 },
    ],
  },
  { menu_key: 'sidebar-menu-management', label: 'Manage Menu', icon: 'menu', route_path: '/super_admin/settings/sidebar-menu-management', parent_key: null, sort_order: 6 },
  { menu_key: 'profile', label: 'Profile', icon: 'user', route_path: '/super_admin/people/profile.html', parent_key: null, sort_order: 7 },
  { menu_key: 'logout', label: 'Logout', icon: 'log-out', route_path: '/logout', parent_key: null, sort_order: 999 },
  { menu_key: 'users', label: 'Users', icon: 'users', route_path: '/super_admin/people/manage-users', parent_key: null, sort_order: 10 },
  { menu_key: 'departments', label: 'Departments', icon: 'building', route_path: '/super_admin/departments/index', parent_key: null, sort_order: 11 },
  { menu_key: 'roles', label: 'Roles', icon: 'shield', route_path: '/super_admin/roles/index', parent_key: null, sort_order: 12 },
  { menu_key: 'meetings', label: 'Meetings', icon: 'calendar', route_path: null, parent_key: null, sort_order: 20,
    children: [
      { menu_key: 'schedule', label: 'Schedule', route_path: '/super_admin/meeting-schedule/index', sort_order: 1 },
      { menu_key: 'live', label: 'Live Meetings', route_path: '/super_admin/meetings/live', sort_order: 2 },
      { menu_key: 'completed', label: 'Completed', route_path: '/super_admin/meetings/completed', sort_order: 3 },
      { menu_key: 'calendar', label: 'Calendar', route_path: '/super_admin/calendar/index', sort_order: 4 },
    ],
  },
  { menu_key: 'recordings', label: 'Recordings', icon: 'video', route_path: '/super_admin/recordings/index', parent_key: null, sort_order: 30 },
  { menu_key: 'transcripts', label: 'Transcripts', icon: 'file-text', route_path: '/super_admin/transcripts/index', parent_key: null, sort_order: 31 },
  { menu_key: 'summaries', label: 'Summaries', icon: 'summary', route_path: '/super_admin/meetings/summaries', parent_key: null, sort_order: 32 },
  { menu_key: 'evaluation', label: 'Evaluation', icon: 'check-circle', route_path: null, parent_key: null, sort_order: 40,
    children: [
      { menu_key: 'rubrics', label: 'Rubrics', route_path: '/super_admin/rubrics/index', sort_order: 1 },
      { menu_key: 'reviews', label: 'Reviews', route_path: '/super_admin/reviews/index', sort_order: 2 },
      { menu_key: 'scores', label: 'Scores', route_path: '/super_admin/scores/index', sort_order: 3 },
      { menu_key: 'performance', label: 'Performance', route_path: '/super_admin/performance/index', sort_order: 4 },
    ],
  },
  { menu_key: 'insights', label: 'Insights', icon: 'lightbulb', route_path: null, parent_key: null, sort_order: 50,
    children: [
      { menu_key: 'engagement', label: 'Engagement', route_path: '/super_admin/insights/engagement', sort_order: 1 },
      { menu_key: 'actions', label: 'Action Items', route_path: '/super_admin/insights/actions', sort_order: 2 },
      { menu_key: 'decisions', label: 'Decisions', route_path: '/super_admin/insights/decisions', sort_order: 3 },
      { menu_key: 'risks', label: 'Risks', route_path: '/super_admin/insights/risks', sort_order: 4 },
      { menu_key: 'analytics', label: 'Analytics', route_path: '/super_admin/analytics/index', sort_order: 5 },
    ],
  },
  { menu_key: 'reports', label: 'Reports', icon: 'bar-chart', route_path: null, parent_key: null, sort_order: 60,
    children: [
      { menu_key: 'meeting-reports', label: 'Meeting Reports', route_path: '/super_admin/meeting-reports/index', sort_order: 1 },
      { menu_key: 'evaluation-reports', label: 'Evaluation Reports', route_path: '/super_admin/evaluation-reports/index', sort_order: 2 },
      { menu_key: 'team-reports', label: 'Team Reports', route_path: '/super_admin/team-reports/index', sort_order: 3 },
      { menu_key: 'audit-reports', label: 'Audit Reports', route_path: '/super_admin/audit-reports/index', sort_order: 4 },
    ],
  },
  { menu_key: 'session-quality', label: 'Session Quality', icon: 'quality', route_path: null, parent_key: null, sort_order: 70,
    children: [
      { menu_key: 'sq-hub', label: 'SQ Hub', route_path: '/super_admin/session-quality/hub', sort_order: 1 },
      { menu_key: 'sq-rubric', label: 'SQ Rubric', route_path: '/super_admin/session-quality/rubric', sort_order: 2 },
      { menu_key: 'sq-analysis', label: 'SQ Analysis', route_path: '/super_admin/session-quality/analysis', sort_order: 3 },
      { menu_key: 'sq-impact', label: 'SQ Impact', route_path: '/super_admin/session-quality/impact', sort_order: 4 },
      { menu_key: 'sq-parent-summary', label: 'SQ Parent Summary', route_path: '/super_admin/session-quality/parent-summary', sort_order: 5 },
      { menu_key: 'sq-coaching', label: 'SQ Coaching', route_path: '/super_admin/session-quality/coaching', sort_order: 6 },
      { menu_key: 'sq-better-alt', label: 'SQ Better Alternatives', route_path: '/super_admin/session-quality/better-alternatives', sort_order: 7 },
      { menu_key: 'sq-next-plan', label: 'SQ Next Plan', route_path: '/super_admin/session-quality/next-plan', sort_order: 8 },
      { menu_key: 'sq-flags', label: 'SQ Flags', route_path: '/super_admin/session-quality/flags', sort_order: 9 },
      { menu_key: 'sq-final-eval', label: 'SQ Final Evaluation', route_path: '/super_admin/session-quality/final-evaluation', sort_order: 10 },
    ],
  },
  { menu_key: 'organization', label: 'Organization', icon: 'building', route_path: '/super_admin/settings/organization', parent_key: null, sort_order: 80 },
  { menu_key: 'notifications', label: 'Notifications', icon: 'bell', route_path: '/super_admin/settings/notifications', parent_key: null, sort_order: 81 },
  { menu_key: 'meeting-rules', label: 'Meeting Rules', icon: 'rules', route_path: '/super_admin/settings/meeting-rules', parent_key: null, sort_order: 82 },
  { menu_key: 'integrations', label: 'Integrations', icon: 'plug', route_path: '/super_admin/settings/integrations', parent_key: null, sort_order: 83 },
  { menu_key: 'upcoming-meetings', label: 'Upcoming Meetings', icon: 'calendar', route_path: '/instructor/meetings/upcoming', parent_key: null, sort_order: 100 },
  { menu_key: 'completed-meetings', label: 'Completed Meetings', icon: 'check', route_path: '/instructor/meetings/completed', parent_key: null, sort_order: 101 },
  { menu_key: 'evaluations', label: 'Evaluations', icon: 'check-circle', route_path: '/instructor/evaluations/index', parent_key: null, sort_order: 102 },
  { menu_key: 'action-items', label: 'Action Items', icon: 'list', route_path: '/instructor/insights/actions', parent_key: null, sort_order: 103 },
];

// ─── 15. ROLE MENU HIERARCHY ────────────────────────────────────────────
const ROLE_MENU_HIERARCHY = {
  super_admin: [
    ['dashboard', null], ['people', null], ['add-user', 'people'],
    ['manage-users', 'people'], ['access-control', 'people'], ['permission-rubrics', 'people'],
    ['content', null], ['archives', 'content'], ['media-assets', 'content'],
    ['settings', null], ['bot-config', 'settings'], ['ai-providers', 'settings'],
    ['platforms', 'settings'], ['user-defaults', 'settings'],
    ['monitoring', null], ['server-performance', 'monitoring'], ['audit-logs', 'monitoring'],
    ['sidebar-menu-management', null], ['profile', null], ['logout', null],
  ],
  admin: [
    ['dashboard', null], ['people', null], ['users', 'people'], ['departments', 'people'],
    ['roles', 'people'], ['profile', 'people'],
    ['meetings', null], ['schedule', 'meetings'], ['live', 'meetings'],
    ['completed', 'meetings'], ['calendar', 'meetings'],
    ['content', null], ['recordings', 'content'], ['transcripts', 'content'],
    ['summaries', 'content'], ['archives', 'content'],
    ['evaluation', null], ['rubrics', 'evaluation'], ['reviews', 'evaluation'],
    ['scores', 'evaluation'], ['performance', 'evaluation'],
    ['insights', null], ['engagement', 'insights'], ['actions', 'insights'],
    ['decisions', 'insights'], ['risks', 'insights'], ['analytics', 'insights'],
    ['reports', null], ['meeting-reports', 'reports'], ['evaluation-reports', 'reports'],
    ['team-reports', 'reports'], ['audit-reports', 'reports'],
    ['session-quality', null], ['sq-hub', 'session-quality'], ['sq-rubric', 'session-quality'],
    ['sq-analysis', 'session-quality'], ['sq-impact', 'session-quality'],
    ['sq-parent-summary', 'session-quality'], ['sq-coaching', 'session-quality'],
    ['sq-better-alt', 'session-quality'], ['sq-next-plan', 'session-quality'],
    ['sq-flags', 'session-quality'], ['sq-final-eval', 'session-quality'],
    ['settings', null], ['organization', 'settings'], ['notifications', 'settings'],
    ['meeting-rules', 'settings'], ['integrations', 'settings'],
    ['logout', null],
  ],
  instructor: [
    ['dashboard', null], ['meetings', null], ['evaluations', null],
    ['reports', null], ['profile', null], ['logout', null],
  ],
  reviewer: [
    ['dashboard', null], ['profile', null], ['evaluations', null],
    ['reviews', null], ['analytics', null], ['logout', null],
  ],
  solo_instructor: [
    ['dashboard', null], ['meetings', null], ['upcoming-meetings', 'meetings'],
    ['completed-meetings', 'meetings'], ['content', null], ['recordings', 'content'],
    ['transcripts', 'content'], ['summaries', 'content'], ['archives', 'content'],
    ['evaluations', null], ['insights', null], ['engagement', 'insights'],
    ['action-items', 'insights'], ['decisions', 'insights'], ['analytics', 'insights'],
    ['reports', null], ['profile', null], ['logout', null],
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

const hashPassword = (password, salt = crypto.randomBytes(16).toString('hex')) => {
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
};

const flattenSettings = (groups) => Object.values(groups).flat();

const upsertSetting = async (tableName, idColumn, targetId, setting) => {
  const isNullTarget = targetId === null || targetId === undefined;
  const whereClause = isNullTarget
    ? `${idColumn} IS NULL AND setting_key = ?`
    : `${idColumn} = ? AND setting_key = ?`;
  const whereParams = isNullTarget ? [setting.setting_key] : [targetId, setting.setting_key];

  const existing = await getAsync(`SELECT id FROM ${tableName} WHERE ${whereClause} LIMIT 1`, whereParams);
  if (existing) {
    await runAsync(`UPDATE ${tableName} SET setting_value = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [setting.setting_value, existing.id]);
    return;
  }

  const columns = isNullTarget
    ? [null, 'setting_key', 'setting_value']
    : [targetId, 'setting_key', 'setting_value'];
  const values = isNullTarget
    ? [null, setting.setting_key, setting.setting_value]
    : [targetId, setting.setting_key, setting.setting_value];

  const cols = [idColumn, 'setting_key', 'setting_value'];
  const placeholders = cols.map(() => '?').join(', ');

  await runAsync(
    `INSERT INTO ${tableName} (${cols.join(', ')}, created_at, updated_at)
     VALUES (${placeholders}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    values
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// CORE SEEDING FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════

const seedAll = async () => {
  console.log('[ComprehensiveSeeder] Starting...');
  const startTime = Date.now();

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. ROLES
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('[ComprehensiveSeeder] 1/17 Seeding roles...');
  for (const role of ROLES) {
    await runAsync(
      `INSERT IGNORE INTO roles (role_name, description) VALUES (?, ?)`,
      [role.role_name, role.description]
    );
  }
  console.log(`[ComprehensiveSeeder]   ✓ ${ROLES.length} roles`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. COMPANIES
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('[ComprehensiveSeeder] 2/17 Seeding companies...');
  const { count: companyCount } = await getAsync(`SELECT COUNT(*) as count FROM companies`);
  if (companyCount === 0) {
    for (const company of COMPANIES) {
      await runAsync(
        `INSERT INTO companies (company_uuid, company_name, company_code, domain, logo_url, status)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [company.company_uuid, company.company_name, company.company_code, company.domain, company.logo_url, company.status]
      );
    }
    console.log(`[ComprehensiveSeeder]   ✓ ${COMPANIES.length} companies`);
  } else {
    console.log(`[ComprehensiveSeeder]   ✓ Companies already seeded (${companyCount})`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. PERMISSIONS
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('[ComprehensiveSeeder] 3/17 Seeding permissions...');
  for (const perm of PERMISSIONS) {
    await runAsync(
      `INSERT IGNORE INTO permissions (permission_key, label, category, description) VALUES (?, ?, ?, ?)`,
      [perm.key, perm.label, perm.category, perm.description]
    );
  }
  console.log(`[ComprehensiveSeeder]   ✓ ${PERMISSIONS.length} permissions`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. ROLE PERMISSIONS
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('[ComprehensiveSeeder] 4/17 Seeding role_permissions...');
  const roles = await allAsync('SELECT id, role_name FROM roles');
  const permissionRows = await allAsync('SELECT id, permission_key FROM permissions');
  const permIdByKey = Object.fromEntries(permissionRows.map(p => [p.permission_key, p.id]));

  let rpCount = 0;
  for (const [roleName, permKeys] of Object.entries(ROLE_PERMISSION_DEFAULTS)) {
    const role = roles.find(r => r.role_name === roleName);
    if (!role) { console.warn(`[ComprehensiveSeeder]   ⚠ Role "${roleName}" not found`); continue; }
    for (const key of permKeys) {
      const permissionId = permIdByKey[key];
      if (!permissionId) continue;
      await runAsync(
        `INSERT IGNORE INTO role_permissions (role_id, permission_id, company_id) VALUES (?, ?, NULL)`,
        [role.id, permissionId]
      );
      rpCount++;
    }
  }
  console.log(`[ComprehensiveSeeder]   ✓ ${rpCount} role permissions`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. USERS
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('[ComprehensiveSeeder] 5/17 Seeding users...');
  const company = await getAsync(`SELECT id FROM companies LIMIT 1`);
  for (const userData of USERS) {
    const existing = await getAsync(`SELECT id FROM users WHERE email = ?`, [userData.email]);
    if (existing) continue;

    const role = roles.find(r => r.role_name === userData.role_name);
    if (!role) { console.warn(`[ComprehensiveSeeder]   ⚠ Role "${userData.role_name}" not found for user ${userData.email}`); continue; }

    const password_hash = hashPassword(userData.password);
    await runAsync(
      `INSERT INTO users (
        user_uuid, company_id, role_id, first_name, last_name, email,
        password_hash, phone, profile_image, status,
        email_verified, email_verified_at,
        created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        crypto.randomUUID(),
        userData.role_name === 'super_admin' ? null : (company?.id || null),
        role.id,
        userData.first_name,
        userData.last_name,
        userData.email,
        password_hash,
        null,
        null,
        'active',
        1,
        new Date().toISOString(),
        null,
      ]
    );
  }
  console.log(`[ComprehensiveSeeder]   ✓ ${USERS.length} users`);

  // Load users for later use
  const users = await allAsync('SELECT u.id, u.email, r.role_name FROM users u LEFT JOIN roles r ON r.id = u.role_id');
  const userByEmail = Object.fromEntries(users.map(u => [u.email, u]));

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. RUBRIC CATEGORIES & INDICATORS
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('[ComprehensiveSeeder] 6/17 Seeding rubric categories & indicators...');
  let catCount = 0;
  let indCount = 0;
  for (const [catId, category] of Object.entries(RUBRIC_DATA)) {
    await runAsync(
      `INSERT IGNORE INTO rubric_categories (category_id, name, weight) VALUES (?, ?, ?)`,
      [catId, category.name, category.weight]
    );
    catCount++;

    for (const [indId, ind] of Object.entries(category.indicators)) {
      await runAsync(
        `INSERT IGNORE INTO rubric_indicators (indicator_id, category_id, name, type, is_gate, value, benchmark, requires_video)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [indId, catId, ind.name, ind.type, ind.gate ? 1 : 0, ind.value || 1, ind.benchmark || null, ind.requires_video ? 1 : 0]
      );
      indCount++;
    }
  }
  console.log(`[ComprehensiveSeeder]   ✓ ${catCount} categories, ${indCount} indicators`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 7. DEPARTMENTS & DEPARTMENT MEMBERS
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('[ComprehensiveSeeder] 7/17 Seeding departments & members...');
  const { count: deptCount } = await getAsync(`SELECT COUNT(*) as count FROM departments`);
  if (deptCount === 0 && company) {
    for (const dept of DEPARTMENTS) {
      await runAsync(
        `INSERT INTO departments (company_id, name, description, created_at, updated_at)
         VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [company.id, dept.name, dept.description]
      );
    }

    // Assign instructor to Math, reviewer to Science
    const departments = await allAsync('SELECT id, name FROM departments');
    const instructorUser = userByEmail['instructor@test.com'];
    const reviewerUser = userByEmail['reviewer@test.com'];

    if (instructorUser && departments.length > 0) {
      await runAsync(
        `INSERT IGNORE INTO department_members (department_id, user_id, role_id, status, created_at)
         VALUES (?, ?, (SELECT id FROM roles WHERE role_name = 'instructor'), 'active', CURRENT_TIMESTAMP)`,
        [departments[0].id, instructorUser.id]
      );
    }
    if (reviewerUser && departments.length > 1) {
      await runAsync(
        `INSERT IGNORE INTO department_members (department_id, user_id, role_id, status, created_at)
         VALUES (?, ?, (SELECT id FROM roles WHERE role_name = 'reviewer'), 'active', CURRENT_TIMESTAMP)`,
        [departments[1].id, reviewerUser.id]
      );
    }
  }
  console.log(`[ComprehensiveSeeder]   ✓ Departments & members seeded`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 8. MEETINGS & MEETING SESSIONS
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('[ComprehensiveSeeder] 8/17 Seeding meetings & sessions...');
  const { count: meetingCount } = await getAsync(`SELECT COUNT(*) as count FROM meetings`);
  if (meetingCount === 0 && company && instructorUser) {
    const meetingId = `meet_${Date.now()}`;
    await runAsync(
      `INSERT INTO meetings (external_meeting_id, title, description, scheduled_start_time, scheduled_end_time, platform, status, owner_user_id, company_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'completed', ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [meetingId, 'Algebra Tutoring Session - Grade 7', 'One-to-one algebra tutoring session covering linear equations',
       new Date(Date.now() - 3600000).toISOString(), new Date().toISOString(), 'zoom', instructorUser.id, company.id]
    );

    const sessionId = Math.floor(Math.random() * 10000) + 1;
    await runAsync(
      `INSERT INTO meeting_sessions (meeting_id, session_id, status, start_time, end_time, created_at, updated_at)
       VALUES (?, ?, 'completed', ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [meetingId, String(sessionId), new Date(Date.now() - 3600000).toISOString(), new Date().toISOString()]
    );

    // Store for later use in session quality tables
    process.__SEED_MEETING_ID = meetingId;
    process.__SEED_SESSION_ID = sessionId;

    console.log(`[ComprehensiveSeeder]   ✓ 1 meeting & session created (ID: ${meetingId})`);
  } else {
    // Load existing meeting/session
    const existingMeeting = await getAsync('SELECT meeting_id FROM meetings LIMIT 1');
    const existingSession = await getAsync('SELECT id FROM meeting_sessions LIMIT 1');
    process.__SEED_MEETING_ID = existingMeeting?.meeting_id || 'meet_001';
    process.__SEED_SESSION_ID = existingSession?.id || 1;
    console.log(`[ComprehensiveSeeder]   ✓ Using existing meeting/session data`);
  }

  const meetingId = process.__SEED_MEETING_ID;
  const sessionId = process.__SEED_SESSION_ID;

  // ═══════════════════════════════════════════════════════════════════════════
  // 9. PARTICIPANTS
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('[ComprehensiveSeeder] 9/17 Seeding participants...');
  const { count: partCount } = await getAsync(`SELECT COUNT(*) as count FROM participants`);
  if (partCount === 0 && meetingId) {
    // Instructor participant
    await runAsync(
      `INSERT IGNORE INTO participants (meeting_id, participant_name, participant_email, participant_role, join_time, leave_time)
       VALUES (?, ?, ?, 'instructor', ?, ?)`,
      [meetingId, 'John Instructor', 'instructor@test.com',
       new Date(Date.now() - 3600000).toISOString(), new Date(Date.now() - 1800000).toISOString()]
    );

    // Student participant
    await runAsync(
      `INSERT IGNORE INTO participants (meeting_id, participant_name, participant_email, participant_role, join_time, leave_time)
       VALUES (?, ?, ?, 'student', ?, ?)`,
      [meetingId, 'Alex Student', 'alex.student@example.com',
       new Date(Date.now() - 3500000).toISOString(), new Date(Date.now() - 1700000).toISOString()]
    );

    // Participant sessions & attendance
    const participants = await allAsync('SELECT id FROM participants WHERE meeting_id = ?', [meetingId]);
    for (const p of participants) {
      await runAsync(
        `INSERT IGNORE INTO participant_sessions (meeting_id, session_id, participant_name, join_sequence, joined_at, left_at, session_duration_seconds, session_status)
         VALUES (?, ?, (SELECT participant_name FROM participants WHERE id = ?), ?, ?, ?, ?, 'completed')`,
        [meetingId, String(sessionId), p.id, 1,
         new Date(Date.now() - 3600000).toISOString(), new Date().toISOString(), 3600]
      );
      await runAsync(
        `INSERT IGNORE INTO participant_attendance_sessions (meeting_id, participant_id, session_number, joined_at, left_at, duration_seconds, attendance_status)
         VALUES (?, ?, 1, ?, ?, 3600, 'present')`,
        [meetingId, p.id,
         new Date(Date.now() - 3600000).toISOString(), new Date().toISOString()]
      );
    }
    console.log(`[ComprehensiveSeeder]   ✓ Participants seeded`);
  } else {
    console.log(`[ComprehensiveSeeder]   ✓ Participants already seeded`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 10. MEETING ASSETS, REVIEWERS, SCORES
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('[ComprehensiveSeeder] 10/17 Seeding meeting assets, reviewers & scores...');
  if (meetingId) {
    const { count: assetCount } = await getAsync(`SELECT COUNT(*) as count FROM meeting_assets WHERE meeting_id = ?`, [meetingId]);
    if (assetCount === 0) {
      await runAsync(
        `INSERT INTO meeting_assets (meeting_id, session_id, audio_path, wav_audio_path, transcript_path, audit_json_path, oqi_score, status, processed_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [meetingId, String(sessionId), '/storage/audio/session_001.mp3', '/storage/audio/session_001.wav', '/storage/transcripts/session_001.json', '/storage/audit/session_001.json', 78.50, 'completed', CURRENT_TIMESTAMP]
      );
    }

    if (reviewerUser) {
      const { count: revCount } = await getAsync(`SELECT COUNT(*) as count FROM meeting_reviewers WHERE meeting_id = ?`, [meetingId]);
      if (revCount === 0) {
        await runAsync(
          `INSERT INTO meeting_reviewers (meeting_id, reviewer_id, assigned_by, review_status, assigned_at, created_at)
           VALUES (?, ?, ?, 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          [meetingId, reviewerUser.id, instructorUser?.id || null]
        );
      }
    }

    // Meeting scores for a few indicators
    const indicators = await allAsync('SELECT indicator_id FROM rubric_indicators LIMIT 5');
    for (const ind of indicators) {
      const { count: scoreCount } = await getAsync(
        `SELECT COUNT(*) as count FROM meeting_scores WHERE meeting_id = ? AND indicator_id = ?`, [meetingId, ind.indicator_id]
      );
      if (scoreCount === 0) {
        await runAsync(
          `INSERT INTO meeting_scores (meeting_id, indicator_id, reviewer_id, score, score_type, scored_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, 'AI', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          [meetingId, ind.indicator_id, reviewerUser?.id || null, Math.floor(Math.random() * 3) + 3]
        );
      }
    }
  }
  console.log(`[ComprehensiveSeeder]   ✓ Assets, reviewers & scores seeded`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 11. SYSTEM SETTINGS & USER SETTINGS
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('[ComprehensiveSeeder] 11/17 Seeding settings...');
  const allSystemSettings = flattenSettings(SETTINGS_BY_GROUP);
  const { count: sysSettingCount } = await getAsync(`SELECT COUNT(*) as count FROM system_settings`);
  if (sysSettingCount === 0) {
    for (const setting of allSystemSettings) {
      await upsertSetting('system_settings', 'company_id', null, setting);
    }
    console.log(`[ComprehensiveSeeder]   ✓ ${allSystemSettings.length} system settings`);
  } else {
    console.log(`[ComprehensiveSeeder]   ✓ System settings already seeded (${sysSettingCount})`);
  }

  for (const user of users) {
    const roleDefaults = USER_SETTING_DEFAULTS[user.role_name] || [];
    for (const setting of roleDefaults) {
      await upsertSetting('user_settings', 'user_id', user.id, setting);
    }
  }
  console.log(`[ComprehensiveSeeder]   ✓ User settings seeded`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 12. HEADER ROLE CONFIGS
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('[ComprehensiveSeeder] 12/17 Seeding header configurations...');
  const { count: hrcCount } = await getAsync(`SELECT COUNT(*) as count FROM header_role_configs`);
  if (hrcCount === 0) {
    for (const role of roles) {
      const nav = HEADER_NAV_BY_ROLE[role.role_name] || HEADER_NAV_BY_ROLE.instructor;
      await runAsync(
        `INSERT IGNORE INTO header_role_configs
         (role_id, home_href, home_label, events_href, events_label, archives_href, archives_label,
          profile_href, profile_label, settings_href, settings_label)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [role.id, nav.home.href, nav.home.label, nav.events.href, nav.events.label,
         nav.archives.href, nav.archives.label, nav.profile.href, nav.profile.label,
         nav.settings.href, nav.settings.label]
      );
    }
    console.log(`[ComprehensiveSeeder]   ✓ ${roles.length} header role configs`);
  } else {
    console.log(`[ComprehensiveSeeder]   ✓ Header role configs already seeded`);
  }

  // ─── Header Page Configs ──────────────────────────────────────────────
  const { count: hpcCount } = await getAsync(`SELECT COUNT(*) as count FROM header_page_configs`);
  if (hpcCount === 0) {
    for (const role of roles) {
      for (const [pageKey, pageData] of Object.entries(HEADER_PAGES)) {
        await runAsync(
          `INSERT IGNORE INTO header_page_configs
           (role_id, page_key, title, description, role_title, show_stats, buttons_json)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [role.id, pageKey, pageData.title, pageData.description, pageData.roleTitle,
           pageData.showStats ? 1 : 0, JSON.stringify(pageData.buttons)]
        );
      }
    }
    console.log(`[ComprehensiveSeeder]   ✓ ${Object.keys(HEADER_PAGES).length * roles.length} header page configs`);
  } else {
    console.log(`[ComprehensiveSeeder]   ✓ Header page configs already seeded`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 13. SUBSCRIPTIONS
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('[ComprehensiveSeeder] 13/17 Seeding subscriptions...');
  const { count: subCount } = await getAsync(`SELECT COUNT(*) as count FROM subscriptions`);
  if (subCount === 0 && company) {
    for (const plan of SUBSCRIPTION_PLANS) {
      await runAsync(
        `INSERT INTO subscriptions (company_id, plan_type, status, start_date, end_date, features_json, created_at, updated_at)
         VALUES (?, ?, 'active', CURRENT_TIMESTAMP, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 1 YEAR), ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [company.id, plan.plan_type, plan.features_json]
      );
    }
    console.log(`[ComprehensiveSeeder]   ✓ ${SUBSCRIPTION_PLANS.length} subscriptions`);
  } else {
    console.log(`[ComprehensiveSeeder]   ✓ Subscriptions already seeded`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 14. HEADER CONFIGS
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('[ComprehensiveSeeder] 14/17 Seeding header configs...');
  const { count: hcCount } = await getAsync(`SELECT COUNT(*) as count FROM header_configs`);
  if (hcCount === 0) {
    for (const config of HEADER_CONFIGS) {
      await runAsync(
        `INSERT INTO header_configs (config_key, config_json, description, created_at, updated_at)
         VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [config.config_key, config.config_json, config.description]
      );
    }
    console.log(`[ComprehensiveSeeder]   ✓ ${HEADER_CONFIGS.length} header configs`);
  } else {
    console.log(`[ComprehensiveSeeder]   ✓ Header configs already seeded`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 15. CALENDAR PROVIDERS
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('[ComprehensiveSeeder] 15/17 Seeding calendar providers...');
  const { count: cpCount } = await getAsync(`SELECT COUNT(*) as count FROM calendar_providers`);
  if (cpCount === 0) {
    for (const provider of CALENDAR_PROVIDERS) {
      await runAsync(
        `INSERT INTO calendar_providers (name, display_name, is_active, config_json, created_at)
         VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [provider.name, provider.display_name, provider.is_active, provider.config_json]
      );
    }
    console.log(`[ComprehensiveSeeder]   ✓ ${CALENDAR_PROVIDERS.length} calendar providers`);
  } else {
    console.log(`[ComprehensiveSeeder]   ✓ Calendar providers already seeded`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 16. MENU ITEMS & ROLE MENU PERMISSIONS
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('[ComprehensiveSeeder] 16/17 Seeding menu items & permissions...');
  const { count: miCount } = await getAsync(`SELECT COUNT(*) as count FROM menu_items`);
  if (miCount === 0) {
    // Insert parent items first
    const menuKeyToId = {};
    for (const item of MENU_ITEMS) {
      const result = await runAsync(
        `INSERT INTO menu_items (menu_key, label, icon, route_path, parent_id, sort_order, is_active)
         VALUES (?, ?, ?, ?, NULL, ?, 1)`,
        [item.menu_key, item.label, item.icon || null, item.route_path || null, item.sort_order]
      );
      menuKeyToId[item.menu_key] = result.lastID;

      // Insert children
      if (item.children) {
        for (const child of item.children) {
          await runAsync(
            `INSERT INTO menu_items (menu_key, label, icon, route_path, parent_id, sort_order, is_active)
             VALUES (?, ?, NULL, ?, ?, ?, 1)`,
            [child.menu_key, child.label, child.route_path || null, result.lastID, child.sort_order || 0]
          );
          menuKeyToId[child.menu_key] = result.lastID;
        }
      }
    }

    // Role menu permissions
    const menuItems = await allAsync('SELECT id, menu_key FROM menu_items');
    const menuKeyToIdMap = Object.fromEntries(menuItems.map(m => [m.menu_key, m.id]));

    for (const role of roles) {
      const hierarchy = ROLE_MENU_HIERARCHY[role.role_name] || [];
      for (const [menuKey, parentKey] of hierarchy) {
        const menuItemId = menuKeyToIdMap[menuKey];
        if (!menuItemId) continue;

        const result = await runAsync(
          `INSERT IGNORE INTO role_menu_permissions (role_id, menu_item_id, is_visible, sort_order, parent_id)
           VALUES (?, ?, 1, 0, NULL)`,
          [role.id, menuItemId]
        );

        // Update parent reference if needed
        if (parentKey && menuKeyToIdMap[parentKey]) {
          await runAsync(
            `UPDATE role_menu_permissions SET parent_id = ? WHERE role_id = ? AND menu_item_id = ?`,
            [menuKeyToIdMap[parentKey], role.id, menuItemId]
          );
        }
      }
    }
    console.log(`[ComprehensiveSeeder]   ✓ ${MENU_ITEMS.length} menu items + role permissions`);
  } else {
    console.log(`[ComprehensiveSeeder]   ✓ Menu items already seeded`);
  }

  // User menu permissions
  const { count: umpCount } = await getAsync(`SELECT COUNT(*) as count FROM user_menu_permissions`);
  if (umpCount === 0) {
    for (const user of users) {
      const rolePerms = await allAsync(
        `SELECT rmp.menu_item_id, rmp.is_visible, rmp.sort_order
         FROM role_menu_permissions rmp
         WHERE rmp.role_id = (SELECT role_id FROM users WHERE id = ?)`,
        [user.id]
      );
      for (const perm of rolePerms) {
        await runAsync(
          `INSERT IGNORE INTO user_menu_permissions (user_id, menu_item_id, is_visible, sort_order)
           VALUES (?, ?, ?, ?)`,
          [user.id, perm.menu_item_id, perm.is_visible, perm.sort_order]
        );
      }
    }
    console.log(`[ComprehensiveSeeder]   ✓ User menu permissions seeded`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 17. SESSION QUALITY TABLES (11 tables)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('[ComprehensiveSeeder] 17/17 Seeding session quality data...');

  const sessionExists = await getAsync(`SELECT id FROM meeting_sessions WHERE id = ?`, [sessionId]);
  if (sessionExists) {
    // 17a. session_snapshot
    const snapshotExists = await getAsync(`SELECT id FROM session_snapshot WHERE session_id = ?`, [sessionId]);
    if (!snapshotExists) {
      await runAsync(
        `INSERT INTO session_snapshot (session_id, student_grade, curriculum, location, subject, topics_covered,
          session_objective_status, overall_score_pct, overall_rating, student_engagement,
          learning_impact, parent_shareability, executive_summary)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [sessionId, 'Grade 7', 'IGCSE', 'UAE', 'Mathematics — Algebra',
         JSON.stringify(['Linear equations', 'Solving for x', 'Word problems']),
         'Partially Met — objective was stated but not fully achieved',
         62.50, 'Developing', 'Moderate — student participated when prompted',
         'Moderate — student showed understanding of basic concepts but struggled with application',
         'Partially — requires some context for parents',
         'Grade 7 IGCSE student in UAE participated in a one-to-one Algebra session. The tutor covered linear equations and solving for x. The student demonstrated basic understanding but needs additional practice with multi-step problems and word problems.']
      );
    }

    // 17b. session_analysis
    const analysisExists = await getAsync(`SELECT id FROM session_analysis WHERE session_id = ?`, [sessionId]);
    if (!analysisExists) {
      await runAsync(
        `INSERT INTO session_analysis (session_id, what_worked_well, what_needs_improvement, missed_opportunities)
         VALUES (?, ?, ?, ?)`,
        [sessionId,
         JSON.stringify([
           { text: 'Clear explanation of variable isolation', evidence: 'Tutor demonstrated step-by-step how to isolate x on both sides of the equation', impact: 'Positive' },
           { text: 'Good use of practice problems', evidence: 'Tutor provided 3 practice problems after explaining the concept', impact: 'Positive' },
           { text: 'Patient and supportive tone throughout', evidence: 'Tutor encouraged student after each correct answer and calmly corrected errors', impact: 'High' },
         ]),
         JSON.stringify([
           { text: 'Needs stronger session opening with clear objective', evidence: 'Session started without stating what would be covered', recommendation: 'Begin each session with "Today we will learn..."' },
           { text: 'More opportunities for student to explain reasoning', evidence: 'Student often gave short answers', recommendation: 'Ask "How did you get that answer?"' },
         ]),
         JSON.stringify([
           { text: 'Could have used a real-world example to increase engagement', evidence: 'Student seemed more engaged when tutor mentioned shopping example', suggested_approach: 'Use more relatable contexts like money, sports scores' },
           { text: 'Missed chance to check for deeper understanding', evidence: 'Student correctly solved "x+3=7" but may not understand why subtracting 3 works', suggested_approach: 'Ask "Why do we subtract 3 from both sides?"' },
         ])]
      );
    }

    // 17c. session_learning_impact
    const liExists = await getAsync(`SELECT id FROM session_learning_impact WHERE session_id = ?`, [sessionId]);
    if (!liExists) {
      await runAsync(
        `INSERT INTO session_learning_impact (session_id, impact_areas) VALUES (?, ?)`,
        [sessionId, JSON.stringify([
          { area: 'Concept Understanding', observation: 'Student understood the concept of isolating variables', evidence: 'Correctly solved 3 of 4 one-step equations independently', impact_level: 'Strong' },
          { area: 'Student Participation', observation: 'Student actively attempted all problems', evidence: 'Answered 8 of 12 questions when asked', impact_level: 'Moderate' },
          { area: 'Confidence', observation: 'Student showed increased confidence', evidence: 'Started hesitantly but by end was attempting problems without prompting', impact_level: 'Moderate' },
          { area: 'Accuracy', observation: 'Strong on one-step equations', evidence: '80% accuracy on simple equations', impact_level: 'Moderate' },
        ])]
      );
    }

    // 17d. session_parent_summary
    const psExists = await getAsync(`SELECT id FROM session_parent_summary WHERE session_id = ?`, [sessionId]);
    if (!psExists) {
      await runAsync(
        `INSERT INTO session_parent_summary (session_id, covered_text, participation_text, progress_text, needs_practice_text, home_support_tips)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [sessionId,
         'Today we worked on Algebra — specifically solving linear equations like "x + 5 = 12" and "2x = 10". We practiced finding the value of x by using inverse operations.',
         'Your child participated well throughout the session. They attempted every problem I presented and showed good effort even when the problems got harder.',
         'I noticed good progress with one-step equations — your child can confidently solve problems like "x + 7 = 15". Their understanding of the basic concept is solid.',
         'We need more practice with multi-step problems and especially setting up equations from word problems.',
         JSON.stringify([
           'Practice 2-3 simple equations each day — even 5 minutes helps build confidence',
           'Ask your child to explain "why" they solved a problem the way they did',
           'Use everyday situations like "If we have 10 AED and need to buy items that cost x, how many can we buy?"',
         ])]
      );
    }

    // 17e. session_coaching_feedback
    const cfExists = await getAsync(`SELECT id FROM session_coaching_feedback WHERE session_id = ?`, [sessionId]);
    if (!cfExists) {
      await runAsync(
        `INSERT INTO session_coaching_feedback (session_id, strengths, areas_to_improve) VALUES (?, ?, ?)`,
        [sessionId,
         JSON.stringify([
           { strength: 'Excellent scaffolding technique', evidence: 'When student struggled with "2x+3=11", tutor broke it down step-by-step', why_it_matters: 'This approach builds student independence' },
           { strength: 'Positive and encouraging tone', evidence: 'After every correct answer, tutor said "Great job!" or "Excellent!"', why_it_matters: 'Positive reinforcement increases student confidence' },
         ]),
         JSON.stringify([
           { area: 'Session objective should be stated upfront', evidence: 'Session began without explaining the learning goal', why_it_matters: 'Students learn better when they know what they are expected to learn', recommended_action: 'Start each session with: "Today we will learn how to..."' },
           { area: 'Increase student talk time', evidence: 'Analysis shows tutor spoke approximately 70% of the time', why_it_matters: 'Students need more opportunities to articulate their thinking', recommended_action: 'After each explanation, ask "Can you explain that back to me?"' },
         ])]
      );
    }

    // 17f. session_better_alternatives
    const baExists = await getAsync(`SELECT id FROM session_better_alternatives WHERE session_id = ?`, [sessionId]);
    if (!baExists) {
      await runAsync(
        `INSERT INTO session_better_alternatives (session_id, items) VALUES (?, ?)`,
        [sessionId, JSON.stringify([
          {
            situation: 'Student solved "x+5=12" correctly but tutor immediately moved to next problem',
            current_approach: 'Tutor said "Correct, let\'s try the next one" without probing understanding',
            better_alternative: 'Ask "How did you know to subtract 5 from both sides?"',
            purpose: 'Checks conceptual understanding rather than just procedural correctness',
          },
          {
            situation: 'Student struggled with "2x+3=11" and tutor provided the answer after 10 seconds',
            current_approach: 'Tutor: "We subtract 3 from both sides, so 2x=8, then x=4"',
            better_alternative: 'Guide step-by-step: "What operation do we need to undo first?"',
            purpose: 'Builds problem-solving independence rather than showing the answer',
          },
        ])]
      );
    }

    // 17g. session_next_plan
    const npExists = await getAsync(`SELECT id FROM session_next_plan WHERE session_id = ?`, [sessionId]);
    if (!npExists) {
      await runAsync(
        `INSERT INTO session_next_plan (session_id, segments, priority_focus, gaps_to_address) VALUES (?, ?, ?, ?)`,
        [sessionId,
         JSON.stringify([
           { segment: 'Recap / Warm-up', duration: '5 min', plan: 'Review one-step equations with 2-3 quick problems' },
           { segment: 'Concept Reinforcement', duration: '10 min', plan: 'Re-teach solving two-step equations using worked examples' },
           { segment: 'Guided Practice', duration: '15 min', plan: 'Work through 4 two-step problems together' },
           { segment: 'Independent Practice', duration: '10 min', plan: 'Student solves 2 two-step equations independently' },
           { segment: 'Word Problems Introduction', duration: '8 min', plan: 'Introduce simple word problems' },
           { segment: 'Review & Homework', duration: '2 min', plan: 'Summarize key steps, assign 3 practice problems' },
         ]),
         JSON.stringify(['Building fluency with two-step equations', 'Translating word problems into equations', 'Checking answers by substituting back']),
         JSON.stringify(['Setting up equations from word problems', 'Working with negative coefficients', 'Multi-step equations requiring two operations'])]
      );
    }

    // 17h. session_quality_flags
    const qfExists = await getAsync(`SELECT id FROM session_quality_flags WHERE session_id = ?`, [sessionId]);
    if (!qfExists) {
      await runAsync(
        `INSERT INTO session_quality_flags (session_id, flags) VALUES (?, ?)`,
        [sessionId, JSON.stringify([
          { flag: 'No session objective stated at the beginning', severity: 'Medium', evidence: 'Session transcript shows no statement of learning goals in the first 5 minutes', recommended_fix: 'Always start with "Today we will learn X"' },
          { flag: 'Insufficient wait time on difficult problems', severity: 'Low', evidence: 'On the multi-step problem, tutor provided the answer after only 10 seconds', recommended_fix: 'Allow at least 15-20 seconds of think time' },
          { flag: 'No end-of-session summary or closure', severity: 'Medium', evidence: 'Session ended abruptly', recommended_fix: 'Reserve final 3 minutes to summarize key takeaways' },
        ])]
      );
    }

    // 17i. session_final_evaluation
    const feExists = await getAsync(`SELECT id FROM session_final_evaluation WHERE session_id = ?`, [sessionId]);
    if (!feExists) {
      await runAsync(
        `INSERT INTO session_final_evaluation (session_id, overall_session_rating, teacher_performance,
          student_engagement, learning_impact, parent_communication_readiness, recommended_action, summary_narrative)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [sessionId, 'Developing (62%)', 'Developing — strong scaffolding but needs to improve session structure and closure',
         'Moderate — student participated but was not consistently engaged throughout',
         'Moderate — some progress in understanding but gaps remain in application',
         'Partially Ready — parent summary can be shared but needs additional context',
         'Minor Coaching — focus on session structure: objectives, wait time, and closure',
         'Session showed a competent tutor with good content knowledge and excellent rapport with the student. The tutor\'s scaffolding approach was effective and the student showed progress in basic equation solving. However, the session lacked structural elements: no clear objective was stated at the beginning, and there was no closure or summary at the end. Overall, a Developing session with clear potential for improvement.']
      );
    }

    // 17j. session_rubric_evaluations + session_rubric_summary
    const reExists = await getAsync(`SELECT id FROM session_rubric_evaluations WHERE session_id = ?`, [sessionId]);
    if (!reExists) {
      const allIndicators = await allAsync('SELECT indicator_id, is_gate FROM rubric_indicators ORDER BY indicator_id');
      const notMetSet = new Set(['B2.3', 'G1.3', 'F3.2', 'C3.3']);
      const partialSet = new Set(['A2.3', 'A4.1', 'B3.1', 'C1.2', 'C3.1', 'D2.2', 'D4.2', 'E1.1', 'F1.3', 'H1.2']);
      const highConfSet = new Set(['A1.1', 'A3.1', 'B2.1', 'G2.2', 'G3.1']);

      for (const ind of allIndicators) {
        let rating, confidence;
        if (notMetSet.has(ind.indicator_id)) { rating = 'Not met'; confidence = 'High'; }
        else if (partialSet.has(ind.indicator_id)) { rating = 'Partial'; confidence = 'Medium'; }
        else { rating = 'Met'; confidence = highConfSet.has(ind.indicator_id) ? 'High' : 'Medium'; }

        await runAsync(
          `INSERT INTO session_rubric_evaluations (session_id, indicator_id, rating, evidence_text, comment, evaluated_by, confidence)
           VALUES (?, ?, ?, ?, ?, 'AI', ?)`,
          [sessionId, ind.indicator_id, rating, `Evidence from transcript analysis — ${rating}`, `Indicator ${ind.indicator_id}: ${rating}`, confidence]
        );
      }

      // Compute summary
      const evalRows = await allAsync(`
        SELECT sre.rating, ri.category_id, rc.weight as cat_weight, ri.value as ind_weight, ri.is_gate
        FROM session_rubric_evaluations sre
        JOIN rubric_indicators ri ON sre.indicator_id = ri.indicator_id
        JOIN rubric_categories rc ON ri.category_id = rc.category_id
        WHERE sre.session_id = ?
      `, [sessionId]);

      const ratingScores = { 'Met': 1.0, 'Partial': 0.5, 'Not met': 0.0, 'N/A': null };
      const catScores = {};
      let allGatesPassed = true;

      for (const row of evalRows) {
        if (!catScores[row.category_id]) {
          catScores[row.category_id] = { totalScore: 0, totalWeight: 0, catWeight: row.cat_weight };
        }
        const score = ratingScores[row.rating];
        if (score !== null) {
          catScores[row.category_id].totalScore += score * (row.ind_weight || 1);
          catScores[row.category_id].totalWeight += (row.ind_weight || 1);
        }
        if (row.is_gate && row.rating !== 'Met') allGatesPassed = false;
      }

      let totalWeightedScore = 0;
      let totalWeight = 0;
      for (const [catId, data] of Object.entries(catScores)) {
        if (data.totalWeight > 0) {
          totalWeightedScore += (data.totalScore / data.totalWeight) * data.catWeight;
          totalWeight += data.catWeight;
        }
      }

      const scorePct = totalWeight > 0 ? Math.round((totalWeightedScore / totalWeight) * 10000) / 100 : 0;
      const rating = scorePct >= 80 ? 'Exemplary' : scorePct >= 60 ? 'Proficient' : scorePct >= 40 ? 'Developing' : 'Needs Improvement';

      await runAsync(
        `INSERT INTO session_rubric_summary (session_id, weighted_score_pct, gate_status, overall_rating, confidence_level)
         VALUES (?, ?, ?, ?, 'Medium — transcript-based; video/audio not available')`,
        [sessionId, scorePct, allGatesPassed ? 'all_passed' : 'gate_failed', rating]
      );
    }

    // 17k. session_metadata
    const smExists = await getAsync(`SELECT id FROM session_metadata WHERE meeting_id = ?`, [meetingId]);
    if (!smExists) {
      await runAsync(
        `INSERT INTO session_metadata (meeting_id, student_name, teacher_user_id, subject, student_grade, curriculum, topic, session_objective, session_type, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'one-to-one', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [meetingId, 'Alex Student', instructorUser?.id || null, 'Mathematics — Algebra', 'Grade 7', 'IGCSE', 'Linear Equations', 'Solve one-step and two-step linear equations']
      );
    }

    console.log(`[ComprehensiveSeeder]   ✓ 11 session quality tables seeded`);
  } else {
    console.log(`[ComprehensiveSeeder]   ⚠ No meeting session found — skipping session quality data`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 18. REMAINING TABLES (transcripts, ai_audit, archives, legacy tables, etc.)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('[ComprehensiveSeeder] 18/17 (bonus) Seeding remaining tables...');

  // Transcripts
  const { count: trCount } = await getAsync(`SELECT COUNT(*) as count FROM transcripts WHERE meeting_id = ?`, [meetingId]);
  if (trCount === 0 && meetingId) {
    await runAsync(
      `INSERT INTO transcripts (meeting_id, session_id, transcript_text, language, duration_seconds, word_count, created_at, updated_at)
       VALUES (?, ?, ?, 'en', 3600, 4500, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [meetingId, String(sessionId), 'Tutor: Today we are going to learn about solving equations.\nStudent: Okay, I am ready.\nTutor: Great! Let us start with a simple one: x + 5 = 12. What is x?\nStudent: x = 7.\nTutor: Excellent! How did you get that?\nStudent: I subtracted 5 from both sides.\nTutor: Perfect. Now let us try 2x = 10...']
    );
  }

  // AI Audit Results
  const { count: aiCount } = await getAsync(`SELECT COUNT(*) as count FROM ai_audit_results WHERE meeting_id = ?`, [meetingId]);
  if (aiCount === 0 && meetingId) {
    const auditIndicators = await allAsync('SELECT indicator_id, category_id FROM rubric_indicators LIMIT 10');
    for (const ind of auditIndicators) {
      await runAsync(
        `INSERT INTO ai_audit_results (meeting_id, session_id, category_id, indicator_id, ai_score, ai_max_score, oqi_score, talk_ratio, scored_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [meetingId, String(sessionId), ind.category_id, ind.indicator_id,
         Math.floor(Math.random() * 5) + 1, 5, Math.floor(Math.random() * 100), (Math.random() * 0.5 + 0.3).toFixed(2)]
      );
    }
  }

  // Legacy tables
  const { count: nspCount } = await getAsync(`SELECT COUNT(*) as count FROM next_session_plan WHERE meeting_id = ?`, [meetingId]);
  if (nspCount === 0 && meetingId) {
    await runAsync(
      `INSERT INTO next_session_plan (meeting_id, recap_warmup, concept_reinforcement, guided_practice, independent_practice, review_homework, priority_focus, concepts_to_revise, misconception_to_address, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [meetingId, 'Review one-step equations', 'Two-step equations with examples', 'Work through 4 problems together', 'Student solves 2 independently', 'Assign 3 practice problems', 'Building fluency with two-step equations', 'Multi-step equations', 'Setting up equations from word problems']
    );
  }

  const { count: sqrCount } = await getAsync(`SELECT COUNT(*) as count FROM session_quality_reports WHERE meeting_id = ?`, [meetingId]);
  if (sqrCount === 0 && meetingId) {
    await runAsync(
      `INSERT INTO session_quality_reports (meeting_id, overall_score, max_possible_score, percentage_score, overall_rating, student_engagement, learning_impact, parent_shareability, confidence_level, generated_by, generated_at, created_at)
       VALUES (?, 62, 100, 62.00, 'Developing', 'Moderate', 'Moderate', 'Partially', 'Medium', 'AI', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [meetingId]
    );
  }

  const { count: sliCount } = await getAsync(`SELECT COUNT(*) as count FROM student_learning_impact WHERE meeting_id = ?`, [meetingId]);
  if (sliCount === 0 && meetingId) {
    const impactAreas = ['Concept Understanding', 'Problem Solving', 'Critical Thinking'];
    for (const area of impactAreas) {
      await runAsync(
        `INSERT INTO student_learning_impact (meeting_id, impact_area, impact_level, observation, evidence, created_at)
         VALUES (?, ?, 'Moderate', 'Student showed progress in this area', 'Observed during session activities', CURRENT_TIMESTAMP)`,
        [meetingId, area]
      );
    }
  }

  const { count: tcfCount } = await getAsync(`SELECT COUNT(*) as count FROM teacher_coaching_feedback WHERE meeting_id = ?`, [meetingId]);
  if (tcfCount === 0 && meetingId) {
    await runAsync(
      `INSERT INTO teacher_coaching_feedback (meeting_id, feedback_type, area, evidence, why_it_matters, recommended_action, created_at)
       VALUES (?, 'strength', 'Scaffolding', 'Tutor broke down complex problems into manageable steps', 'Builds student independence', 'Continue using step-by-step guidance', CURRENT_TIMESTAMP)`,
      [meetingId]
    );
    await runAsync(
      `INSERT INTO teacher_coaching_feedback (meeting_id, feedback_type, area, evidence, why_it_matters, recommended_action, created_at)
       VALUES (?, 'improvement', 'Session Structure', 'Session lacked clear objective and closure', 'Students learn better with structure', 'Start with objective, end with summary', CURRENT_TIMESTAMP)`,
      [meetingId]
    );
  }

  const { count: tbaCount } = await getAsync(`SELECT COUNT(*) as count FROM teacher_better_alternatives WHERE meeting_id = ?`, [meetingId]);
  if (tbaCount === 0 && meetingId) {
    await runAsync(
      `INSERT INTO teacher_better_alternatives (meeting_id, transcript_situation, current_approach, better_alternative, purpose, created_at)
       VALUES (?, 'Student gave correct answer but tutor moved on without checking understanding', 'Tutor said "Correct, next problem"', 'Ask "How did you get that answer?" to probe understanding', 'Ensures conceptual understanding beyond procedural correctness', CURRENT_TIMESTAMP)`,
      [meetingId]
    );
  }

  // Archives
  const { count: archCount } = await getAsync(`SELECT COUNT(*) as count FROM archives WHERE meeting_id = ?`, [meetingId]);
  if (archCount === 0 && meetingId) {
    await runAsync(
      `INSERT INTO archives (meeting_id, archive_type, archive_path, archive_json, archived_by, created_at)
       VALUES (?, 'session_report', '/storage/archives/session_001.json', ?, ?, CURRENT_TIMESTAMP)`,
      [meetingId, JSON.stringify({ score: 62, rating: 'Developing', indicators: 94 }), instructorUser?.id || null]
    );
  }

  // User invitations (sample)
  const { count: invCount } = await getAsync(`SELECT COUNT(*) as count FROM user_invitations`);
  if (invCount === 0) {
    await runAsync(
      `INSERT INTO user_invitations (email, token, role_id, company_id, invited_by, status, expires_at, created_at, updated_at)
       VALUES (?, ?, (SELECT id FROM roles WHERE role_name = 'instructor'), ?, ?, 'pending', DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 7 DAY), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      ['new.instructor@example.com', crypto.randomUUID(), company?.id || null, instructorUser?.id || null]
    );
  }

  // Admin rubric indicators
  const { count: ariCount } = await getAsync(`SELECT COUNT(*) as count FROM admin_rubric_indicators`);
  if (ariCount === 0) {
    await runAsync(
      `INSERT INTO admin_rubric_indicators (category_id, name, description, weight) VALUES (?, ?, ?, ?)`,
      [1, 'Teaching Quality', 'Overall teaching quality assessment', 1.0]
    );
    await runAsync(
      `INSERT INTO admin_rubric_indicators (category_id, name, description, weight) VALUES (?, ?, ?, ?)`,
      [1, 'Student Engagement', 'Level of student participation and engagement', 1.0]
    );
  }

  // Calendar integrations, credentials, verifications (sample for instructor)
  if (instructorUser) {
    const { count: calIntCount } = await getAsync(`SELECT COUNT(*) as count FROM calendar_integrations WHERE user_id = ?`, [instructorUser.id]);
    if (calIntCount === 0) {
      await runAsync(
        `INSERT INTO calendar_integrations (user_id, platform, provider, status, created_at, updated_at)
         VALUES (?, 'zoom', 'zoom', 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [instructorUser.id]
      );
    }
  }

  console.log(`[ComprehensiveSeeder]   ✓ Remaining tables seeded`);

  // ═══════════════════════════════════════════════════════════════════════════
  // DONE
  // ═══════════════════════════════════════════════════════════════════════════
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[ComprehensiveSeeder] ✓ Complete in ${elapsed}s`);
};

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

module.exports = { seedAll, seederName };

// Standalone execution
if (require.main === module) {
  seedAll()
    .then(() => {
      console.log('\n[Seed] ✓ Comprehensive seeder completed successfully');
      process.exit(0);
    })
    .catch(err => {
      console.error('\n[Seed] ✗ Comprehensive seeder failed:', err);
      process.exit(1);
    });
}

