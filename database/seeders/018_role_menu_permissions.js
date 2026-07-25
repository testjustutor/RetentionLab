/**
 * root/database/seeders/018_role_menu_permissions.js
 * Seeds default role-based menu permissions
 * This is the canonical seeder for fresh installs
 */
const { runAsync, getAsync, allAsync } = require('../seedHelpers');
const { MENU_ITEMS } = require('./017_menu_items');

// Default menu visibility per role
// IMPORTANT: menu_key values must match exactly with menu_items.menu_key from 017_menu_items.js
const ROLE_MENU_DEFAULTS = {
  super_admin: [
    { menu_key: 'dashboard', is_visible: true, sort_order: 1 },
    { menu_key: 'people', is_visible: true, sort_order: 2 },
    { menu_key: 'add-user', is_visible: true, sort_order: 1, parent_key: 'people' },
    { menu_key: 'manage-users', is_visible: true, sort_order: 2, parent_key: 'people' },
    { menu_key: 'access-control', is_visible: true, sort_order: 3, parent_key: 'people' },
    { menu_key: 'permission-rubrics', is_visible: true, sort_order: 4, parent_key: 'people' },
    { menu_key: 'content', is_visible: true, sort_order: 3 },
    { menu_key: 'archives', is_visible: true, sort_order: 1, parent_key: 'content' },
    { menu_key: 'media-assets', is_visible: true, sort_order: 2, parent_key: 'content' },
    { menu_key: 'settings', is_visible: true, sort_order: 4 },
    { menu_key: 'bot-config', is_visible: true, sort_order: 1, parent_key: 'settings' },
    { menu_key: 'ai-providers', is_visible: true, sort_order: 2, parent_key: 'settings' },
    { menu_key: 'platforms', is_visible: true, sort_order: 3, parent_key: 'settings' },
    { menu_key: 'user-defaults', is_visible: true, sort_order: 4, parent_key: 'settings' },
    { menu_key: 'monitoring', is_visible: true, sort_order: 5 },
    { menu_key: 'server-performance', is_visible: true, sort_order: 1, parent_key: 'monitoring' },
    { menu_key: 'audit-logs', is_visible: true, sort_order: 2, parent_key: 'monitoring' },
    { menu_key: 'sidebar-menu-management', is_visible: true, sort_order: 6 },
    { menu_key: 'profile', is_visible: true, sort_order: 7 }
  ],
  admin: [
    { menu_key: 'dashboard', is_visible: true, sort_order: 1 },
    { menu_key: 'people', is_visible: true, sort_order: 2 },
    { menu_key: 'users', is_visible: true, sort_order: 1, parent_key: 'people' },
    { menu_key: 'departments', is_visible: true, sort_order: 2, parent_key: 'people' },
    { menu_key: 'roles', is_visible: true, sort_order: 3, parent_key: 'people' },
    { menu_key: 'profile', is_visible: true, sort_order: 10, parent_key: 'people' },
    { menu_key: 'meetings', is_visible: true, sort_order: 3 },
    { menu_key: 'schedule', is_visible: true, sort_order: 1, parent_key: 'meetings' },
    { menu_key: 'live', is_visible: true, sort_order: 2, parent_key: 'meetings' },
    { menu_key: 'completed', is_visible: true, sort_order: 3, parent_key: 'meetings' },
    { menu_key: 'calendar', is_visible: true, sort_order: 4, parent_key: 'meetings' },
    { menu_key: 'content', is_visible: true, sort_order: 4 },
    { menu_key: 'recordings', is_visible: true, sort_order: 1, parent_key: 'content' },
    { menu_key: 'transcripts', is_visible: true, sort_order: 2, parent_key: 'content' },
    { menu_key: 'summaries', is_visible: true, sort_order: 3, parent_key: 'content' },
    { menu_key: 'archives', is_visible: true, sort_order: 8, parent_key: 'content' },
    { menu_key: 'evaluation', is_visible: true, sort_order: 5 },
    { menu_key: 'rubrics', is_visible: true, sort_order: 1, parent_key: 'evaluation' },
    { menu_key: 'reviews', is_visible: true, sort_order: 2, parent_key: 'evaluation' },
    { menu_key: 'scores', is_visible: true, sort_order: 3, parent_key: 'evaluation' },
    { menu_key: 'performance', is_visible: true, sort_order: 4, parent_key: 'evaluation' },
    { menu_key: 'insights', is_visible: true, sort_order: 6 },
    { menu_key: 'engagement', is_visible: true, sort_order: 1, parent_key: 'insights' },
    { menu_key: 'actions', is_visible: true, sort_order: 2, parent_key: 'insights' },
    { menu_key: 'decisions', is_visible: true, sort_order: 3, parent_key: 'insights' },
    { menu_key: 'risks', is_visible: true, sort_order: 4, parent_key: 'insights' },
    { menu_key: 'analytics', is_visible: true, sort_order: 5, parent_key: 'insights' },
    { menu_key: 'reports', is_visible: true, sort_order: 7 },
    { menu_key: 'meeting-reports', is_visible: true, sort_order: 1, parent_key: 'reports' },
    { menu_key: 'evaluation-reports', is_visible: true, sort_order: 2, parent_key: 'reports' },
    { menu_key: 'team-reports', is_visible: true, sort_order: 3, parent_key: 'reports' },
    { menu_key: 'audit-reports', is_visible: true, sort_order: 4, parent_key: 'reports' },
    { menu_key: 'session-quality', is_visible: true, sort_order: 8 },
    { menu_key: 'sq-hub', is_visible: true, sort_order: 1, parent_key: 'session-quality' },
    { menu_key: 'sq-rubric', is_visible: true, sort_order: 2, parent_key: 'session-quality' },
    { menu_key: 'sq-analysis', is_visible: true, sort_order: 3, parent_key: 'session-quality' },
    { menu_key: 'sq-impact', is_visible: true, sort_order: 4, parent_key: 'session-quality' },
    { menu_key: 'sq-parent-summary', is_visible: true, sort_order: 5, parent_key: 'session-quality' },
    { menu_key: 'sq-coaching', is_visible: true, sort_order: 6, parent_key: 'session-quality' },
    { menu_key: 'sq-better-alt', is_visible: true, sort_order: 7, parent_key: 'session-quality' },
    { menu_key: 'sq-next-plan', is_visible: true, sort_order: 8, parent_key: 'session-quality' },
    { menu_key: 'sq-flags', is_visible: true, sort_order: 9, parent_key: 'session-quality' },
    { menu_key: 'sq-final-eval', is_visible: true, sort_order: 10, parent_key: 'session-quality' },
    { menu_key: 'settings', is_visible: true, sort_order: 9 },
    { menu_key: 'organization', is_visible: true, sort_order: 1, parent_key: 'settings' },
    { menu_key: 'notifications', is_visible: true, sort_order: 2, parent_key: 'settings' },
    { menu_key: 'meeting-rules', is_visible: true, sort_order: 3, parent_key: 'settings' },
    { menu_key: 'integrations', is_visible: true, sort_order: 4, parent_key: 'settings' }
  ],
  reviewer: [
    { menu_key: 'dashboard', is_visible: true, sort_order: 1 },
    { menu_key: 'profile', is_visible: true, sort_order: 2 }
  ],
  instructor: [
    { menu_key: 'dashboard', is_visible: true, sort_order: 1 },
    { menu_key: 'profile', is_visible: true, sort_order: 2 }
  ],
  solo_instructor: [
    { menu_key: 'dashboard', is_visible: true, sort_order: 1 },
    { menu_key: 'meetings', is_visible: true, sort_order: 2, parent_key: null },
    { menu_key: 'upcoming-meetings', is_visible: true, sort_order: 1, parent_key: 'meetings' },
    { menu_key: 'completed-meetings', is_visible: true, sort_order: 2, parent_key: 'meetings' },
    { menu_key: 'content', is_visible: true, sort_order: 3, parent_key: null },
    { menu_key: 'recordings', is_visible: true, sort_order: 1, parent_key: 'content' },
    { menu_key: 'transcripts', is_visible: true, sort_order: 2, parent_key: 'content' },
    { menu_key: 'summaries', is_visible: true, sort_order: 3, parent_key: 'content' },
    { menu_key: 'evaluations', is_visible: true, sort_order: 4, parent_key: null },
    { menu_key: 'insights', is_visible: true, sort_order: 5, parent_key: null },
    { menu_key: 'engagement', is_visible: true, sort_order: 1, parent_key: 'insights' },
    { menu_key: 'action-items', is_visible: true, sort_order: 2, parent_key: 'insights' },
    { menu_key: 'decisions', is_visible: true, sort_order: 3, parent_key: 'insights' },
    { menu_key: 'analytics', is_visible: true, sort_order: 4, parent_key: 'insights' },
    { menu_key: 'reports', is_visible: true, sort_order: 6, parent_key: null },
    { menu_key: 'profile', is_visible: true, sort_order: 7, parent_key: null }
  ]
};

