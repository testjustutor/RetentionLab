/**
 * Manual Seeder: calendar_integrations
 * Inserts data ONLY into the calendar_integrations table
 * Run command: node database/manual-seeder/06_seed_calendar_integrations.js
 */
const { runAsync, getAsync, allAsync } = require('../seedHelpers');

const seedCalendarIntegrations = async () => {
    console.log('[Manual Seeder] Starting calendar_integrations seeder...');
    try {
        const adminEmail = process.env.ADMIN_EMAIL;
        const adminUser = await getAsync(`SELECT u.id, u.company_id FROM users u WHERE u.email = ? AND u.status = 'active' LIMIT 1`, [adminEmail]);
        if (!adminUser) { console.log('[Manual Seeder] ⚠ Admin user not found.'); process.exit(1); }

        const instructors = await allAsync(`SELECT id FROM users WHERE company_id = ? AND role_id = (SELECT id FROM roles WHERE role_name = 'instructor') AND status = 'active' LIMIT 5`, [adminUser.company_id]);
        const platforms = ['zoom', 'google', 'microsoft'];
        let count = 0;
        for (const instructor of instructors) {
            const existing = await getAsync(`SELECT id FROM calendar_integrations WHERE user_id = ? LIMIT 1`, [instructor.id]);
            if (existing) continue;
            const platform = platforms[Math.floor(Math.random() * platforms.length)];
            await runAsync(
                `INSERT INTO calendar_integrations (user_id, platform, provider, access_token, refresh_token, expires_at, token_expiry, status, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 30 DAY), DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 30 DAY), 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                [instructor.id, platform, platform === 'zoom' ? 'zoom' : platform === 'google' ? 'google_calendar' : 'microsoft_teams',
                 'acc_' + Math.random().toString(36).substring(2, 20), 'ref_' + Math.random().toString(36).substring(2, 20)]
            );
            count++;
        }
        console.log(`[Manual Seeder] ✓ Created ${count} calendar_integrations`);
    } catch (err) { console.error('[Manual Seeder] ✗ calendar_integrations seeder failed:', err); process.exit(1); }
};

if (require.main === module) { seedCalendarIntegrations().then(() => { console.log('\n[Manual Seeder] Process completed.'); process.exit(0); }).catch(err => { console.error('[Manual Seeder] Fatal error:', err); process.exit(1); }); }
module.exports = { seedCalendarIntegrations };