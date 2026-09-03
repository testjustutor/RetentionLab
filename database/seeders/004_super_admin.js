/**
 * root/database/seeders/004_super_admin.js
 * Seeds the super admin user
 */
const crypto = require('crypto');
const { runAsync, getAsync, hashPassword } = require('../seedHelpers');

const seedSuperAdmin = async () => {
    const email = process.env.SUPER_ADMIN_EMAIL;
    const password = process.env.SUPER_ADMIN_PASSWORD;

    const existing = await getAsync(`SELECT id FROM users WHERE email = ?`, [email]);
    if (existing) return;

    const role = await getAsync(`SELECT id FROM roles WHERE role_name = ?`, ['super_admin']);
    const password_hash = hashPassword(password);
    await runAsync(
        `INSERT INTO users (
        user_uuid,
        company_id,
        role_id,
        first_name,
        last_name,
        email,
        password_hash,
        phone,
        profile_image,
        email_verified,
        status,
        created_by,
        created_at,
        updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [
        crypto.randomUUID(),
        null,
        role?.id || null,
        'Super',
        'Admin',
        email,
        password_hash,
        null,
        null,
        1,              // email_verified = true
        'active',
        null
        ]
    );
};

module.exports = { seedSuperAdmin };

// Run seeder if executed directly
if (require.main === module) {
  seedSuperAdmin()
    .then(() => {
      console.log('[Seed] ✓ Super admin seeder completed successfully');
      process.exit(0);
    })
    .catch(err => {
      console.error('[Seed] ✗ Super admin seeder failed:', err);
      process.exit(1);
    });
}