const seedRoleMenuPermissions = async () => {
  console.log('[Seed] Starting role menu permissions seed...');

  const { count } = await getAsync(`SELECT COUNT(*) as count FROM role_menu_permissions`);
  if (count > 0) {
    console.log(`[Seed] role_menu_permissions already seeded (${count} records found), skipping...`);
    return;
  }

  // Get all roles
  const roles = await allAsync('SELECT id, role_name FROM roles');
  
  // Get all menu items
  const menuItems = await allAsync('SELECT id, menu_key FROM menu_items');
  const menuItemIdMap = {};
  for (const item of menuItems) {
    menuItemIdMap[item.menu_key] = item.id;
  }

  let totalInserted = 0;

  for (const role of roles) {
    const defaults = ROLE_MENU_DEFAULTS[role.role_name] || [];
    
    for (const perm of defaults) {
      const menuItemId = menuItemIdMap[perm.menu_key];
      if (!menuItemId) {
        console.warn(`[Seed] Menu item "${perm.menu_key}" not found for role "${role.role_name}"`);
        continue;
      }

      const parentId = perm.parent_key ? (menuItemIdMap[perm.parent_key] || null) : null;

      await runAsync(
        `INSERT IGNORE INTO role_menu_permissions (role_id, menu_item_id, is_visible, sort_order, parent_id)
         VALUES (?, ?, ?, ?, ?)`,
        [role.id, menuItemId, perm.is_visible ? 1 : 0, perm.sort_order || 0, parentId]
      );
      totalInserted++;
    }
  }

  console.log(`[Seed] ✓ role_menu_permissions seeded successfully (${totalInserted} permissions)`);
};

module.exports = { seedRoleMenuPermissions, ROLE_MENU_DEFAULTS };