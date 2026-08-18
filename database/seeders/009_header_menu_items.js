/**
 * root/database/seeders/009_header_menu_items.js
 * DEPRECATED - Menu items are now managed via menu_items table and role_menu_permissions
 * This seeder is kept for reference only and should not be used
 */
const { runAsync, getAsync } = require('../seedHelpers');
const { db } = require('../db');

const DEFAULT_MENU_BY_ROLE = {
  super_admin: [
    { id: 'dashboard', label: 'Dashboard', icon: 'grid', href: '/super_admin/dashboard/index', submenu: null },

    { id: 'people', label: 'People', icon: 'users', href: null, submenu: [
      { id: 'add-user', label: 'Add User', href: '/super_admin/people/add-user' },
      { id: 'manage-users', label: 'Manage Users', href: '/super_admin/people/manage-users' },
      { id: 'profile', label: 'Profile', href: '/super_admin/people/profile' },
      { id: 'user-settings', label: 'User Settings', href: '/super_admin/people/user-settings' }
    ]},

    { id: 'roles', label: 'Roles & Rubrics', icon: 'clipboard', href: null, submenu: [
      { id: 'roles-access', label: 'Roles & Access', href: '/super_admin/roles/roles-access' },
      { id: 'rubric-management', label: 'Rubric Management', href: '/super_admin/roles/rubric-management' }
    ]},

    { id: 'content', label: 'Content', icon: 'folder', href: null, submenu: [
      { id: 'archives', label: 'Archives', href: '/super_admin/content/archives' },
      { id: 'assets', label: 'Assets', href: '/super_admin/content/assets' },
      { id: 'audit', label: 'Audit Log', href: '/super_admin/monitoring/audit' }
    ]},

    { id: 'configuration', label: 'Configuration', icon: 'settings', href: null, submenu: [
      { id: 'bot-config', label: 'Bot Configuration', href: '/super_admin/settings/bot-configuration' },
      { id: 'ai-providers', label: 'AI Providers', href: '/super_admin/settings/ai-providers' },
      { id: 'platforms', label: 'Platforms', href: '/super_admin/settings/platforms' }
    ]},

    { id: 'monitoring', label: 'Monitoring', icon: 'activity', href: null, submenu: [
      { id: 'server-performance', label: 'Server Performance', href: '/super_admin/monitoring/server' }
    ]},

    { id: 'settings', label: 'Settings', icon: 'settings', href: null, submenu: [
      { id: 'sidebar-menu-management', label: 'Manage Menu', href: '/super_admin/settings/sidebar-menu-management' },
      { id: 'header-management', label: 'Header Management', href: '/super_admin/settings/header-management' }
      , { id: 'table-controls', label: 'Table Controls', href: '/super_admin/settings/table-controls' }
    ]}
  ],
  admin: [
    { id: 'dashboard', label: 'Dashboard', icon: 'grid', href: '/admin', submenu: null },
    { id: 'people', label: 'People', icon: 'users', href: null, submenu: [
      { id: 'users', label: 'Users', href: '/admin/people/users' },
      { id: 'departments', label: 'Departments', href: '/admin/people/departments' },
      { id: 'roles', label: 'Roles', href: '/admin/people/roles' }
    ]},
    { id: 'meetings', label: 'Meetings', icon: 'calendar', href: null, submenu: [
      { id: 'calendar', label: 'Calendar', href: '/admin/meetings/calendar' },
      { id: 'schedule', label: 'Schedule', href: '/admin/meetings/schedule' },
      { id: 'live', label: 'Live Sessions', href: '/admin/meetings/live' },
      { id: 'completed', label: 'Completed Sessions', href: '/admin/meetings/completed' }
    ]},
    { id: 'content', label: 'Content', icon: 'folder', href: null, submenu: [
      { id: 'recordings', label: 'Recordings', href: '/admin/content/recordings' },
      { id: 'transcripts', label: 'Transcripts', href: '/admin/content/transcripts' },
      { id: 'summaries', label: 'Summaries', href: '/admin/content/summaries' },
      { id: 'assets', label: 'Assets', href: '/admin/content/assets' }
    ]},
    { id: 'evaluation', label: 'Evaluation', icon: 'star', href: null, submenu: [
      { id: 'rubrics', label: 'Rubrics', href: '/admin/evaluation/rubrics' },
      { id: 'reviews', label: 'Reviews', href: '/admin/evaluation/reviews' },
      { id: 'scores', label: 'Session Scores', href: '/admin/evaluation/scores' },
      { id: 'performance', label: 'Performance', href: '/admin/evaluation/performance' }
    ]},
    { id: 'insights', label: 'Insights', icon: 'zap', href: null, submenu: [
      { id: 'engagement', label: 'Engagement', href: '/admin/insights/engagement' },
      { id: 'actions', label: 'Action Items', href: '/admin/insights/actions' },
      { id: 'decisions', label: 'Decisions', href: '/admin/insights/decisions' },
      { id: 'risks', label: 'Risks', href: '/admin/insights/risks' },
      { id: 'analytics', label: 'Analytics', href: '/admin/insights/analytics' }
    ]},
    { id: 'reports', label: 'Reports', icon: 'bar-chart', href: null, submenu: [
      { id: 'meeting-reports', label: 'Meeting Reports', href: '/admin/reports/meetings' },
      { id: 'evaluation-reports', label: 'Evaluation Reports', href: '/admin/reports/evaluations' },
      { id: 'team-reports', label: 'Team Reports', href: '/admin/reports/teams' },
      { id: 'audit-reports', label: 'Audit Reports', href: '/admin/reports/audits' }
    ]},
    { id: 'session-quality', label: 'Session Quality', icon: 'check-circle', href: null, submenu: [
      { id: 'sq-hub', label: 'Report Hub', href: '/admin/session-quality/index' },
      { id: 'sq-rubric', label: 'Rubric Evaluation', href: '/admin/session-quality/rubric' },
      { id: 'sq-analysis', label: 'Session Analysis', href: '/admin/session-quality/analysis' },
      { id: 'sq-impact', label: 'Learning Impact', href: '/admin/session-quality/impact' },
      { id: 'sq-parent-summary', label: 'Parent Summary', href: '/admin/session-quality/parent-summary' },
      { id: 'sq-coaching', label: 'Coaching Feedback', href: '/admin/session-quality/coaching' },
      { id: 'sq-better-alt', label: 'Better Alternatives', href: '/admin/session-quality/better-alternatives' },
      { id: 'sq-next-plan', label: 'Next Session Plan', href: '/admin/session-quality/next-plan' },
      { id: 'sq-flags', label: 'Quality Flags', href: '/admin/session-quality/flags' },
      { id: 'sq-final-eval', label: 'Final Evaluation', href: '/admin/session-quality/final-eval' }
    ]},
    { id: 'archives', label: 'Archives', icon: 'archive', href: '/admin/archives', submenu: null },
    { id: 'settings', label: 'Settings', icon: 'settings', href: null, submenu: [
      { id: 'organization', label: 'Organization', href: '/admin/settings/organization' },
      { id: 'notifications', label: 'Notifications', href: '/admin/settings/notifications' },
      { id: 'meeting-rules', label: 'Meeting Rules', href: '/admin/settings/meetings' },
      { id: 'integrations', label: 'Integrations', href: '/admin/settings/integrations' }
    ]},
    { id: 'profile', label: 'Profile', icon: 'user', href: '/admin/profile', submenu: null },
    { id: 'logout', label: 'Logout', icon: 'log-out', href: '/logout', color: 'rose', section: 'account', submenu: null }
  ],
  reviewer: [
    { id: 'dashboard', label: 'Dashboard', icon: 'grid', href: '/reviewer/dashboard', color: 'violet', section: 'main', submenu: null },
    { id: 'sessions', label: 'Sessions', icon: 'calendar', href: '/reviewer/sessions', color: 'blue', section: 'main', submenu: null },
    { id: 'reviews', label: 'Reviews', icon: 'check-circle', href: '/reviewer/reviews', color: 'emerald', section: 'main', submenu: null },
    { id: 'evaluations', label: 'Evaluations', icon: 'star', href: '/reviewer/evaluations', color: 'amber', section: 'main', submenu: null },
    { id: 'score', label: 'Score', icon: 'bar-chart', href: '/reviewer/score', color: 'indigo', section: 'main', submenu: null },
    { id: 'analytics', label: 'Analytics', icon: 'activity', href: '/reviewer/analytics', color: 'cyan', section: 'main', submenu: null },
    { id: 'profile', label: 'My Profile', icon: 'user', href: '/reviewer/profile', color: 'slate', section: 'account', submenu: null },
    { id: 'logout', label: 'Logout', icon: 'log-out', href: '/logout', color: 'rose', section: 'account', submenu: null }
  ],
  instructor: [
    { id: 'dashboard', label: 'Dashboard', icon: 'grid', href: '/instructor/index', color: 'violet', section: 'main', submenu: null },
    { id: 'meetings', label: 'Meetings', icon: 'calendar', href: '/instructor/meetings', color: 'blue', section: 'main', submenu: null },
    { id: 'evaluations', label: 'Evaluations', icon: 'star', href: '/instructor/evaluations', color: 'emerald', section: 'main', submenu: null },
    { id: 'reports', label: 'Reports', icon: 'bar-chart', href: '/instructor/reports', color: 'indigo', section: 'main', submenu: null },
    { id: 'profile', label: 'My Profile', icon: 'user', href: '/instructor/profile', color: 'slate', section: 'account', submenu: null },
    { id: 'logout', label: 'Logout', icon: 'log-out', href: '/logout', color: 'rose', section: 'account', submenu: null }
  ],
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