/**
 * root/database/seeders/009_header_menu_items.js
 * DEPRECATED - Menu items are now managed via menu_items table and role_menu_permissions
 * This seeder is kept for reference only and should not be used
 * Updated to mirror the canonical structure/labels/routes in 017_menu_items.js
 */
const { runAsync, getAsync } = require('../seedHelpers');
const { db } = require('../db');

const DEFAULT_MENU_BY_ROLE = {
  super_admin: [
    { id: 'sa-dashboard', label: 'Dashboard', icon: 'grid', href: '/super_admin/dashboard/index', submenu: null },

    { id: 'sa-people', label: 'People & Access', icon: 'users', href: null, submenu: [
      { id: 'sa-add-user', label: 'Add User', href: '/super_admin/people/add-user' },
      { id: 'sa-manage-users', label: 'Manage Users', href: '/super_admin/people/manage-users' },
      { id: 'sa-access-control', label: 'Access Control', href: '/super_admin/people/access-control' },
      { id: 'sa-manage-rubrics', label: 'Manage Rubrics', href: '/super_admin/people/manage-rubrics' }
    ]},

    { id: 'sa-content', label: 'Content', icon: 'folder', href: null, submenu: [
      { id: 'sa-archives', label: 'Archives', href: '/super_admin/content/archives' },
      { id: 'sa-media-assets', label: 'Media Assets', href: '/super_admin/content/assets' }
    ]},

    { id: 'sa-settings', label: 'Settings', icon: 'settings', href: null, submenu: [
      { id: 'sa-bot-config', label: 'Bot Configuration', href: '/super_admin/settings/bot-configuration' },
      { id: 'sa-ai-providers', label: 'AI Providers', href: '/super_admin/settings/ai-providers' },
      { id: 'sa-platforms', label: 'Platform Integrations', href: '/super_admin/settings/platforms' },
      { id: 'sa-user-defaults', label: 'User Defaults', href: '/super_admin/settings/user-defaults' },
      { id: 'sa-table-controls', label: 'Table Controls', href: '/super_admin/settings/table-controls' },
      { id: 'sa-video-processing', label: 'Video Processing', icon: 'video', href: '/super_admin/settings/video-processing' }
    ]},

    { id: 'sa-monitoring', label: 'Monitoring', icon: 'activity', href: null, submenu: [
      { id: 'sa-server-performance', label: 'Server Performance', href: '/super_admin/monitoring/server' },
      { id: 'sa-audit-logs', label: 'Audit Logs', href: '/super_admin/monitoring/audit' }
    ]},

    { id: 'sa-menu-management', label: 'Manage Menu', icon: 'menu', href: '/super_admin/settings/sidebar-menu-management', submenu: null },
    { id: 'sa-profile', label: 'Profile', icon: 'user', href: '/super_admin/people/profile', submenu: null },
    { id: 'sa-logout', label: 'Logout', icon: 'log-out', href: '/logout', submenu: null }
  ],
  admin: [
    { id: 'admin-dashboard', label: 'Dashboard', icon: 'grid', href: '/admin', submenu: null },

    { id: 'admin-people', label: 'People', icon: 'users', href: null, submenu: [
      { id: 'admin-users', label: 'Users', href: '/admin/people/users' },
      { id: 'admin-departments', label: 'Departments', href: '/admin/people/departments' },
      { id: 'admin-roles', label: 'Roles', href: '/admin/people/roles' }
    ]},

    { id: 'admin-meetings', label: 'Meetings', icon: 'calendar', href: null, submenu: [
      { id: 'admin-calendar', label: 'Calendar', href: '/admin/meetings/calendar' },
      { id: 'admin-schedule', label: 'Schedule', href: '/admin/meetings/schedule' },
      { id: 'admin-live', label: 'Live Meetings', href: '/admin/meetings/live' },
      { id: 'admin-completed', label: 'Completed', href: '/admin/meetings/completed' }
    ]},

    { id: 'admin-content', label: 'Content', icon: 'folder', href: null, submenu: [
      { id: 'admin-recordings', label: 'Recordings', href: '/admin/content/recordings' },
      { id: 'admin-videos', label: 'Videos', href: '/admin/content/videos' },
      { id: 'admin-transcripts', label: 'Transcripts', href: '/admin/content/transcripts' },
      { id: 'admin-summaries', label: 'Summaries', href: '/admin/content/summaries' }
    ]},

    { id: 'admin-evaluation', label: 'Evaluation', icon: 'check-circle', href: null, submenu: [
      { id: 'admin-rubrics', label: 'Rubrics', href: '/admin/evaluation/rubrics' },
      { id: 'admin-reviews', label: 'Reviews', href: '/admin/evaluation/reviews' },
      { id: 'admin-scores', label: 'Scores', href: '/admin/evaluation/scores' },
      { id: 'admin-performance', label: 'Performance', href: '/admin/evaluation/performance' }
    ]},

    { id: 'admin-insights', label: 'Insights', icon: 'lightbulb', href: null, submenu: [
      { id: 'admin-engagement', label: 'Engagement', href: '/admin/insights/engagement' },
      { id: 'admin-actions', label: 'Actions', href: '/admin/insights/actions' },
      { id: 'admin-decisions', label: 'Decisions', href: '/admin/insights/decisions' },
      { id: 'admin-risks', label: 'Risks', href: '/admin/insights/risks' },
      { id: 'admin-analytics', label: 'Analytics', href: '/admin/insights/analytics' }
    ]},

    { id: 'admin-reports', label: 'Reports', icon: 'bar-chart', href: null, submenu: [
      { id: 'admin-meeting-reports', label: 'Meeting Reports', href: '/admin/reports/meetings' },
      { id: 'admin-evaluation-reports', label: 'Evaluation Reports', href: '/admin/reports/evaluations' },
      { id: 'admin-team-reports', label: 'Team Reports', href: '/admin/reports/teams' },
      { id: 'admin-audit-reports', label: 'Audit Reports', href: '/admin/reports/audits' }
    ]},

    { id: 'admin-session-quality', label: 'Session Quality', icon: 'check-circle', href: null, submenu: [
      { id: 'admin-sq-hub', label: 'SQ Hub', href: '/admin/session-quality/index' },
      { id: 'admin-sq-rubric', label: 'SQ Rubric', href: '/admin/session-quality/rubric' },
      { id: 'admin-sq-analysis', label: 'SQ Analysis', href: '/admin/session-quality/analysis' },
      { id: 'admin-sq-impact', label: 'SQ Impact', href: '/admin/session-quality/impact' },
      { id: 'admin-sq-parent-summary', label: 'SQ Parent Summary', href: '/admin/session-quality/parent-summary' },
      { id: 'admin-sq-coaching', label: 'SQ Coaching', href: '/admin/session-quality/coaching' },
      { id: 'admin-sq-better-alt', label: 'SQ Better Alternatives', href: '/admin/session-quality/better-alternatives' },
      { id: 'admin-sq-next-plan', label: 'SQ Next Plan', href: '/admin/session-quality/next-plan' },
      { id: 'admin-sq-flags', label: 'SQ Flags', href: '/admin/session-quality/flags' },
      { id: 'admin-sq-final-eval', label: 'SQ Final Evaluation', href: '/admin/session-quality/final-eval' }
    ]},

    { id: 'admin-settings', label: 'Settings', icon: 'settings', href: null, submenu: [
      { id: 'admin-organization', label: 'Organization', href: '/admin/settings/organization' },
      { id: 'admin-notifications', label: 'Notifications', href: '/admin/settings/notifications' },
      { id: 'admin-meeting-rules', label: 'Meeting Rules', href: '/admin/settings/meetings' },
      { id: 'admin-integrations', label: 'Integrations', href: '/admin/settings/integrations' }
    ]},

    { id: 'admin-profile', label: 'Profile', icon: 'user', href: '/admin/profile', submenu: null },
    { id: 'admin-logout', label: 'Logout', icon: 'log-out', href: '/logout', color: 'rose', section: 'account', submenu: null }
  ],
  reviewer: [
    { id: 'reviewer-dashboard', label: 'Dashboard', icon: 'grid', href: '/reviewer/dashboard', color: 'violet', section: 'main', submenu: null },
    { id: 'reviewer-sessions', label: 'Sessions', icon: 'calendar', href: '/reviewer/sessions', color: 'blue', section: 'main', submenu: null },
    { id: 'reviewer-evaluations', label: 'Evaluations', icon: 'check-circle', href: '/reviewer/evaluations', color: 'amber', section: 'main', submenu: null },
    { id: 'reviewer-reviews', label: 'Reviews', icon: 'star', href: '/reviewer/reviews', color: 'emerald', section: 'main', submenu: null },
    { id: 'reviewer-score', label: 'Score', icon: 'bar-chart', href: '/reviewer/score', color: 'indigo', section: 'main', submenu: null },
    { id: 'reviewer-analytics', label: 'Analytics', icon: 'activity', href: '/reviewer/analytics', color: 'cyan', section: 'main', submenu: null },
    { id: 'reviewer-profile', label: 'Profile', icon: 'user', href: '/reviewer/profile', color: 'slate', section: 'account', submenu: null },
    { id: 'logout', label: 'Logout', icon: 'log-out', href: '/logout', color: 'rose', section: 'account', submenu: null }
  ],
  instructor: [
    { id: 'instructor-dashboard', label: 'Dashboard', icon: 'grid', href: '/instructor', color: 'violet', section: 'main', submenu: null },
    { id: 'upcoming-meetings', label: 'Upcoming Meetings', icon: 'calendar', href: '/meetings?tab=upcoming', color: 'blue', section: 'main', submenu: null },
    { id: 'completed-meetings', label: 'Completed Meetings', icon: 'check', href: '/meetings?tab=completed', color: 'blue', section: 'main', submenu: null },
    { id: 'evaluations', label: 'Evaluations', icon: 'check-circle', href: '/evaluations', color: 'emerald', section: 'main', submenu: null },
    { id: 'action-items', label: 'Action Items', icon: 'list', href: '/insights/action-items', color: 'cyan', section: 'main', submenu: null },
    { id: 'instructor-reports', label: 'Reports', icon: 'bar-chart', href: '/instructor/reports', color: 'indigo', section: 'main', submenu: null },
    { id: 'instructor-profile', label: 'Profile', icon: 'user', href: '/instructor/profile', color: 'slate', section: 'account', submenu: null },
    { id: 'logout', label: 'Logout', icon: 'log-out', href: '/logout', color: 'rose', section: 'account', submenu: null }
  ],
  // NOTE: solo_instructor has no role_id in 017_menu_items.js and is left as-is.
  // Confirm whether this role still exists before relying on this block.
  solo_instructor: [
    { id: 'dashboard', label: 'Dashboard', icon: 'grid', href: '/instructor/', color: 'violet', section: 'main', submenu: null },
    { id: 'meetings', label: 'Meetings', icon: 'calendar', href: '/meetings', color: 'emerald', section: 'meetings', submenu: [
      { id: 'upcoming-meetings', label: 'Upcoming Meetings', href: '/meetings', color: 'emerald', section: 'meetings' },
      { id: 'completed-meetings', label: 'Completed Meetings', href: '/meetings?tab=completed', color: 'emerald', section: 'meetings' }
    ]},
    { id: 'content', label: 'Content', icon: 'folder', href: null, color: 'amber', section: 'content', submenu: [
      { id: 'recordings', label: 'Recordings', href: '/content/recordings', color: 'amber', section: 'content' },
      { id: 'transcripts', label: 'Transcripts', href: '/content/transcripts', color: 'amber', section: 'content' },
      { id: 'summaries', label: 'Summaries', href: '/content/summaries', color: 'amber', section: 'content' }
    ]},
    { id: 'evaluations', label: 'Evaluations', icon: 'star', href: '/evaluations', color: 'rose', section: 'evaluation', submenu: null },
    { id: 'insights', label: 'Insights', icon: 'zap', href: null, color: 'cyan', section: 'insights', submenu: [
      { id: 'engagement', label: 'Engagement', href: '/insights/engagement', color: 'cyan', section: 'insights' },
      { id: 'action-items', label: 'Action Items', href: '/insights/action-items', color: 'cyan', section: 'insights' },
      { id: 'decisions', label: 'Decisions', href: '/insights/decisions', color: 'cyan', section: 'insights' },
      { id: 'analytics', label: 'Analytics', href: '/insights/analytics', color: 'cyan', section: 'insights' }
    ]},
    { id: 'reports', label: 'Reports', icon: 'bar-chart', href: '/reports', color: 'indigo', section: 'reports', submenu: null },
    { id: 'profile', label: 'Profile', icon: 'user', href: '/profile', color: 'slate', section: 'account', submenu: null },
    { id: 'logout', label: 'Logout', icon: 'log-out', href: '/logout', color: 'rose', section: 'account', submenu: null }
  ]
};

