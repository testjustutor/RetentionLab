/**
 * root/database/seeders/019_user_menu_permissions.js
 * Seeds user-specific menu overrides (empty by default, extensible per user)
 */
const { runAsync, getAsync, allAsync } = require('../seedHelpers');

const seedUserMenuPermissions = async () => {
  console.log('[Seed] Starting user menu permissions seed...');

  const { count } = await getAsync(`SELECT COUNT(*) as count FROM user_menu_permissions`);
  if (count > 0) {
    console.log(`[Seed] user_menu_permissions already seeded (${count} records found), skipping...`);
    return;
  }

  // Get all users
  const users = await allAsync('SELECT users.id, role_name FROM users LEFT JOIN roles ON roles.id = users.role_id');
  
  // Get all menu items
  const menuItems = await allAsync('SELECT id, menu_key FROM menu_items');
  const menuItemIdMap = {};
  for (const item of menuItems) {
    menuItemIdMap[item.menu_key] = item.id;
  }

  // Seed each user with their role's default menu permissions
  // This gives each user a baseline, and admin can override specific items later
  let totalInserted = 0;

  for (const user of users) {
    // Get this user's role default permissions
    const rolePerms = await allAsync(
      `SELECT menu_item_id, is_visible, sort_order
       FROM role_menu_permissions
       WHERE role_id = (SELECT role_id FROM users WHERE id = ?)`,
      [user.id]
    );

    for (const perm of rolePerms) {
      await runAsync(
        `INSERT IGNORE INTO user_menu_permissions (user_id, menu_item_id, is_visible, sort_order)
         VALUES (?, ?, ?, ?)`,
        [user.id, perm.menu_item_id, perm.is_visible, perm.sort_order]
      );
      totalInserted++;
    }
  }

  console.log(`[Seed] ✓ user_menu_permissions seeded successfully (${totalInserted} overrides)`);
};

module.exports = { seedUserMenuPermissions };

// Run seeder if executed directly
if (require.main === module) {
  seedUserMenuPermissions()
    .then(() => {
      console.log('[Seed] ✓ User menu permissions seeder completed successfully');
      process.exit(0);
    })
    .catch(err => {
      console.error('[Seed] ✗ User menu permissions seeder failed:', err);
      process.exit(1);
    });
}
