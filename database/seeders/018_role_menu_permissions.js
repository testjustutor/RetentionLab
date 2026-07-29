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
    { menu_key: 'profile', is_visible: true, sort_order: 7 },
    { menu_key: 'logout', is_visible: true, sort_order: 999 }
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
    { menu_key: 'integrations', is_visible: true, sort_order: 4, parent_key: 'settings' },
    { menu_key: 'logout', is_visible: true, sort_order: 999 }
  ],
  reviewer: [
    { menu_key: 'dashboard', is_visible: true, sort_order: 1 },
    { menu_key: 'reviewer-sessions', is_visible: true, sort_order: 2 },
    { menu_key: 'reviews', is_visible: true, sort_order: 3 },
    { menu_key: 'evaluations', is_visible: true, sort_order: 4 },
    { menu_key: 'reviewer-score', is_visible: true, sort_order: 5 },
    { menu_key: 'analytics', is_visible: true, sort_order: 6 },
    { menu_key: 'profile', is_visible: true, sort_order: 7 },
    { menu_key: 'logout', is_visible: true, sort_order: 999 }
  ],
  instructor: [
    { menu_key: 'dashboard', is_visible: true, sort_order: 1 },
    { menu_key: 'meetings', is_visible: true, sort_order: 2 },
    { menu_key: 'evaluations', is_visible: true, sort_order: 3 },
    { menu_key: 'reports', is_visible: true, sort_order: 4 },
    { menu_key: 'profile', is_visible: true, sort_order: 5 },
    { menu_key: 'logout', is_visible: true, sort_order: 999 }
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
    { menu_key: 'profile', is_visible: true, sort_order: 7, parent_key: null },
    { menu_key: 'logout', is_visible: true, sort_order: 999 }
  ]
};

const seedRoleMenuPermissions = async () => {
  console.log('[Seed] Starting role menu permissions seed...');

  // Define parent-child hierarchy for each role using menu_keys
  // Format: [menu_key, parent_menu_key or null for top-level]
  const ROLE_MENU_HIERARCHY = {
    super_admin: [
      ['dashboard', null],
      ['people', null],
        ['add-user', 'people'],
        ['manage-users', 'people'],
        ['access-control', 'people'],
        ['permission-rubrics', 'people'],
      ['content', null],
        ['archives', 'content'],
        ['media-assets', 'content'],
      ['settings', null],
        ['bot-config', 'settings'],
        ['ai-providers', 'settings'],
        ['platforms', 'settings'],
        ['user-defaults', 'settings'],
      ['monitoring', null],
        ['server-performance', 'monitoring'],
        ['audit-logs', 'monitoring'],
      ['sidebar-menu-management', null],
      ['profile', null],
      ['logout', null],
    ],
    admin: [
      ['dashboard', null],
      ['people', null],
        ['users', 'people'],
        ['departments', 'people'],
        ['roles', 'people'],
        ['profile', 'people'],
      ['meetings', null],
        ['schedule', 'meetings'],
        ['live', 'meetings'],
        ['completed', 'meetings'],
        ['calendar', 'meetings'],
      ['content', null],
        ['recordings', 'content'],
        ['transcripts', 'content'],
        ['summaries', 'content'],
        ['archives', 'content'],
      ['evaluation', null],
        ['rubrics', 'evaluation'],
        ['reviews', 'evaluation'],
        ['scores', 'evaluation'],
        ['performance', 'evaluation'],
      ['insights', null],
        ['engagement', 'insights'],
        ['actions', 'insights'],
        ['decisions', 'insights'],
        ['risks', 'insights'],
        ['analytics', 'insights'],
      ['reports', null],
        ['meeting-reports', 'reports'],
        ['evaluation-reports', 'reports'],
        ['team-reports', 'reports'],
        ['audit-reports', 'reports'],
      ['session-quality', null],
        ['sq-hub', 'session-quality'],
        ['sq-rubric', 'session-quality'],
        ['sq-analysis', 'session-quality'],
        ['sq-impact', 'session-quality'],
        ['sq-parent-summary', 'session-quality'],
        ['sq-coaching', 'session-quality'],
        ['sq-better-alt', 'session-quality'],
        ['sq-next-plan', 'session-quality'],
        ['sq-flags', 'session-quality'],
        ['sq-final-eval', 'session-quality'],
      ['settings', null],
        ['organization', 'settings'],
        ['notifications', 'settings'],
        ['meeting-rules', 'settings'],
        ['integrations', 'settings'],
      ['logout', null],
    ],
    instructor: [
      ['dashboard', null],
      ['meetings', null],
      ['evaluations', null],
      ['reports', null],
      ['profile', null],
      ['logout', null],
    ],
    reviewer: [
      ['dashboard', null],
      ['reviewer-sessions', null],
      ['reviews', null],
      ['evaluations', null],
      ['reviewer-score', null],
      ['analytics', null],
      ['profile', null],
      ['logout', null],
    ],
    solo_instructor: [
      ['dashboard', null],
      ['meetings', null],
        ['upcoming-meetings', 'meetings'],
        ['completed-meetings', 'meetings'],
      ['content', null],
        ['recordings', 'content'],
        ['transcripts', 'content'],
        ['summaries', 'content'],
        ['archives', 'content'],
      ['evaluations', null],
      ['insights', null],
        ['engagement', 'insights'],
        ['action-items', 'insights'],
        ['decisions', 'insights'],
        ['analytics', 'insights'],
      ['reports', null],
      ['profile', null],
      ['logout', null],
    ]
  };

  // Get unique roles (deduplicate by role_name)
  const roles = await allAsync('SELECT id, role_name FROM roles GROUP BY role_name ORDER BY MIN(id)');
  const seededRoleNames = Object.keys(ROLE_MENU_HIERARCHY);
  const seededRoleIds = roles
    .filter(role => seededRoleNames.includes(role.role_name))
    .map(role => role.id);
  if (seededRoleIds.length > 0) {
    await runAsync(
      `DELETE FROM role_menu_permissions WHERE role_id IN (${seededRoleIds.map(() => '?').join(',')})`,
      seededRoleIds
    );
  }
  // Get menu_items id map
  const menuItems = await allAsync('SELECT id, menu_key FROM menu_items');
  const menuKeyToId = {};
  for (const item of menuItems) {
    menuKeyToId[item.menu_key] = item.id;
  }
  let totalInserted = 0;
  for (const role of roles) {
    const hierarchy = ROLE_MENU_HIERARCHY[role.role_name] || [];
    const permIdByMenuKey = {};
    
    // First pass: insert all items with NULL parent_id, track insert IDs
    for (const [menuKey, parentKey] of hierarchy) {
      const menuItemId = menuKeyToId[menuKey];
      if (!menuItemId) {
        console.warn(`[Seed] Menu key "${menuKey}" not found for role "${role.role_name}"`);
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
    
    // Second pass: update parent_id for child items using the parent's role_menu_permissions id
    for (const [menuKey, parentKey] of hierarchy) {
      if (!parentKey) continue; // top-level item
      
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
module.exports = { seedRoleMenuPermissions, ROLE_MENU_DEFAULTS };
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