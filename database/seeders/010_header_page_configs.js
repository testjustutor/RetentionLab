/**
 * root/database/seeders/010_header_page_configs.js
 * Seeds header page configurations
 */
const { runAsync, getAsync } = require('../seedHelpers');
const { db } = require('../db');

const DEFAULT_PAGES = {
  // Main pages
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

  // Super Admin pages
  addUser:          { title: 'Add User',           description: 'Create new users and assign roles.',                         roleTitle: 'Super Admin', showStats: false, buttons: [] },
  manageUsers:      { title: 'Manage Users',       description: 'View, update, and delete user accounts.',                   roleTitle: 'Super Admin', showStats: false, buttons: [] },
  accessControl:    { title: 'Access Control',      description: 'Define and manage user roles and permissions.',             roleTitle: 'Super Admin', showStats: false, buttons: [] },
  rolesAccess:      { title: 'Roles & Access',      description: 'Define and manage user roles and permissions.',             roleTitle: 'Super Admin', showStats: false, buttons: [] },
  userSettings:     { title: 'User Settings',      description: 'Configure global user-related settings.',                  roleTitle: 'Super Admin', showStats: false, buttons: [] },
  userDefaults:     { title: 'User Defaults',      description: 'Configure default settings applied to new user accounts.', roleTitle: 'Super Admin', showStats: false, buttons: [] },
  rubricManagement: { title: 'Rubric Management',   description: 'Create, manage, and assign rubric categories and indicators.', roleTitle: 'Super Admin', showStats: false, buttons: [] },
  manageRubrics:    { title: 'Manage Rubrics',      description: 'Create, manage, and assign rubric categories and indicators.', roleTitle: 'Super Admin', showStats: false, buttons: [] },
  sidebarMenuManagement: { title: 'Sidebar Menu Management', description: 'Create, edit, and delete sidebar menu items for all roles.', roleTitle: 'Super Admin', showStats: false, buttons: [] },
  server:           { title: 'Server Performance', description: 'Monitor server CPU, memory, storage, and database metrics.', roleTitle: 'Super Admin', showStats: false, buttons: [] },
  headerManagement: { title: 'Header Management', description: 'Manage header page configurations for all roles.', roleTitle: 'Super Admin', showStats: false, buttons: [] },
  botConfiguration: { title: 'Bot Configuration',  description: 'Configure default bot behavior, join rules, and recording settings.', roleTitle: 'Super Admin', showStats: false, buttons: [] },
  aiProviders:      { title: 'AI Providers',       description: 'Manage connected AI provider credentials and model settings.', roleTitle: 'Super Admin', showStats: false, buttons: [] },
  platforms:        { title: 'Platform Integrations', description: 'Configure connected meeting and calendar platform integrations.', roleTitle: 'Super Admin', showStats: false, buttons: [] },
  tableControls:    { title: 'Table Controls',     description: 'Configure default table columns, filters, and pagination behavior.', roleTitle: 'Super Admin', showStats: false, buttons: [] },
  videoProcessing:  { title: 'Video Processing',   description: 'Monitor and configure video ingestion and processing pipelines.', roleTitle: 'Super Admin', showStats: false, buttons: [] },

  // Session Quality pages
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

  // Content pages
  contentAssets: { title: 'Media Assets', description: 'View and manage audio, video, and document assets.', roleTitle: 'Admin', showStats: false, buttons: [] },
  contentRecordings: { title: 'Recordings', description: 'Browse and manage session recordings.', roleTitle: 'Admin', showStats: false, buttons: [] },
  contentSummaries: { title: 'Summaries', description: 'View AI-generated session summaries.', roleTitle: 'Admin', showStats: false, buttons: [] },
  contentTranscripts: { title: 'Transcripts', description: 'Browse and search session transcripts.', roleTitle: 'Admin', showStats: false, buttons: [] },
  contentVideos: { title: 'Videos', description: 'Browse and manage session video files.', roleTitle: 'Admin', showStats: false, buttons: [] },

  // Evaluation pages
  evaluationPerformance: { title: 'Performance', description: 'View performance metrics and evaluations.', roleTitle: 'Admin', showStats: false, buttons: [] },
  evaluationReviews: { title: 'Reviews', description: 'Manage and review session evaluations.', roleTitle: 'Admin', showStats: false, buttons: [] },
  evaluationRubrics: { title: 'Rubrics', description: 'View and manage evaluation rubrics.', roleTitle: 'Admin', showStats: false, buttons: [] },
  evaluationScores: { title: 'Scores', description: 'View session scores and grading.', roleTitle: 'Admin', showStats: false, buttons: [] },
  evaluations: { title: 'Evaluations', description: 'View and complete session evaluations.', roleTitle: 'Instructor', showStats: false, buttons: [] },

  // Insights pages
  insightsActions: { title: 'Action Items', description: 'Track and manage action items from sessions.', roleTitle: 'Admin', showStats: false, buttons: [] },
  insightsAnalytics: { title: 'Analytics', description: 'View detailed analytics and trends.', roleTitle: 'Admin', showStats: false, buttons: [] },
  insightsDecisions: { title: 'Decisions', description: 'Track decisions made during sessions.', roleTitle: 'Admin', showStats: false, buttons: [] },
  insightsEngagement: { title: 'Engagement', description: 'Monitor student engagement metrics.', roleTitle: 'Admin', showStats: false, buttons: [] },
  insightsRisks: { title: 'Risk Assessment', description: 'View and manage identified risks.', roleTitle: 'Admin', showStats: false, buttons: [] },
  actionItems: { title: 'Action Items', description: 'Track and follow up on action items from your sessions.', roleTitle: 'Instructor', showStats: false, buttons: [] },

  // Meetings pages
  meetingsCalendar: { title: 'Calendar', description: 'View and manage meeting calendar.', roleTitle: 'Admin', showStats: false, buttons: [] },
  meetingsCompleted: { title: 'Completed Meetings', description: 'Browse past completed meetings.', roleTitle: 'Admin', showStats: false, buttons: [] },
  meetingsLive: { title: 'Live Meetings', description: 'Monitor and manage live sessions.', roleTitle: 'Admin', showStats: false, buttons: [] },
  meetingsSchedule: { title: 'Schedule', description: 'Schedule and manage upcoming meetings.', roleTitle: 'Admin', showStats: false, buttons: [] },
  upcomingMeetings: { title: 'Upcoming Meetings', description: 'View meetings scheduled ahead of you.', roleTitle: 'Instructor', showStats: false, buttons: [] },
  completedMeetings: { title: 'Completed Meetings', description: 'Browse your past completed meetings.', roleTitle: 'Instructor', showStats: false, buttons: [] },

  // People pages
  peopleDepartments: { title: 'Departments', description: 'Manage departments and teams.', roleTitle: 'Admin', showStats: false, buttons: [] },
  peopleRoles: { title: 'Roles', description: 'Manage user roles and permissions.', roleTitle: 'Admin', showStats: false, buttons: [] },
  peopleUsers: { title: 'Users', description: 'Manage organization users and roles', roleTitle: 'Admin', showStats: false, buttons: [] },

  // Reports pages
  reportsAudits: { title: 'Audit Reports', description: 'View audit logs and compliance reports.', roleTitle: 'Admin', showStats: false, buttons: [] },
  reportsEvaluations: { title: 'Evaluation Reports', description: 'View evaluation and assessment reports.', roleTitle: 'Admin', showStats: false, buttons: [] },
  reportsMeetings: { title: 'Meeting Reports', description: 'View meeting analytics and reports.', roleTitle: 'Admin', showStats: false, buttons: [] },
  reportsReports: { title: 'Reports', description: 'Access all system reports and analytics.', roleTitle: 'Admin', showStats: false, buttons: [] },
  reportsSessionQuality: { title: 'Session Quality Reports', description: 'Access session quality and impact reports.', roleTitle: 'Admin', showStats: false, buttons: [] },
  reportsTeams: { title: 'Team Reports', description: 'View team performance and analytics.', roleTitle: 'Admin', showStats: false, buttons: [] },
  instructorReports: { title: 'Reports', description: 'View reports on your sessions and performance.', roleTitle: 'Instructor', showStats: false, buttons: [] },

  // Settings pages
  settingsIntegrations: { title: 'Integrations', description: 'Manage third-party integrations and APIs.', roleTitle: 'Admin', showStats: false, buttons: [] },
  settingsMeetings: { title: 'Meeting Settings', description: 'Configure meeting and session settings.', roleTitle: 'Admin', showStats: false, buttons: [] },
  settingsNotifications: { title: 'Notifications', description: 'Manage notification preferences and settings.', roleTitle: 'Admin', showStats: false, buttons: [] },
  settingsOrganization: { title: 'Organization', description: 'Manage organization settings and branding.', roleTitle: 'Admin', showStats: false, buttons: [] },

  // Reviewer pages
  reviewerDashboard: { title: 'Reviewer Dashboard', description: 'Overview of assigned sessions and pending reviews.', roleTitle: 'Reviewer', showStats: true, buttons: [] },
  reviewerSessions: { title: 'Sessions', description: 'Browse sessions assigned to you for review.', roleTitle: 'Reviewer', showStats: false, buttons: [] },
  reviewerEvaluations: { title: 'Evaluations', description: 'Complete and manage session evaluations.', roleTitle: 'Reviewer', showStats: false, buttons: [] },
  reviewerReviews: { title: 'Reviews', description: 'View and submit your session reviews.', roleTitle: 'Reviewer', showStats: false, buttons: [] },
  reviewerScore: { title: 'Score', description: 'View and assign scores for reviewed sessions.', roleTitle: 'Reviewer', showStats: false, buttons: [] },
  reviewerAnalytics: { title: 'Analytics', description: 'View review trends and scoring analytics.', roleTitle: 'Reviewer', showStats: false, buttons: [] }
};

const seedHeaderPageConfigs = async () => {
    const roles = await new Promise((resolve, reject) => {
        db.all(`SELECT id, role_name FROM roles`, [], (err, rows) => {
            if (err) return reject(err);
            resolve(rows || []);
        });
    });

    for (const role of roles) {
        for (const [pageKey, pageData] of Object.entries(DEFAULT_PAGES)) {
            await runAsync(
                `INSERT IGNORE INTO header_page_configs 
                 (role_id, page_key, title, description, role_title, show_stats, buttons_json)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    role.id,
                    pageKey,
                    pageData.title,
                    pageData.description,
                    pageData.roleTitle,
                    pageData.showStats ? 1 : 0,
                    JSON.stringify(pageData.buttons)
                ]
            );
        }
    }
};

module.exports = { seedHeaderPageConfigs };

// Run seeder if executed directly
if (require.main === module) {
  seedHeaderPageConfigs()
    .then(() => {
      console.log('[Seed] ✓ Header page configs seeder completed successfully');
      process.exit(0);
    })
    .catch(err => {
      console.error('[Seed] ✗ Header page configs seeder failed:', err);
      process.exit(1);
    });
}