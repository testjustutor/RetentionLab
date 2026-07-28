/**
 * root/database/seeders/013_user_permissions.js
 * Seeds user-specific permission overrides (beyond role defaults).
 * This allows granting/revoking individual permissions per user.
 */
const { runAsync, allAsync } = require('../seedHelpers');

const seedUserPermissions = async () => {
  console.log('[Seed] Starting user_permissions seed...');

  const { count } = await allAsync('SELECT COUNT(*) as count FROM user_permissions');
  if (count > 0) {
    console.log(`[Seed] user_permissions already seeded (${count} records found), skipping...`);
    return;
  }

  // Get all users and permissions
  const users = await allAsync('SELECT users.id, role_name FROM users LEFT JOIN roles ON roles.id = users.role_id');
  const permissions = await allAsync('SELECT id, permission_key FROM permissions');
  const permIdByKey = Object.fromEntries(permissions.map(p => [p.permission_key, p.id]));

  // Example: Grant specific users extra permissions beyond their role defaults
  // Format: { userId: [permission_keys] }
  const USER_PERMISSION_OVERRIDES = {};

  let totalGranted = 0;

  for (const user of users) {
    const overrides = USER_PERMISSION_OVERRIDES[user.id] || [];
    
    for (const permKey of overrides) {
      const permissionId = permIdByKey[permKey];
      if (!permissionId) continue;

      await runAsync(
        `INSERT IGNORE INTO user_permissions (user_id, permission_id, company_id, granted_by)
         VALUES (?, ?, NULL, NULL)`,
        [user.id, permissionId]
      );
      totalGranted++;
    }
  }

  console.log(`[Seed] ✓ user_permissions seeded successfully (${totalGranted} overrides granted)`);
};

module.exports = { seedUserPermissions };

// Run seeder if executed directly
if (require.main === module) {
  seedUserPermissions()
    .then(() => {
      console.log('[Seed] ✓ User permissions seeder completed successfully');
      process.exit(0);
    })
    .catch(err => {
      console.error('[Seed] ✗ User permissions seeder failed:', err);
      process.exit(1);
    });
}
