/**
 * root/database/seeders/017_menu_items.js
 * Seeds menu items for the sidebar navigation system
 * This is the canonical seeder for fresh installs
 */
const { runAsync, getAsync } = require('../seedHelpers');

const MENU_ITEMS = [
  // Dashboard
  { menu_key: 'dashboard', label: 'Dashboard', icon: 'grid', route_path: '/super_admin/dashboard/index', parent_id: null, sort_order: 1 },
  
  // People & Access
  { menu_key: 'people', label: 'People & Access', icon: 'users', route_path: null, parent_id: null, sort_order: 2,
    children: [
      { menu_key: 'add-user', label: 'Add User', icon: null, route_path: '/super_admin/people/add-user.html', parent_id: 'people', sort_order: 1 },
      { menu_key: 'manage-users', label: 'Manage Users', icon: null, route_path: '/super_admin/people/manage-users.html', parent_id: 'people', sort_order: 2 },
      { menu_key: 'access-control', label: 'Access Control', icon: null, route_path: '/super_admin/people/access-control.html', parent_id: 'people', sort_order: 3 },
      { menu_key: 'permission-rubrics', label: 'Permission Rubrics', icon: null, route_path: '/super_admin/people/permission-rubrics.html', parent_id: 'people', sort_order: 4 }
    ]
  },
  
  // Content
  { menu_key: 'content', label: 'Content', icon: 'folder', route_path: null, parent_id: null, sort_order: 3,
    children: [
      { menu_key: 'archives', label: 'Archives', icon: null, route_path: '/super_admin/storage/archives', parent_id: 'content', sort_order: 1 },
      { menu_key: 'media-assets', label: 'Media Assets', icon: null, route_path: '/super_admin/storage/assets', parent_id: 'content', sort_order: 2 }
    ]
  },
  
  // Settings
  { menu_key: 'settings', label: 'Settings', icon: 'settings', route_path: null, parent_id: null, sort_order: 4,
    children: [
      { menu_key: 'bot-config', label: 'Bot Configuration', icon: null, route_path: '/super_admin/configuration/bot-configuration', parent_id: 'settings', sort_order: 1 },
      { menu_key: 'ai-providers', label: 'AI Providers', icon: null, route_path: '/super_admin/configuration/ai-providers', parent_id: 'settings', sort_order: 2 },
      { menu_key: 'platforms', label: 'Platform Integrations', icon: null, route_path: '/super_admin/configuration/platforms', parent_id: 'settings', sort_order: 3 },
      { menu_key: 'user-defaults', label: 'User Defaults', icon: null, route_path: '/super_admin/settings/user-defaults', parent_id: 'settings', sort_order: 4 }
    ]
  },
  
  // Monitoring
  { menu_key: 'monitoring', label: 'Monitoring', icon: 'activity', route_path: null, parent_id: null, sort_order: 5,
    children: [
      { menu_key: 'server-performance', label: 'Server Performance', icon: null, route_path: '/super_admin/monitoring/server', parent_id: 'monitoring', sort_order: 1 },
      { menu_key: 'audit-logs', label: 'Audit Logs', icon: null, route_path: '/super_admin/reports/audit.html', parent_id: 'monitoring', sort_order: 2 }
    ]
  },

  // Sidebar Menu Management
  { menu_key: 'sidebar-menu-management', label: 'Manage Menu', icon: 'menu', route_path: '/super_admin/settings/sidebar-menu-management', parent_id: null, sort_order: 6 },

  // Profile
  { menu_key: 'profile', label: 'Profile', icon: 'user', route_path: '/super_admin/people/profile.html', parent_id: null, sort_order: 7 },

  // Logout (always visible at bottom of sidebar for all roles)
  { menu_key: 'logout', label: 'Logout', icon: 'log-out', route_path: '/logout', parent_id: null, sort_order: 999 },

  // People & Access - Admin view
  { menu_key: 'users', label: 'Users', icon: 'users', route_path: '/super_admin/people/manage-users', parent_id: null, sort_order: 10 },
  { menu_key: 'departments', label: 'Departments', icon: 'building', route_path: '/super_admin/departments/index', parent_id: null, sort_order: 11 },
  { menu_key: 'roles', label: 'Roles', icon: 'shield', route_path: '/super_admin/roles/index', parent_id: null, sort_order: 12 },

  // Meetings - Admin view
  { menu_key: 'meetings', label: 'Meetings', icon: 'calendar', route_path: '/super_admin/meetings/index', parent_id: null, sort_order: 20,
    children: [
      { menu_key: 'schedule', label: 'Schedule', icon: null, route_path: '/super_admin/meeting-schedule/index', parent_id: 'meetings', sort_order: 1 },
      { menu_key: 'live', label: 'Live Meetings', icon: null, route_path: '/super_admin/meetings/live', parent_id: 'meetings', sort_order: 2 },
      { menu_key: 'completed', label: 'Completed', icon: null, route_path: '/super_admin/meetings/completed', parent_id: 'meetings', sort_order: 3 },
      { menu_key: 'calendar', label: 'Calendar', icon: null, route_path: '/super_admin/calendar/index', parent_id: 'meetings', sort_order: 4 }
    ]
  },

  // Content - Admin view
  { menu_key: 'recordings', label: 'Recordings', icon: 'video', route_path: '/super_admin/recordings/index', parent_id: null, sort_order: 30 },
  { menu_key: 'transcripts', label: 'Transcripts', icon: 'file-text', route_path: '/super_admin/transcripts/index', parent_id: null, sort_order: 31 },
  { menu_key: 'summaries', label: 'Summaries', icon: 'summary', route_path: '/super_admin/meetings/summaries', parent_id: null, sort_order: 32 },

  // Evaluation - Admin view
  { menu_key: 'evaluation', label: 'Evaluation', icon: 'check-circle', route_path: '/super_admin/evaluation/index', parent_id: null, sort_order: 40,
    children: [
      { menu_key: 'rubrics', label: 'Rubrics', icon: null, route_path: '/super_admin/rubrics/index', parent_id: 'evaluation', sort_order: 1 },
      { menu_key: 'reviews', label: 'Reviews', icon: null, route_path: '/super_admin/reviews/index', parent_id: 'evaluation', sort_order: 2 },
      { menu_key: 'scores', label: 'Scores', icon: null, route_path: '/super_admin/scores/index', parent_id: 'evaluation', sort_order: 3 },
      { menu_key: 'performance', label: 'Performance', icon: null, route_path: '/super_admin/performance/index', parent_id: 'evaluation', sort_order: 4 }
    ]
  },

  // Insights - Admin view
  { menu_key: 'insights', label: 'Insights', icon: 'lightbulb', route_path: '/super_admin/insights/index', parent_id: null, sort_order: 50,
    children: [
      { menu_key: 'engagement', label: 'Engagement', icon: null, route_path: '/super_admin/insights/engagement', parent_id: 'insights', sort_order: 1 },
      { menu_key: 'actions', label: 'Action Items', icon: null, route_path: '/super_admin/insights/actions', parent_id: 'insights', sort_order: 2 },
      { menu_key: 'decisions', label: 'Decisions', icon: null, route_path: '/super_admin/insights/decisions', parent_id: 'insights', sort_order: 3 },
      { menu_key: 'risks', label: 'Risks', icon: null, route_path: '/super_admin/insights/risks', parent_id: 'insights', sort_order: 4 },
      { menu_key: 'analytics', label: 'Analytics', icon: null, route_path: '/super_admin/analytics/index', parent_id: 'insights', sort_order: 5 }
    ]
  },

  // Reports - Admin view
  { menu_key: 'reports', label: 'Reports', icon: 'bar-chart', route_path: '/super_admin/reports/index', parent_id: null, sort_order: 60,
    children: [
      { menu_key: 'meeting-reports', label: 'Meeting Reports', icon: null, route_path: '/super_admin/meeting-reports/index', parent_id: 'reports', sort_order: 1 },
      { menu_key: 'evaluation-reports', label: 'Evaluation Reports', icon: null, route_path: '/super_admin/evaluation-reports/index', parent_id: 'reports', sort_order: 2 },
      { menu_key: 'team-reports', label: 'Team Reports', icon: null, route_path: '/super_admin/team-reports/index', parent_id: 'reports', sort_order: 3 },
      { menu_key: 'audit-reports', label: 'Audit Reports', icon: null, route_path: '/super_admin/audit-reports/index', parent_id: 'reports', sort_order: 4 }
    ]
  },

  // Session Quality - Admin view
  { menu_key: 'session-quality', label: 'Session Quality', icon: 'quality', route_path: '/super_admin/session-quality/index', parent_id: null, sort_order: 70,
    children: [
      { menu_key: 'sq-hub', label: 'SQ Hub', icon: null, route_path: '/super_admin/session-quality/hub', parent_id: 'session-quality', sort_order: 1 },
      { menu_key: 'sq-rubric', label: 'SQ Rubric', icon: null, route_path: '/super_admin/session-quality/rubric', parent_id: 'session-quality', sort_order: 2 },
      { menu_key: 'sq-analysis', label: 'SQ Analysis', icon: null, route_path: '/super_admin/session-quality/analysis', parent_id: 'session-quality', sort_order: 3 },
      { menu_key: 'sq-impact', label: 'SQ Impact', icon: null, route_path: '/super_admin/session-quality/impact', parent_id: 'session-quality', sort_order: 4 },
      { menu_key: 'sq-parent-summary', label: 'SQ Parent Summary', icon: null, route_path: '/super_admin/session-quality/parent-summary', parent_id: 'session-quality', sort_order: 5 },
      { menu_key: 'sq-coaching', label: 'SQ Coaching', icon: null, route_path: '/super_admin/session-quality/coaching', parent_id: 'session-quality', sort_order: 6 },
      { menu_key: 'sq-better-alt', label: 'SQ Better Alternatives', icon: null, route_path: '/super_admin/session-quality/better-alternatives', parent_id: 'session-quality', sort_order: 7 },
      { menu_key: 'sq-next-plan', label: 'SQ Next Plan', icon: null, route_path: '/super_admin/session-quality/next-plan', parent_id: 'session-quality', sort_order: 8 },
      { menu_key: 'sq-flags', label: 'SQ Flags', icon: null, route_path: '/super_admin/session-quality/flags', parent_id: 'session-quality', sort_order: 9 },
      { menu_key: 'sq-final-eval', label: 'SQ Final Evaluation', icon: null, route_path: '/super_admin/session-quality/final-evaluation', parent_id: 'session-quality', sort_order: 10 }
    ]
  },

  // Settings - Admin view
  { menu_key: 'organization', label: 'Organization', icon: 'building', route_path: '/super_admin/settings/organization', parent_id: null, sort_order: 80 },
  { menu_key: 'notifications', label: 'Notifications', icon: 'bell', route_path: '/super_admin/settings/notifications', parent_id: null, sort_order: 81 },
  { menu_key: 'meeting-rules', label: 'Meeting Rules', icon: 'rules', route_path: '/super_admin/settings/meeting-rules', parent_id: null, sort_order: 82 },
  { menu_key: 'integrations', label: 'Integrations', icon: 'plug', route_path: '/super_admin/settings/integrations', parent_id: null, sort_order: 83 },

  // Meetings - Solo Instructor view
  { menu_key: 'upcoming-meetings', label: 'Upcoming Meetings', icon: 'calendar', route_path: '/instructor/meetings/upcoming', parent_id: null, sort_order: 100 },
  { menu_key: 'completed-meetings', label: 'Completed Meetings', icon: 'check', route_path: '/instructor/meetings/completed', parent_id: null, sort_order: 101 },
  { menu_key: 'evaluations', label: 'Evaluations', icon: 'check-circle', route_path: '/instructor/evaluations/index', parent_id: null, sort_order: 102 },
  { menu_key: 'action-items', label: 'Action Items', icon: 'list', route_path: '/instructor/insights/actions', parent_id: null, sort_order: 103 }
];

