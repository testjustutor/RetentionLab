/**
 * root/database/seeders/017_menu_items.js
 * Seeds menu items for the sidebar navigation system
 * Each menu item is now role-specific (has role_id)
 * This is the canonical seeder for fresh installs
 */
const { runAsync, getAsync } = require('../seedHelpers');

const MENU_ITEMS = [
  // ========== Super Admin (role_id = 1) ==========
  { menu_key: 'sa-dashboard', label: 'Dashboard', icon: 'grid', route_path: '/super_admin/dashboard/index', parent_id: null, sort_order: 1, role_id: 1 },
  { menu_key: 'sa-people', label: 'People & Access', icon: 'users', route_path: null, parent_id: null, sort_order: 2, role_id: 1,
    children: [
      { menu_key: 'sa-add-user', label: 'Add User', icon: null, route_path: '/super_admin/people/add-user', parent_id: 'sa-people', sort_order: 1, role_id: 1 },
      { menu_key: 'sa-manage-users', label: 'Manage Users', icon: null, route_path: '/super_admin/people/manage-users', parent_id: 'sa-people', sort_order: 2, role_id: 1 },
      { menu_key: 'sa-access-control', label: 'Access Control', icon: null, route_path: '/super_admin/people/access-control', parent_id: 'sa-people', sort_order: 3, role_id: 1 },
      { menu_key: 'sa-manage-rubrics', label: 'Manage Rubrics', icon: null, route_path: '/super_admin/people/manage-rubrics', parent_id: 'sa-people', sort_order: 4, role_id: 1 }
    ]
  },
  { menu_key: 'sa-content', label: 'Content', icon: 'folder', route_path: null, parent_id: null, sort_order: 3, role_id: 1,
    children: [
      { menu_key: 'sa-archives', label: 'Archives', icon: null, route_path: '/super_admin/content/archives', parent_id: 'sa-content', sort_order: 1, role_id: 1 },
      { menu_key: 'sa-media-assets', label: 'Media Assets', icon: null, route_path: '/super_admin/content/assets', parent_id: 'sa-content', sort_order: 2, role_id: 1 }
    ]
  },
  { menu_key: 'sa-settings', label: 'Settings', icon: 'settings', route_path: null, parent_id: null, sort_order: 4, role_id: 1,
    children: [
      { menu_key: 'sa-bot-config', label: 'Bot Configuration', icon: null, route_path: '/super_admin/settings/bot-configuration', parent_id: 'sa-settings', sort_order: 1, role_id: 1 },
      { menu_key: 'sa-ai-providers', label: 'AI Providers', icon: null, route_path: '/super_admin/settings/ai-providers', parent_id: 'sa-settings', sort_order: 2, role_id: 1 },
      { menu_key: 'sa-platforms', label: 'Platform Integrations', icon: null, route_path: '/super_admin/settings/platforms', parent_id: 'sa-settings', sort_order: 3, role_id: 1 },
      { menu_key: 'sa-user-defaults', label: 'User Defaults', icon: null, route_path: '/super_admin/settings/user-defaults', parent_id: 'sa-settings', sort_order: 4, role_id: 1 },
      { menu_key: 'sa-table-controls', label: 'Table Controls', icon: null, route_path: '/super_admin/settings/table-controls', parent_id: 'sa-settings', sort_order: 5, role_id: 1 },
      { menu_key: 'sa-video-processing', label: 'Video Processing', icon: null, route_path: '/super_admin/settings/video-processing', parent_id: 'sa-settings', sort_order: 6, role_id: 1 }
    ]  
  },
  { menu_key: 'sa-monitoring', label: 'Monitoring', icon: 'activity', route_path: null, parent_id: null, sort_order: 5, role_id: 1,
    children: [
      { menu_key: 'sa-server-performance', label: 'Server Performance', icon: null, route_path: '/super_admin/monitoring/server', parent_id: 'sa-monitoring', sort_order: 1, role_id: 1 },
      { menu_key: 'sa-audit-logs', label: 'Audit Logs', icon: null, route_path: '/super_admin/monitoring/audit', parent_id: 'sa-monitoring', sort_order: 2, role_id: 1 }
    ]
  },
  { menu_key: 'sa-reports', label: 'Reports', icon: 'bar-chart', route_path: null, parent_id: null, sort_order: 6, role_id: 1,
    children: [
      { menu_key: 'sa-meeting-ai-evaluation', label: 'Meeting AI Evaluation', icon: null, route_path: '/super_admin/reports/meeting-ai-evaluation-report', parent_id: 'sa-reports', sort_order: 1, role_id: 1 }
    ]
  },
  { menu_key: 'sa-menu-management', label: 'Manage Menu', icon: 'menu', route_path: '/super_admin/settings/sidebar-menu-management', parent_id: null, sort_order: 7, role_id: 1 },
  { menu_key: 'sa-profile', label: 'Profile', icon: 'user', route_path: '/super_admin/people/profile', parent_id: null, sort_order: 8, role_id: 1 },
  { menu_key: 'sa-logout', label: 'Logout', icon: 'log-out', route_path: '/logout', parent_id: null, sort_order: 999, role_id: 1 },

  // ========== Admin (role_id = 2) ==========
  { menu_key: 'admin-dashboard', label: 'Dashboard', icon: 'grid', route_path: '/admin', parent_id: null, sort_order: 1, role_id: 2 },
  { menu_key: 'admin-people', label: 'People', icon: 'users', route_path: null, parent_id: null, sort_order: 2, role_id: 2,
    children: [
      { menu_key: 'admin-users', label: 'Users', icon: null, route_path: '/admin/people/users', parent_id: 'admin-people', sort_order: 1, role_id: 2 },
      { menu_key: 'admin-departments', label: 'Departments', icon: null, route_path: '/admin/people/departments', parent_id: 'admin-people', sort_order: 2, role_id: 2 },
      { menu_key: 'admin-roles', label: 'Roles', icon: null, route_path: '/admin/people/roles', parent_id: 'admin-people', sort_order: 3, role_id: 2 }
    ]
  },
  { menu_key: 'admin-meetings', label: 'Meetings', icon: 'calendar', route_path: null, parent_id: null, sort_order: 10, role_id: 2,
    children: [
      { menu_key: 'admin-calendar', label: 'Calendar', icon: null, route_path: '/admin/meetings/calendar', parent_id: 'admin-meetings', sort_order: 1, role_id: 2 },
      { menu_key: 'admin-schedule', label: 'Schedule', icon: null, route_path: '/admin/meetings/schedule', parent_id: 'admin-meetings', sort_order: 2, role_id: 2 },
      { menu_key: 'admin-live', label: 'Live Meetings', icon: null, route_path: '/admin/meetings/live', parent_id: 'admin-meetings', sort_order: 3, role_id: 2 },
      { menu_key: 'admin-completed', label: 'Completed', icon: null, route_path: '/admin/meetings/completed', parent_id: 'admin-meetings', sort_order: 4, role_id: 2 }
    ]
  },
  { menu_key: 'admin-content', label: 'Content', icon: 'folder', route_path: null, parent_id: null, sort_order: 20, role_id: 2,
    children: [
      { menu_key: 'admin-recordings', label: 'Recordings', icon: null, route_path: '/admin/content/recordings', parent_id: 'admin-content', sort_order: 1, role_id: 2 },
      { menu_key: 'admin-videos', label: 'Videos', icon: null, route_path: '/admin/content/videos', parent_id: 'admin-content', sort_order: 2, role_id: 2 },
      { menu_key: 'admin-transcripts', label: 'Transcripts', icon: null, route_path: '/admin/content/transcripts', parent_id: 'admin-content', sort_order: 3, role_id: 2 },
      { menu_key: 'admin-summaries', label: 'Summaries', icon: null, route_path: '/admin/content/summaries', parent_id: 'admin-content', sort_order: 4, role_id: 2 }
    ]
  },
  { menu_key: 'admin-evaluation', label: 'Evaluation', icon: 'check-circle', route_path: null, parent_id: null, sort_order: 30, role_id: 2,
    children: [
      { menu_key: 'admin-rubrics', label: 'Rubrics', icon: null, route_path: '/admin/evaluation/rubrics', parent_id: 'admin-evaluation', sort_order: 1, role_id: 2 },
      { menu_key: 'admin-reviews', label: 'Reviews', icon: null, route_path: '/admin/evaluation/reviews', parent_id: 'admin-evaluation', sort_order: 2, role_id: 2 },
      { menu_key: 'admin-scores', label: 'Scores', icon: null, route_path: '/admin/evaluation/scores', parent_id: 'admin-evaluation', sort_order: 3, role_id: 2 },
      { menu_key: 'admin-performance', label: 'Performance', icon: null, route_path: '/admin/evaluation/performance', parent_id: 'admin-evaluation', sort_order: 4, role_id: 2 }
    ]
  },
  { menu_key: 'admin-insights', label: 'Insights', icon: 'lightbulb', route_path: null, parent_id: null, sort_order: 40, role_id: 2,
    children: [
      { menu_key: 'admin-engagement', label: 'Engagement', icon: null, route_path: '/admin/insights/engagement', parent_id: 'admin-insights', sort_order: 1, role_id: 2 },
      { menu_key: 'admin-actions', label: 'Actions', icon: null, route_path: '/admin/insights/actions', parent_id: 'admin-insights', sort_order: 2, role_id: 2 },
      { menu_key: 'admin-decisions', label: 'Decisions', icon: null, route_path: '/admin/insights/decisions', parent_id: 'admin-insights', sort_order: 3, role_id: 2 },
      { menu_key: 'admin-risks', label: 'Risks', icon: null, route_path: '/admin/insights/risks', parent_id: 'admin-insights', sort_order: 4, role_id: 2 },
      { menu_key: 'admin-analytics', label: 'Analytics', icon: null, route_path: '/admin/insights/analytics', parent_id: 'admin-insights', sort_order: 5, role_id: 2 }
    ]
  },
  { menu_key: 'admin-reports', label: 'Reports', icon: 'bar-chart', route_path: null, parent_id: null, sort_order: 50, role_id: 2,
    children: [
      { menu_key: 'admin-meeting-reports', label: 'Meeting Reports', icon: null, route_path: '/admin/reports/meetings', parent_id: 'admin-reports', sort_order: 1, role_id: 2 },
      { menu_key: 'admin-evaluation-reports', label: 'Evaluation Reports', icon: null, route_path: '/admin/reports/evaluations', parent_id: 'admin-reports', sort_order: 2, role_id: 2 },
      { menu_key: 'admin-team-reports', label: 'Team Reports', icon: null, route_path: '/admin/reports/teams', parent_id: 'admin-reports', sort_order: 3, role_id: 2 },
      { menu_key: 'admin-audit-reports', label: 'Audit Reports', icon: null, route_path: '/admin/reports/audits', parent_id: 'admin-reports', sort_order: 4, role_id: 2 }
    ]
  },
  { menu_key: 'admin-session-quality', label: 'Session Quality', icon: 'check-circle', route_path: null, parent_id: null, sort_order: 60, role_id: 2,
    children: [
      { menu_key: 'admin-sq-hub', label: 'SQ Hub', icon: null, route_path: '/admin/session-quality/index', parent_id: 'admin-session-quality', sort_order: 1, role_id: 2 },
      { menu_key: 'admin-sq-rubric', label: 'SQ Rubric', icon: null, route_path: '/admin/session-quality/rubric', parent_id: 'admin-session-quality', sort_order: 2, role_id: 2 },
      { menu_key: 'admin-sq-analysis', label: 'SQ Analysis', icon: null, route_path: '/admin/session-quality/analysis', parent_id: 'admin-session-quality', sort_order: 3, role_id: 2 },
      { menu_key: 'admin-sq-impact', label: 'SQ Impact', icon: null, route_path: '/admin/session-quality/impact', parent_id: 'admin-session-quality', sort_order: 4, role_id: 2 },
      { menu_key: 'admin-sq-parent-summary', label: 'SQ Parent Summary', icon: null, route_path: '/admin/session-quality/parent-summary', parent_id: 'admin-session-quality', sort_order: 5, role_id: 2 },
      { menu_key: 'admin-sq-coaching', label: 'SQ Coaching', icon: null, route_path: '/admin/session-quality/coaching', parent_id: 'admin-session-quality', sort_order: 6, role_id: 2 },
      { menu_key: 'admin-sq-better-alt', label: 'SQ Better Alternatives', icon: null, route_path: '/admin/session-quality/better-alternatives', parent_id: 'admin-session-quality', sort_order: 7, role_id: 2 },
      { menu_key: 'admin-sq-next-plan', label: 'SQ Next Plan', icon: null, route_path: '/admin/session-quality/next-plan', parent_id: 'admin-session-quality', sort_order: 8, role_id: 2 },
      { menu_key: 'admin-sq-flags', label: 'SQ Flags', icon: null, route_path: '/admin/session-quality/flags', parent_id: 'admin-session-quality', sort_order: 9, role_id: 2 },
      { menu_key: 'admin-sq-final-eval', label: 'SQ Final Evaluation', icon: null, route_path: '/admin/session-quality/final-eval', parent_id: 'admin-session-quality', sort_order: 10, role_id: 2 }
    ]
  },
  { menu_key: 'admin-settings', label: 'Settings', icon: 'settings', route_path: null, parent_id: null, sort_order: 70, role_id: 2,
    children: [
      { menu_key: 'admin-organization', label: 'Organization', icon: null, route_path: '/admin/settings/organization', parent_id: 'admin-settings', sort_order: 1, role_id: 2 },
      { menu_key: 'admin-notifications', label: 'Notifications', icon: null, route_path: '/admin/settings/notifications', parent_id: 'admin-settings', sort_order: 2, role_id: 2 },
      { menu_key: 'admin-meeting-rules', label: 'Meeting Rules', icon: null, route_path: '/admin/settings/meetings', parent_id: 'admin-settings', sort_order: 3, role_id: 2 },
      { menu_key: 'admin-integrations', label: 'Integrations', icon: null, route_path: '/admin/settings/integrations', parent_id: 'admin-settings', sort_order: 4, role_id: 2 }
    ]
  },
  { menu_key: 'admin-profile', label: 'Profile', icon: 'user', route_path: '/admin/profile', parent_id: null, sort_order: 90, role_id: 2 },
  { menu_key: 'admin-logout', label: 'Logout', icon: 'log-out', route_path: '/logout', parent_id: null, sort_order: 999, role_id: 2 },

  // ========== Instructor (role_id = 3) ==========
  { menu_key: 'instructor-dashboard', label: 'Dashboard', icon: 'grid', route_path: '/instructor', parent_id: null, sort_order: 1, role_id: 3 },
  { menu_key: 'upcoming-meetings', label: 'Upcoming Meetings', icon: 'calendar', route_path: '/meetings?tab=upcoming', parent_id: null, sort_order: 2, role_id: 3 },
  { menu_key: 'completed-meetings', label: 'Completed Meetings', icon: 'check', route_path: '/meetings?tab=completed', parent_id: null, sort_order: 3, role_id: 3 },
  { menu_key: 'evaluations', label: 'Evaluations', icon: 'check-circle', route_path: '/evaluations', parent_id: null, sort_order: 4, role_id: 3 },
  { menu_key: 'action-items', label: 'Action Items', icon: 'list', route_path: '/insights/action-items', parent_id: null, sort_order: 5, role_id: 3 },
  { menu_key: 'instructor-reports', label: 'Reports', icon: 'bar-chart', route_path: '/instructor/reports', parent_id: null, sort_order: 6, role_id: 3 },
  { menu_key: 'instructor-profile', label: 'Profile', icon: 'user', route_path: '/instructor/profile', parent_id: null, sort_order: 7, role_id: 3 },
  { menu_key: 'logout', label: 'Logout', icon: 'log-out', route_path: '/logout', parent_id: null, sort_order: 999, role_id: 3 },

  // ========== Reviewer (role_id = 4) ==========
  { menu_key: 'reviewer-dashboard', label: 'Dashboard', icon: 'grid', route_path: '/reviewer/dashboard', parent_id: null, sort_order: 1, role_id: 4 },
  { menu_key: 'reviewer-sessions', label: 'Sessions', icon: 'calendar', route_path: '/reviewer/sessions', parent_id: null, sort_order: 2, role_id: 4 },
  { menu_key: 'reviewer-evaluations', label: 'Evaluations', icon: 'check-circle', route_path: '/reviewer/evaluations', parent_id: null, sort_order: 3, role_id: 4 },
  { menu_key: 'reviewer-reviews', label: 'Reviews', icon: 'star', route_path: '/reviewer/reviews', parent_id: null, sort_order: 4, role_id: 4 },
  { menu_key: 'reviewer-score', label: 'Score', icon: 'bar-chart', route_path: '/reviewer/score', parent_id: null, sort_order: 5, role_id: 4 },
  { menu_key: 'reviewer-analytics', label: 'Analytics', icon: 'activity', route_path: '/reviewer/analytics', parent_id: null, sort_order: 6, role_id: 4 },
  { menu_key: 'reviewer-profile', label: 'Profile', icon: 'user', route_path: '/reviewer/profile', parent_id: null, sort_order: 7, role_id: 4 },
  { menu_key: 'logout', label: 'Logout', icon: 'log-out', route_path: '/logout', parent_id: null, sort_order: 999, role_id: 4 }
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
      sort_order: item.sort_order,
      role_id: item.role_id
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
          sort_order: child.sort_order,
          role_id: child.role_id
        });
      }
    }
  }

  // First pass: insert parent items (those with parent_id = null)
  for (const item of flatItems.filter(i => i.parent_id === null)) {
      const result = await runAsync(
      `INSERT INTO menu_items (menu_key, label, icon, route_path, parent_id, sort_order, is_active, role_id)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
      [item.menu_key, item.label, item.icon, item.route_path, null, item.sort_order, item.role_id]
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
      `INSERT INTO menu_items (menu_key, label, icon, route_path, parent_id, sort_order, is_active, role_id)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
      [item.menu_key, item.label, item.icon, item.route_path, parentId, item.sort_order, item.role_id]
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