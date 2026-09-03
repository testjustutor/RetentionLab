/**
 * Manual Seeder: session_analysis
 * Inserts data ONLY into the session_analysis table
 * Run command: node database/manual-seeder/17_seed_session_analysis.js
 */
const { runAsync, getAsync, allAsync } = require('../seedHelpers');

const seedSessionAnalysis = async () => {
    console.log('[Manual Seeder] Starting session_analysis seeder...');
    try {
        const adminEmail = process.env.ADMIN_EMAIL;
        const adminUser = await getAsync(`SELECT u.id, u.company_id FROM users u WHERE u.email = ? AND u.status = 'active' LIMIT 1`, [adminEmail]);
        if (!adminUser) { console.log('[Manual Seeder] ⚠ Admin user not found.'); process.exit(1); }

        const sessions = await allAsync(`SELECT ms.id, ms.meeting_id FROM meeting_sessions ms JOIN meetings m ON ms.meeting_id = m.id WHERE m.created_by IN (SELECT id FROM users WHERE company_id = ? AND role_id = (SELECT id FROM roles WHERE role_name = 'instructor')) LIMIT 20`, [adminUser.company_id]);
        if (sessions.length === 0) { console.log('[Manual Seeder] ℹ No sessions found.'); return; }

        let count = 0;
        for (const session of sessions) {
            const existing = await getAsync(`SELECT id FROM session_analysis WHERE session_id = ? LIMIT 1`, [session.id]);
            if (existing) continue;
            await runAsync(
                `INSERT INTO session_analysis (session_id, what_worked_well, what_needs_improvement, missed_opportunities, created_at, updated_at)
                 VALUES (?, JSON_OBJECT('content', ?), JSON_OBJECT('content', ?), JSON_OBJECT('content', ?), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                [session.id, 'Clear explanations and good pacing', 'More interactive exercises needed', 'Could have included group discussions']
            );
            count++;
        }
        console.log(`[Manual Seeder] ✓ Created ${count} session_analysis`);
    } catch (err) { console.error('[Manual Seeder] ✗ session_analysis seeder failed:', err); process.exit(1); }
};

if (require.main === module) { seedSessionAnalysis().then(() => { console.log('\n[Manual Seeder] Process completed.'); process.exit(0); }).catch(err => { console.error('[Manual Seeder] Fatal error:', err); process.exit(1); }); }
module.exports = { seedSessionAnalysis };