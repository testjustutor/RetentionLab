/**
 * Manual Seeder: session_quality_flags
 * Inserts data ONLY into the session_quality_flags table
 * Run command: node database/manual-seeder/21_seed_session_quality_flags.js
 */
const { runAsync, getAsync, allAsync } = require('../seedHelpers');

const seedSessionQualityFlags = async () => {
    console.log('[Manual Seeder] Starting session_quality_flags seeder...');
    try {
        const adminEmail = process.env.ADMIN_EMAIL;
        const adminUser = await getAsync(`SELECT u.id, u.company_id FROM users u WHERE u.email = ? AND u.status = 'active' LIMIT 1`, [adminEmail]);
        if (!adminUser) { console.log('[Manual Seeder] ⚠ Admin user not found.'); process.exit(1); }

        const sessions = await allAsync(`SELECT ms.id, ms.meeting_id FROM meeting_sessions ms JOIN meetings m ON ms.meeting_id = m.id WHERE m.created_by IN (SELECT id FROM users WHERE company_id = ? AND role_id = (SELECT id FROM roles WHERE role_name = 'instructor')) LIMIT 20`, [adminUser.company_id]);
        if (sessions.length === 0) { console.log('[Manual Seeder] ℹ No sessions found.'); return; }

        let count = 0;
        for (const session of sessions) {
            const existing = await getAsync(`SELECT id FROM session_quality_flags WHERE session_id = ? LIMIT 1`, [session.id]);
            if (existing) continue;
            await runAsync(
                `INSERT INTO session_quality_flags (session_id, flags, created_at, updated_at)
                 VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                [session.id, JSON.stringify([{ type: 'engagement', severity: 'low', description: 'Low engagement in first 10 minutes' }])]
            );
            count++;
        }
        console.log(`[Manual Seeder] ✓ Created ${count} session_quality_flags`);
    } catch (err) { console.error('[Manual Seeder] ✗ session_quality_flags seeder failed:', err); process.exit(1); }
};

if (require.main === module) { seedSessionQualityFlags().then(() => { console.log('\n[Manual Seeder] Process completed.'); process.exit(0); }).catch(err => { console.error('[Manual Seeder] Fatal error:', err); process.exit(1); }); }
module.exports = { seedSessionQualityFlags };