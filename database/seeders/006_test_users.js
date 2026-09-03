/**
 * root/database/seeders/006_test_users.js
 * Seeds test users (instructor, solo_instructor, reviewer) for the manage-users page
 */
const crypto = require('crypto');
const { runAsync, getAsync, allAsync, hashPassword } = require('../seedHelpers');

const seedTestUsers = async () => {
    
    const testPassword = process.env.TESTING_PASSWORD;
    const passwordHash = hashPassword(testPassword);
    
    // Get admin user to set as created_by and get company_id
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminUser = await getAsync(
        `SELECT id, company_id FROM users WHERE email = ? AND status = 'active' LIMIT 1`,
        [adminEmail]
    );
    if (!adminUser) {
        console.log('[Seed] ⚠ Admin user not found. Cannot create test users.');
        return;
    }
    console.log(`[Seed] Found admin user (ID: ${adminUser.id}, Company ID: ${adminUser.company_id})`);

    const roles = await allAsync(
        `SELECT id, role_name FROM roles WHERE role_name IN ('instructor', 'reviewer')`
    );

    const testUsers = [
        { first_name: 'John', last_name: 'Instructor', email: 'instructor@automationbot.com', role_name: 'instructor' },
        { first_name: 'Bob', last_name: 'Reviewer', email: 'reviewer@automationbot.com', role_name: 'reviewer' }
    ];

    for (const user of testUsers) {
        const existing = await getAsync(`SELECT id FROM users WHERE email = ?`, [user.email]);
        if (existing) continue;

        const role = roles.find(r => r.role_name === user.role_name);
        if (!role) continue;

        await runAsync(
            `INSERT INTO users (
                user_uuid, company_id, role_id, first_name, last_name, email,
                password_hash, phone, profile_image, status,
                email_verified, email_verified_at,
                created_by, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
            [
                crypto.randomUUID(),
                adminUser.company_id,
                role.id,
                user.first_name,
                user.last_name,
                user.email,
                passwordHash,
                null,
                null,
                'active',
                1,
                new Date().toISOString(),
                adminUser ? adminUser.id : null
            ]
        );
        console.log(`[Seed] Created test user: ${user.email} (created_by: ${adminUser ? adminUser.id : 'NULL'})`);
    }
    console.log('[Seed] ✓ Test users seeded successfully (2 users)');
};

module.exports = { seedTestUsers };

// Run seeder if executed directly
if (require.main === module) {
  seedTestUsers()
    .then(() => {
      console.log('[Seed] ✓ Test users seeder completed successfully');
      process.exit(0);
    })
    .catch(err => {
      console.error('[Seed] ✗ Test users seeder failed:', err);
      process.exit(1);
    });
}
