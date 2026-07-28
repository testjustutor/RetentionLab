const { runAsync, getAsync, allAsync } = require('./database/seedHelpers');

const seed = async () => {
  console.log('Seeding role menu permissions...');
  
  // Get all roles
  const roles = await allAsync('SELECT id, role_name FROM roles');
  console.log('Found roles:', roles.map(r => r.role_name));
  
  // Get all menu items
  const menuItems = await allAsync('SELECT id, menu_id FROM menu_items');
  const menuItemMap = {};
  menuItems.forEach(m => { menuItemMap[m.menu_id] = m.id; });
  console.log('Found menu items:', Object.keys(menuItemMap));
  
  // Clear existing permissions
  await runAsync('DELETE FROM role_menu_permissions');
  console.log('Cleared existing permissions');
  
  // Insert permissions for each role
  const rolePermissions = {
    super_admin: ['dashboard', 'people', 'add-user', 'manage-users', 'access-control', 'permission-rubrics', 'content', 'archives', 'media-assets', 'settings', 'bot-config', 'ai-providers', 'platforms', 'user-defaults', 'monitoring', 'server-performance', 'audit-logs', 'sidebar-menu-management', 'profile'],
    admin: ['dashboard', 'people', 'users', 'departments', 'roles', 'profile', 'meetings', 'schedule', 'live', 'completed', 'calendar', 'content', 'recordings', 'transcripts', 'summaries', 'archives', 'evaluation', 'rubrics', 'reviews', 'scores', 'performance', 'insights', 'engagement', 'actions', 'decisions', 'risks', 'analytics', 'reports', 'meeting-reports', 'evaluation-reports', 'team-reports', 'audit-reports', 'session-quality', 'sq-hub', 'sq-rubric', 'sq-analysis', 'sq-impact', 'sq-parent-summary', 'sq-coaching', 'sq-better-alt', 'sq-next-plan', 'sq-flags', 'sq-final-eval', 'settings', 'organization', 'notifications', 'meeting-rules', 'integrations'],
    reviewer: ['dashboard', 'profile'],
    instructor: ['dashboard', 'profile'],
    solo_instructor: ['dashboard', 'meetings', 'upcoming-meetings', 'completed-meetings', 'content', 'recordings', 'transcripts', 'summaries', 'evaluations', 'insights', 'engagement', 'action-items', 'decisions', 'analytics', 'reports', 'profile']
  };
  
  let totalInserted = 0;
  
  for (const role of roles) {
    const menuKeys = rolePermissions[role.role_name] || [];
    console.log(`\nSeeding ${role.role_name} with ${menuKeys.length} menu items...`);
    
    for (const menuKey of menuKeys) {
      const menuItemId = menuItemMap[menuKey];
      if (!menuItemId) {
        console.warn(`  Warning: Menu item "${menuKey}" not found`);
        continue;
      }
      
      await runAsync(
        'INSERT INTO role_menu_permissions (role_id, menu_item_id, is_visible, sort_order, parent_id) VALUES (?, ?, 1, 0, NULL)',
        [role.id, menuItemId]
      );
      totalInserted++;
    }
  }
  
  console.log(`\n✓ Seeded ${totalInserted} role menu permissions`);
  
  // Verify
  const count = await getAsync('SELECT COUNT(*) as count FROM role_menu_permissions');
  console.log('Total permissions in DB:', count.count);
  
  process.exit(0);
};

seed().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});