/**
 * root/database/seeders/020_update_super_admin_menu.js
 * Update super_admin menu items in existing database
 * Run: node database/seeders/020_update_super_admin_menu.js
 */
const { runAsync, allAsync } = require('../seedHelpers');

async function update() {
  console.log('[Update] Starting super_admin menu update...');

  // 1. Update labels
  console.log('[Update] Updating labels...');
  await runAsync("UPDATE menu_items SET label = 'People & Access' WHERE menu_key = 'people'");
  await runAsync("UPDATE menu_items SET label = 'Access Control' WHERE menu_key = 'access-control'");
  await runAsync("UPDATE menu_items SET label = 'Permission Rubrics' WHERE menu_key = 'permission-rubrics'");
  await runAsync("UPDATE menu_items SET label = 'Media Assets' WHERE menu_key = 'media-assets'");
  await runAsync("UPDATE menu_items SET label = 'Platform Integrations' WHERE menu_key = 'platforms'");
  await runAsync("UPDATE menu_items SET label = 'User Defaults' WHERE menu_key = 'user-defaults'");
  await runAsync("UPDATE menu_items SET label = 'Audit Logs' WHERE menu_key = 'audit-logs'");

  // 2. Fix route_path values to include .html extensions
  console.log('[Update] Fixing route paths with .html extensions...');
  await runAsync("UPDATE menu_items SET route_path = '/super_admin/people/access-control.html' WHERE menu_key = 'access-control'");
  await runAsync("UPDATE menu_items SET route_path = '/super_admin/people/permission-rubrics.html' WHERE menu_key = 'permission-rubrics'");
  await runAsync("UPDATE menu_items SET route_path = '/super_admin/settings/user-defaults.html' WHERE menu_key = 'user-defaults'");
  await runAsync("UPDATE menu_items SET route_path = '/super_admin/reports/audit.html' WHERE menu_key = 'audit-logs'");
  await runAsync("UPDATE menu_items SET route_path = '/super_admin/storage/assets' WHERE menu_key = 'media-assets'");

  // 3. Also fix existing child pages that need .html
  await runAsync("UPDATE menu_items SET route_path = '/super_admin/people/add-user.html' WHERE menu_key = 'add-user' AND route_path = '/super_admin/people/add-user'");
  await runAsync("UPDATE menu_items SET route_path = '/super_admin/people/manage-users.html' WHERE menu_key = 'manage-users' AND route_path = '/super_admin/people/manage-users'");
  await runAsync("UPDATE menu_items SET route_path = '/super_admin/people/profile.html' WHERE menu_key = 'profile' AND route_path LIKE '%/people/profile'");
  await runAsync("UPDATE menu_items SET route_path = '/super_admin/people/user-settings.html' WHERE menu_key = 'user-settings' AND route_path LIKE '%/people/user-settings'");
  await runAsync("UPDATE menu_items SET route_path = '/super_admin/configuration/platforms.html' WHERE menu_key = 'platforms' AND route_path LIKE '%/configuration/platforms'");

  // 4. Remove old items from super_admin role permissions (role_id = 1)
  console.log('[Update] Removing old menu permissions for super_admin...');
  const oldItems = await allAsync(`
    SELECT rmp.id FROM role_menu_permissions rmp
    JOIN menu_items mi ON mi.id = rmp.menu_item_id
    WHERE rmp.role_id = 1 AND mi.menu_key IN (
      'roles', 'roles-access', 'rubric-management',
      'assets', 'audit', 'user-settings'
    )
  `);
  
  for (const item of oldItems) {
    await runAsync('DELETE FROM role_menu_permissions WHERE id = ?', [item.id]);
  }
  console.log(`[Update] Removed ${oldItems.length} old menu items from super_admin`);

  console.log('[Update] ✓ Super admin menu updated successfully');
  process.exit(0);
}

update().catch(e => { console.error(e); process.exit(1); });