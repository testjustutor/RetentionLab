/**
 * Manual Seeder: calendar_connections (verification side)
 * Inserts verification rows into the merged calendar_connections table.
 * Run command: node database/manual-seeder/03_seed_calendar_verifications.js
 */
const { runAsync, getAsync, allAsync } = require('../seedHelpers');

const seedCalendarVerifications = async () => {
    console.log('[Manual Seeder] Starting calendar_connections (verifications) seeder...');
    try {
        const adminEmail = process.env.ADMIN_EMAIL;
        const adminUser = await getAsync(`SELECT u.id, u.company_id, u.role_id, r.role_name FROM users u LEFT JOIN roles r ON u.role_id = r.id WHERE u.email = ? AND u.status = 'active' LIMIT 1`, [adminEmail]);
        if (!adminUser) { console.log('[Manual Seeder] Warning: Admin user not found.'); process.exit(1); }

        const providerRow = await getAsync(`SELECT id FROM calendar_providers WHERE name = 'google-meet' LIMIT 1`);
        const providerId = providerRow ? providerRow.id : 2;

        const instructors = await allAsync(`SELECT id, email FROM users WHERE company_id = ? AND role_id = (SELECT id FROM roles WHERE role_name = 'instructor') AND status = 'active' LIMIT 5`, [adminUser.company_id]);

        let count = 0;
        for (const instructor of instructors) {
            const existing = await getAsync(`SELECT id FROM calendar_connections WHERE user_id = ? AND provider_id = ? LIMIT 1`, [instructor.id, providerId]);
            if (existing) continue;
            await runAsync(
                `INSERT INTO calendar_connections (user_id, provider_id, code, verification_token, verification_status, verification_expires_at, verified_at, connected_at, created_at, updated_at)
                 VALUES (?, ?, ?, ?, 'verified', DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 30 DAY), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                [instructor.id, providerId, 'GVC_' + Math.random().toString(36).substring(2, 10), 'gvt_' + Math.random().toString(36).substring(2, 10)]
            );
            count++;
        }
        console.log(`[Manual Seeder] Created ${count} calendar_connections (verifications)`);
    } catch (err) { console.error('[Manual Seeder] calendar_connections (verifications) seeder failed:', err); process.exit(1); }
};

if (require.main === module) { seedCalendarVerifications().then(() => { console.log('\n[Manual Seeder] Process completed.'); process.exit(0); }).catch(err => { console.error('[Manual Seeder] Fatal error:', err); process.exit(1); }); }
module.exports = { seedCalendarVerifications };