const seedHeaderMenuItems = async () => {
    const roles = await new Promise((resolve, reject) => {
        db.all(`SELECT id, role_name FROM roles`, [], (err, rows) => {
            if (err) return reject(err);
            resolve(rows || []);
        });
    });

    for (const role of roles) {
        const menuItems = DEFAULT_MENU_BY_ROLE[role.role_name] || [];
        if (!DEFAULT_MENU_BY_ROLE[role.role_name]) {
            console.warn(`[Seed] headerMenuItemsSeeder: no menu defined for role "${role.role_name}", skipping.`);
        }

        // Delete existing menu items for this role to ensure clean update
        await runAsync(`DELETE FROM header_menu_items WHERE role_id = ?`, [role.id]);

        let displayOrder = 0;
        for (const item of menuItems) {
            await runAsync(
                `INSERT INTO header_menu_items 
                 (role_id, menu_id, parent_id, label, icon, href, display_order, is_active, section, color)
                 VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
                [
                    role.id,
                    item.id,
                    null,
                    item.label,
                    item.icon || null,
                    item.href || null,
                    displayOrder++,
                    item.section || 'main',
                    item.color || 'violet'
                ]
            );

            // Insert submenu items
            if (item.submenu && Array.isArray(item.submenu)) {
                let subOrder = 0;
                for (const subItem of item.submenu) {
                    await runAsync(
                        `INSERT INTO header_menu_items 
                         (role_id, menu_id, parent_id, label, icon, href, display_order, is_active, section, color)
                         VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
                        [
                            role.id,
                            subItem.id,
                            item.id,
                            subItem.label,
                            null,
                            subItem.href || null,
                            subOrder++,
                            subItem.section || 'main',
                            subItem.color || 'violet'
                        ]
                    );
                }
            }
        }
    }
};

module.exports = { seedHeaderMenuItems, DEFAULT_MENU_BY_ROLE };

// Run seeder if executed directly
if (require.main === module) {
  seedHeaderMenuItems()
    .then(() => {
      console.log('[Seed] ✓ Header menu items seeder completed successfully');
      process.exit(0);
    })
    .catch(err => {
      console.error('[Seed] ✗ Header menu items seeder failed:', err);
      process.exit(1);
    });
}