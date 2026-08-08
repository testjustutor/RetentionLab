/**
 * Manual Seeder: session_better_alternatives
 * Inserts data ONLY into the session_better_alternatives table
 * Run command: node database/manual-seeder/20_seed_session_better_alternatives.js
 */
const { runAsync, getAsync, allAsync } = require('../seedHelpers');

const seedSessionBetterAlternatives = async () => {
    console.log('[Manual Seeder] Starting session_better_alternatives seeder...');
    try {
        const adminEmail = process.env.ADMIN_EMAIL;
        const adminUser = await getAsync(`SELECT u.id, u.company_id FROM users u WHERE u.email = ? AND u.status = 'active' LIMIT 1`, [adminEmail]);
        if (!adminUser) { console.log('[Manual Seeder] ⚠ Admin user not found.'); process.exit(1); }

        const sessions = await allAsync(`SELECT ms.id, ms.meeting_id FROM meeting_sessions ms JOIN meetings m ON ms.meeting_id = m.id WHERE m.created_by IN (SELECT id FROM users WHERE company_id = ? AND role_id = (SELECT id FROM roles WHERE role_name = 'instructor')) LIMIT 20`, [adminUser.company_id]);
        if (sessions.length === 0) { console.log('[Manual Seeder] ℹ No sessions found.'); return; }

        let count = 0;
        for (const session of sessions) {
            const existing = await getAsync(`SELECT id FROM session_better_alternatives WHERE session_id = ? LIMIT 1`, [session.id]);
            if (existing) continue;
            await runAsync(
                `INSERT INTO session_better_alternatives (session_id, items, created_at, updated_at)
                 VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                [session.id, JSON.stringify([{ method: 'Lecture', alternative: 'Flipped classroom approach', expected_improvement: 'Higher engagement' }])]
            );
            count++;
        }
        console.log(`[Manual Seeder] ✓ Created ${count} session_better_alternatives`);
    } catch (err) { console.error('[Manual Seeder] ✗ session_better_alternatives seeder failed:', err); process.exit(1); }
};

if (require.main === module) { seedSessionBetterAlternatives().then(() => { console.log('\n[Manual Seeder] Process completed.'); process.exit(0); }).catch(err => { console.error('[Manual Seeder] Fatal error:', err); process.exit(1); }); }
module.exports = { seedSessionBetterAlternatives };