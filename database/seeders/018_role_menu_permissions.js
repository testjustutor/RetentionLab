/**
 * root/database/seeders/018_role_menu_permissions.js
 * Seeds default role-based menu permissions
 * Now works with role-specific menu items (menu_items have role_id)
 * This is the canonical seeder for fresh installs
 */
const { runAsync, getAsync, allAsync } = require('../seedHelpers');

const seedRoleMenuPermissions = async () => {
  console.log('[Seed] Starting role menu permissions seed...');

  // Define parent-child hierarchy for roles using menu_keys
  const ROLE_MENU_HIERARCHY = {
    super_admin: [
      ['sa-dashboard', null],
      ['sa-people', null],
        ['sa-add-user', 'sa-people'],
        ['sa-manage-users', 'sa-people'],
        ['sa-access-control', 'sa-people'],
        ['sa-manage-rubrics', 'sa-people'],
      ['sa-content', null],
        ['sa-archives', 'sa-content'],
        ['sa-media-assets', 'sa-content'],
      ['sa-settings', null],
        ['sa-bot-config', 'sa-settings'],
        ['sa-ai-providers', 'sa-settings'],
        ['sa-platforms', 'sa-settings'],
        ['sa-user-defaults', 'sa-settings'],
        ['sa-table-controls', 'sa-settings'],
      ['sa-monitoring', null],
        ['sa-server-performance', 'sa-monitoring'],
        ['sa-audit-logs', 'sa-monitoring'],
      ['sa-menu-management', null],
      ['sa-profile', null],
      ['sa-logout', null],
    ],
    admin: [
      ['admin-dashboard', null],
      ['admin-people', null],
        ['admin-users', 'admin-people'],
        ['admin-departments', 'admin-people'],
        ['admin-roles', 'admin-people'],
      ['admin-meetings', null],
        ['admin-calendar', 'admin-meetings'],
        ['admin-schedule', 'admin-meetings'],
        ['admin-live', 'admin-meetings'],
        ['admin-completed', 'admin-meetings'],
      ['admin-content', null],
        ['admin-recordings', 'admin-content'],
        ['admin-videos', 'admin-content'],
        ['admin-transcripts', 'admin-content'],
        ['admin-summaries', 'admin-content'],
      ['admin-evaluation', null],
        ['admin-rubrics', 'admin-evaluation'],
        ['admin-reviews', 'admin-evaluation'],
        ['admin-scores', 'admin-evaluation'],
        ['admin-performance', 'admin-evaluation'],
      ['admin-insights', null],
        ['admin-engagement', 'admin-insights'],
        ['admin-actions', 'admin-insights'],
        ['admin-decisions', 'admin-insights'],
        ['admin-risks', 'admin-insights'],
        ['admin-analytics', 'admin-insights'],
      ['admin-reports', null],
        ['admin-meeting-reports', 'admin-reports'],
        ['admin-evaluation-reports', 'admin-reports'],
        ['admin-team-reports', 'admin-reports'],
        ['admin-audit-reports', 'admin-reports'],
      ['admin-session-quality', null],
        ['admin-sq-hub', 'admin-session-quality'],
        ['admin-sq-rubric', 'admin-session-quality'],
        ['admin-sq-analysis', 'admin-session-quality'],
        ['admin-sq-impact', 'admin-session-quality'],
        ['admin-sq-parent-summary', 'admin-session-quality'],
        ['admin-sq-coaching', 'admin-session-quality'],
        ['admin-sq-better-alt', 'admin-session-quality'],
        ['admin-sq-next-plan', 'admin-session-quality'],
        ['admin-sq-flags', 'admin-session-quality'],
        ['admin-sq-final-eval', 'admin-session-quality'],
      ['admin-settings', null],
        ['admin-organization', 'admin-settings'],
        ['admin-notifications', 'admin-settings'],
        ['admin-meeting-rules', 'admin-settings'],
        ['admin-integrations', 'admin-settings'],
      ['admin-profile', null],
      ['admin-logout', null],
    ],
    instructor: [
      ['instructor-dashboard', null],
      ['upcoming-meetings', null],
      ['completed-meetings', null],
      ['evaluations', null],
      ['action-items', null],
      ['instructor-reports', null],
      ['instructor-profile', null],
      ['logout', null],
    ],
    reviewer: [
      ['reviewer-dashboard', null],
      ['reviewer-sessions', null],
      ['reviewer-evaluations', null],
      ['reviewer-reviews', null],
      ['reviewer-score', null],
      ['reviewer-analytics', null],
      ['reviewer-profile', null],
      ['logout', null],
    ]
  };

  // Get all roles
  const roles = await allAsync('SELECT id, role_name FROM roles WHERE role_name IN (?, ?, ?, ?, ?)',
    ['super_admin', 'admin', 'instructor', 'reviewer', 'solo_instructor']
  );

  // Get menu_items id map filtered by role
  const menuItems = await allAsync('SELECT id, menu_key, role_id FROM menu_items');

  let totalInserted = 0;

  for (const role of roles) {
    const hierarchy = ROLE_MENU_HIERARCHY[role.role_name] || [];

    if (hierarchy.length === 0) {
      console.log(`[Seed] No menu hierarchy defined for role "${role.role_name}", skipping...`);
      continue;
    }

    // Get only menu items that belong to this role (by role_id)
    const roleMenuItems = menuItems.filter(item => item.role_id === role.id);
    const menuKeyToId = {};
    for (const item of roleMenuItems) {
      menuKeyToId[item.menu_key] = item.id;
    }

    const permIdByMenuKey = {};

    // First pass: insert all items with NULL parent_id
    for (const [menuKey, parentKey] of hierarchy) {
      const menuItemId = menuKeyToId[menuKey];
      if (!menuItemId) {
        console.warn(`[Seed] Menu key "${menuKey}" not found for role "${role.role_name}" (role_id=${role.id})`);
        continue;
      }

      // Check if permission already exists for this role
      const existing = await getAsync(
        `SELECT id FROM role_menu_permissions WHERE role_id = ? AND menu_item_id = ?`,
        [role.id, menuItemId]
      );

      if (existing) {
        permIdByMenuKey[menuKey] = existing.id;
        continue;
      }

      const result = await runAsync(
        `INSERT INTO role_menu_permissions (role_id, menu_item_id, is_visible, sort_order, parent_id)
         VALUES (?, ?, 1, 0, NULL)`,
        [role.id, menuItemId]
      );
      permIdByMenuKey[menuKey] = result.lastID;
      totalInserted++;
    }

    // Second pass: update parent_id for child items
    for (const [menuKey, parentKey] of hierarchy) {
      if (!parentKey) continue;

      const childPermId = permIdByMenuKey[menuKey];
      const parentPermId = permIdByMenuKey[parentKey];

      if (childPermId && parentPermId) {
        await runAsync(
          `UPDATE role_menu_permissions SET parent_id = ? WHERE id = ?`,
          [parentPermId, childPermId]
        );
      } else {
        console.warn(`[Seed] Could not resolve parent "${parentKey}" for "${menuKey}" (role: ${role.role_name})`);
      }
    }
  }

  console.log(`[Seed] ✓ role_menu_permissions seeded successfully (${totalInserted} permissions)`);
};

module.exports = { seedRoleMenuPermissions };

// Run seeder if executed directly
if (require.main === module) {
  seedRoleMenuPermissions()
    .then(() => {
      console.log('[Seed] ✓ Role menu permissions seeder completed successfully');
      process.exit(0);
    })
    .catch(err => {
      console.error('[Seed] ✗ Role menu permissions seeder failed:', err);
      process.exit(1);
    });
}