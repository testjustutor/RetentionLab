const { db } = require('./database/db');

// Clear tables
db.run('DELETE FROM role_menu_permissions', (err) => {
  if (err) { console.error('Error clearing role_menu_permissions:', err); process.exit(1); }
  console.log('✓ Cleared role_menu_permissions');
  
  // Run seeders
  const { seedRoleMenuPermissions } = require('./database/seeders/018_role_menu_permissions');
  
  seedRoleMenuPermissions().then(() => {
    console.log('\n✓ Role menu permissions seeded');
    console.log('\n✓ All done! Logout menu should now appear for all roles.');
    process.exit(0);
  }).catch(err => {
    console.error('Seeding error:', err);
    process.exit(1);
  });
});