const seedMenuItems = async () => {
  console.log('[Seed] Starting menu items seed...');

  const { count } = await getAsync(`SELECT COUNT(*) as count FROM menu_items`);
  if (count > 0) {
    console.log(`[Seed] menu_items already seeded (${count} records found), skipping...`);
    return;
  }

  // Flatten the nested structure
  const flatItems = [];
  const idMap = {};

  for (const item of MENU_ITEMS) {
    // Add parent item
    flatItems.push({
      menu_key: item.menu_key,
      label: item.label,
      icon: item.icon,
      route_path: item.route_path,
      parent_id: null,
      sort_order: item.sort_order
    });

    // Add children if they exist
    if (item.children && Array.isArray(item.children)) {
      for (const child of item.children) {
        flatItems.push({
          menu_key: child.menu_key,
          label: child.label,
          icon: child.icon,
          route_path: child.route_path,
          parent_id: item.menu_key, // Will be resolved to ID later
          sort_order: child.sort_order
        });
      }
    }
  }

  // First pass: insert parent items (those with parent_id = null)
  for (const item of flatItems.filter(i => i.parent_id === null)) {
      const result = await runAsync(
      `INSERT INTO menu_items (menu_key, label, icon, route_path, parent_id, sort_order, is_active)
       VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [item.menu_key, item.label, item.icon, item.route_path, null, item.sort_order]
    );
    idMap[item.menu_key] = result.lastID;
  }

  // Second pass: insert child items
  for (const item of flatItems.filter(i => i.parent_id !== null)) {
    const parentId = idMap[item.parent_id];
    if (!parentId) {
      console.warn(`[Seed] Parent menu item "${item.parent_id}" not found for "${item.menu_key}"`);
      continue;
    }

    await runAsync(
      `INSERT INTO menu_items (menu_key, label, icon, route_path, parent_id, sort_order, is_active)
       VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [item.menu_key, item.label, item.icon, item.route_path, parentId, item.sort_order]
    );
  }

  console.log(`[Seed] ✓ menu_items seeded successfully (${flatItems.length} items)`);
};

module.exports = { seedMenuItems, MENU_ITEMS };

// Run seeder if executed directly
if (require.main === module) {
  seedMenuItems()
    .then(() => {
      console.log('[Seed] ✓ Menu items seeder completed successfully');
      process.exit(0);
    })
    .catch(err => {
      console.error('[Seed] ✗ Menu items seeder failed:', err);
      process.exit(1);
    });
}
