/**
 * root/database/seeders/006_test_users.js
 * Seeds test users (instructor, solo_instructor, reviewer) for the manage-users page
 */
const crypto = require('crypto');
const { runAsync, getAsync } = require('../seedHelpers');

const hashPassword = (password, salt = crypto.randomBytes(16).toString('hex')) => {
    const derived = crypto.scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${derived}`;
};

const seedTestUsers = async () => {
    const passwordHash = hashPassword('Password123!');
    const company = await getAsync(`SELECT id FROM companies LIMIT 1`);
    if (!company) return;

    const roles = await new Promise((resolve, reject) => {
        const { db } = require('../db');
        db.all(`SELECT id, role_name FROM roles WHERE role_name IN ('instructor', 'solo_instructor', 'reviewer')`, (err, rows) => {
            if (err) return reject(err);
            resolve(rows || []);
        });
    });

    const testUsers = [
        { first_name: 'John', last_name: 'Instructor', email: 'instructor@test.com', role_name: 'instructor' },
        { first_name: 'Jane', last_name: 'Solo', email: 'solo@test.com', role_name: 'solo_instructor' },
        { first_name: 'Bob', last_name: 'Reviewer', email: 'reviewer@test.com', role_name: 'reviewer' }
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
                company.id,
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
                null
            ]
        );
        console.log(`[Seed] Created test user: ${user.email}`);
    }
    console.log('[Seed] ✓ Test users seeded successfully (3 users)');
};

module.exports = { seedTestUsers };