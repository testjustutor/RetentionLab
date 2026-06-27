/**
 * root/database/headerMenuItemsSeeder.js
 */
const { runAsync, getAsync } = require('./seedHelpers');
const { db } = require('./db');

const DEFAULT_MENU_BY_ROLE = {
  super_admin: [
    { id: 'dashboard', label: 'Dashboard', icon: 'grid', href: '/super_admin/index.html', submenu: null },
    { id: 'rubric-management', label: 'Rubric Management', icon: 'clipboard', href: '/super_admin/rubric-management.html', submenu: null },
    { id: 'sidebar-menu-management', label: 'Sidebar Menu', icon: 'list', href: '/super_admin/sidebar-menu-management.html', submenu: null },
    { id: 'operations', label: 'Operations', icon: 'settings', href: null, submenu: [
      { id: 'calendar-accounts', label: 'Calendar Accounts', href: '/super_admin/calendar-accounts.html' },
      { id: 'calendar-events', label: 'Calendar Events', href: '/super_admin/calendar-events.html' },
      { id: 'data-architecture', label: 'Data Architecture', href: '/super_admin/data-architecture.html' }
    ]},
    { id: 'content', label: 'Content Management', icon: 'folder', href: null, submenu: [
      { id: 'archives', label: 'Archives', href: '/super_admin/archives.html' },
      { id: 'assets', label: 'Assets', href: '/super_admin/assets.html' },
      { id: 'audit', label: 'Audit Log', href: '/super_admin/audit.html' }
    ]},
    { id: 'user-management', label: 'User Management', icon: 'user', href: null, submenu: [
      { id: 'add-user', label: 'Add User', href: '/super_admin/add-user.html' },
      { id: 'manage-users', label: 'Manage Users', href: '/super_admin/manage-users.html' },
      { id: 'roles-access', label: 'Roles & Access', href: '/super_admin/roles-access.html' }
    ]},
    { id: 'system', label: 'System', icon: 'shield', href: null, submenu: [
      { id: 'bot-management', label: 'Bot Management', href: '/super_admin/bot.html' },
      { id: 'settings', label: 'Settings', href: '/super_admin/settings.html' },
      { id: 'profile', label: 'Profile', href: '/super_admin/profile.html' },
      { id: 'user-settings', label: 'User Settings', href: '/super_admin/user-settings.html' }
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
      { id: 'schedule', label: 'Schedule', href: '/admin/meetings/schedule' },
      { id: 'live', label: 'Live Sessions', href: '/admin/meetings/live' },
      { id: 'completed', label: 'Completed Sessions', href: '/admin/meetings/completed' },
      { id: 'calendar', label: 'Calendar', href: '/admin/meetings/calendar' }
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
    { id: 'archives', label: 'Archives', icon: 'archive', href: '/admin/archives', submenu: null },
    { id: 'settings', label: 'Settings', icon: 'settings', href: null, submenu: [
      { id: 'organization', label: 'Organization', href: '/admin/settings/organization' },
      { id: 'notifications', label: 'Notifications', href: '/admin/settings/notifications' },
      { id: 'meeting-rules', label: 'Meeting Rules', href: '/admin/settings/meetings' },
      { id: 'integrations', label: 'Integrations', href: '/admin/settings/integrations' }
    ]},
    { id: 'profile', label: 'Profile', icon: 'user', href: '/admin/profile', submenu: null }
  ],
  reviewer: [
    { id: 'dashboard', label: 'Dashboard', icon: 'grid', href: '/reviewer/dashboard', color: 'violet', section: 'main', submenu: null },
    { id: 'reviews', label: 'Review Queue', icon: 'clipboard', href: '/reviewer/reviews', color: 'blue', section: 'reviews', submenu: null },
    { id: 'sessions', label: 'Sessions', icon: 'calendar', href: '/reviewer/sessions', color: 'emerald', section: 'sessions', submenu: null },
    { id: 'evaluations', label: 'Evaluations', icon: 'star', href: '/reviewer/evaluations', color: 'amber', section: 'evaluations', submenu: null },
    { id: 'analytics', label: 'Review Analytics', icon: 'bar-chart', href: '/reviewer/analytics', color: 'cyan', section: 'analytics', submenu: null },
    { id: 'profile', label: 'Profile', icon: 'user', href: '/reviewer/profile', color: 'slate', section: 'account', submenu: null }
  ],
  instructor: [
    { id: 'dashboard', label: 'Dashboard', icon: 'grid', href: '/instructor/index.html', submenu: null },
    { id: 'schedules', label: 'Schedules', icon: 'calendar', href: null, submenu: [
      { id: 'calendar-accounts', label: 'My Calendar', href: '/instructor/calendar-accounts.html' },
      { id: 'calendar-events', label: 'Events', href: '/instructor/calendar-events.html' }
    ]},
    { id: 'content', label: 'Archives', icon: 'folder', href: '/instructor/archives.html', submenu: null },
    { id: 'account', label: 'Account', icon: 'user', href: null, submenu: [
      { id: 'profile', label: 'Profile', href: '/instructor/profile.html' },
      { id: 'settings', label: 'Settings', href: '/instructor/settings.html' }
    ]}
  ],
  solo_instructor: [
    { id: 'dashboard', label: 'Dashboard', icon: 'grid', href: '/dashboard', color: 'violet', section: 'main', submenu: null },
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
    { id: 'profile', label: 'Profile', icon: 'user', href: '/profile', color: 'slate', section: 'account', submenu: null }
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

module.exports = { seedHeaderMenuItems };