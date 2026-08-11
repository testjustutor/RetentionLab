/**
 * root/database/seeders/001_roles.js
 * Seeds the default user roles
 */
const { runAsync } = require('../seedHelpers');

const seedRoles = async () => {
    // IMPORTANT:
    // Do NOT early-return just because roles table has some rows.
    // Your MySQL DB may contain only partial seeded data (e.g. only solo_instructor),
    // which breaks downstream seeders like superAdmin/admin.

    const rolesToSeed = [
        { role_name: 'super_admin', display_name: 'Super Admin', description: 'Full platform administrator' },
        { role_name: 'admin', display_name: 'Admin', description: 'Company-level administrator' },
        { role_name: 'instructor', display_name: 'Instructor', description: 'Instructor or tutor being reviewed' },
        { role_name: 'reviewer', display_name: 'Reviewer', description: 'Meeting reviewer' },
        { role_name: 'solo_instructor', display_name: 'Solo Instructor', description: 'Self-registered individual instructor with their own workspace' }
    ];

    for (const role of rolesToSeed) {
        await runAsync(
            `INSERT IGNORE INTO roles (role_name, role_display_name, description) VALUES (?, ?)`,
            [role.role_name, role.display_name, role.description]
        );
    }
};

module.exports = { seedRoles };

// Run seeder if executed directly
if (require.main === module) {
  seedRoles()
    .then(() => {
      console.log('[Seed] ✓ Roles seeder completed successfully');
      process.exit(0);
    })
    .catch(err => {
      console.error('[Seed] ✗ Roles seeder failed:', err);
      process.exit(1);
    });
}
