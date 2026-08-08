/**
 * Manual Seeder: calendar_verifications
 * Inserts data ONLY into the calendar_verifications table
 * Run command: node database/manual-seeder/05_seed_calendar_verifications.js
 */
const { runAsync, getAsync, allAsync } = require('../seedHelpers');

const seedCalendarVerifications = async () => {
    console.log('[Manual Seeder] Starting calendar_verifications seeder...');
    try {
        const adminEmail = process.env.ADMIN_EMAIL;
        const adminUser = await getAsync(`SELECT u.id, u.company_id, u.role_id, r.role_name FROM users u LEFT JOIN roles r ON u.role_id = r.id WHERE u.email = ? AND u.status = 'active' LIMIT 1`, [adminEmail]);
        if (!adminUser) { console.log('[Manual Seeder] ⚠ Admin user not found.'); process.exit(1); }

        const instructors = await allAsync(`SELECT id, email FROM users WHERE company_id = ? AND role_id = (SELECT id FROM roles WHERE role_name = 'instructor') AND status = 'active' LIMIT 5`, [adminUser.company_id]);
        
        let count = 0;
        for (const instructor of instructors) {
            const existing = await getAsync(`SELECT id FROM calendar_verifications WHERE user_id = ? LIMIT 1`, [instructor.id]);
            if (existing) continue;
            await runAsync(
                `INSERT INTO calendar_verifications (user_id, provider, code, token, status, expires_at, verified_at, connected_at, created_at, updated_at)
                 VALUES (?, ?, ?, ?, 'verified', DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 30 DAY), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                [instructor.id, 'google', 'GVC_' + Math.random().toString(36).substring(2, 10), 'gvt_' + Math.random().toString(36).substring(2, 10)]
            );
            count++;
        }
        console.log(`[Manual Seeder] ✓ Created ${count} calendar_verifications`);
    } catch (err) { console.error('[Manual Seeder] ✗ calendar_verifications seeder failed:', err); process.exit(1); }
};

if (require.main === module) { seedCalendarVerifications().then(() => { console.log('\n[Manual Seeder] Process completed.'); process.exit(0); }).catch(err => { console.error('[Manual Seeder] Fatal error:', err); process.exit(1); }); }
module.exports = { seedCalendarVerifications };