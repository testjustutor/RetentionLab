/**
 * Manual Seeder: calendar_credentials
 * Inserts data ONLY into the calendar_credentials table
 * Run command: node database/manual-seeder/07_seed_calendar_credentials.js
 */
const { runAsync, getAsync, allAsync } = require('../seedHelpers');

const seedCalendarCredentials = async () => {
    console.log('[Manual Seeder] Starting calendar_credentials seeder...');
    try {
        const adminEmail = process.env.ADMIN_EMAIL;
        const adminUser = await getAsync(`SELECT u.id, u.company_id FROM users u WHERE u.email = ? AND u.status = 'active' LIMIT 1`, [adminEmail]);
        if (!adminUser) { console.log('[Manual Seeder] ⚠ Admin user not found.'); process.exit(1); }

        const instructors = await allAsync(`SELECT id FROM users WHERE company_id = ? AND role_id = (SELECT id FROM roles WHERE role_name = 'instructor') AND status = 'active' LIMIT 5`, [adminUser.company_id]);

        let count = 0;
        for (const instructor of instructors) {
            const existing = await getAsync(`SELECT id FROM calendar_credentials WHERE user_id = ? LIMIT 1`, [instructor.id]);
            if (existing) continue;
            await runAsync(
                `INSERT INTO calendar_credentials (user_id, provider, credentials_json, is_active, created_at, updated_at)
                 VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                [instructor.id, 'google', JSON.stringify({ client_id: 'test_client', client_secret: 'test_secret', refresh_token: 'test_refresh_' + Math.random().toString(36).substring(2, 15) })]
            );
            count++;
        }
        console.log(`[Manual Seeder] ✓ Created ${count} calendar_credentials`);
    } catch (err) { console.error('[Manual Seeder] ✗ calendar_credentials seeder failed:', err); process.exit(1); }
};

if (require.main === module) { seedCalendarCredentials().then(() => { console.log('\n[Manual Seeder] Process completed.'); process.exit(0); }).catch(err => { console.error('[Manual Seeder] Fatal error:', err); process.exit(1); }); }
module.exports = { seedCalendarCredentials };