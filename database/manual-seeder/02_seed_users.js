/**
 * Manual Seeder: users
 * Inserts data ONLY into the users table
 * Run command: node database/manual-seeder/02_seed_users.js
 */
const crypto = require('crypto');
const { runAsync, getAsync, allAsync } = require('../seedHelpers');

function hashPassword(password, salt = null) {
  salt = salt || crypto.randomBytes(16).toString('hex');
  const secretKey = process.env.PASSWORD_SECRET_KEY || '';
  const pepperedPassword = secretKey + password;
  const derived = crypto.scryptSync(pepperedPassword, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

const seedUsers = async () => {
    console.log('[Manual Seeder] Starting users seeder...');
    try {
        const adminEmail = process.env.ADMIN_EMAIL;
        const adminUser = await getAsync(`SELECT u.id, u.company_id, u.role_id, r.role_name FROM users u LEFT JOIN roles r ON u.role_id = r.id WHERE u.email = ? AND u.status = 'active' LIMIT 1`, [adminEmail]);
        if (!adminUser) { console.log('[Manual Seeder] ⚠ Admin user not found.'); process.exit(1); }

        const instructorRole = await getAsync(`SELECT id FROM roles WHERE role_name = 'instructor' LIMIT 1`);
        const reviewerRole = await getAsync(`SELECT id FROM roles WHERE role_name = 'reviewer' LIMIT 1`);
        if (!instructorRole || !reviewerRole) { console.log('[Manual Seeder] ⚠ Roles not found.'); process.exit(1); }

        const defaultPassword = process.env.TEST_USER_PASSWORD || 'password123';
        const passwordHash = hashPassword(defaultPassword);

        let count = 0;

        // Create 10 instructors
        for (let i = 1; i <= 10; i++) {
            const email = `instructor${i}@example.com`;
            const existing = await getAsync(`SELECT id FROM users WHERE email = ? LIMIT 1`, [email]);
            if (existing) continue;
            const user_uuid = crypto.randomUUID();
            await runAsync(
                `INSERT INTO users (user_uuid, company_id, role_id, first_name, last_name, email, password_hash, status, is_active, email_verified, created_by, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, 'active', 1, 1, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                [user_uuid, adminUser.company_id, instructorRole.id, `Instructor ${i}`, `Test${i}`, email, passwordHash, adminUser.id]
            );
            count++;
        }

        // Create 5 reviewers
        for (let i = 1; i <= 5; i++) {
            const email = `reviewer${i}@example.com`;
            const existing = await getAsync(`SELECT id FROM users WHERE email = ? LIMIT 1`, [email]);
            if (existing) continue;
            const user_uuid = crypto.randomUUID();
            await runAsync(
                `INSERT INTO users (user_uuid, company_id, role_id, first_name, last_name, email, password_hash, status, is_active, email_verified, created_by, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, 'active', 1, 1, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                [user_uuid, adminUser.company_id, reviewerRole.id, `Reviewer ${i}`, `Test${i}`, email, passwordHash, adminUser.id]
            );
            count++;
        }

        console.log(`[Manual Seeder] ✓ Created ${count} users`);
    } catch (err) { console.error('[Manual Seeder] ✗ users seeder failed:', err); process.exit(1); }
};

if (require.main === module) { seedUsers().then(() => { console.log('\n[Manual Seeder] Process completed.'); process.exit(0); }).catch(err => { console.error('[Manual Seeder] Fatal error:', err); process.exit(1); }); }
module.exports = { seedUsers };