/**
 * root/database/seeders/005_admin_user.js
 * Seeds the default admin user
 */
const crypto = require('crypto');
const { runAsync, getAsync } = require('../seedHelpers');

const hashPassword = (password, salt = crypto.randomBytes(16).toString('hex')) => {
    const derived = crypto.scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${derived}`;
};

const seedAdminUser = async () => {
    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;
    const companyCode = process.env.ADMIN_COMPANY_CODE;

    const existing = await getAsync(`SELECT id FROM users WHERE email = ?`, [email]);
    if (existing) return;

    const company = await getAsync(`SELECT id FROM companies WHERE company_code = ?`, [companyCode]);
    const role = await getAsync(`SELECT id FROM roles WHERE role_name = ?`, ['admin']);
    if (!company || !role) return;

    const password_hash = hashPassword(password);
    await runAsync(
        `INSERT INTO users (
            user_uuid, company_id, role_id, first_name, last_name, email,
            password_hash, phone, profile_image, status,
            email_verified, email_verified_at,
            created_by, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [
            crypto.randomUUID(),
            company.id,
            role.id,
            'Demo',
            'Admin',
            email,
            password_hash,
            null,
            null,
            'active',
            1,
            new Date().toISOString(),
            null
        ]
    );
};

module.exports = { seedAdminUser };

// Run seeder if executed directly
if (require.main === module) {
  seedAdminUser()
    .then(() => {
      console.log('[Seed] ✓ Admin user seeder completed successfully');
      process.exit(0);
    })
    .catch(err => {
      console.error('[Seed] ✗ Admin user seeder failed:', err);
      process.exit(1);
    });
}
