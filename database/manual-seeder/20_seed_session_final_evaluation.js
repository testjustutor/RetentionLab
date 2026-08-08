/**
 * Manual Seeder: session_final_evaluation
 * Inserts data ONLY into the session_final_evaluation table
 * Run command: node database/manual-seeder/22_seed_session_final_evaluation.js
 */
const { runAsync, getAsync, allAsync } = require('../seedHelpers');

const seedSessionFinalEvaluation = async () => {
    console.log('[Manual Seeder] Starting session_final_evaluation seeder...');
    try {
        const adminEmail = process.env.ADMIN_EMAIL;
        const adminUser = await getAsync(`SELECT u.id, u.company_id FROM users u WHERE u.email = ? AND u.status = 'active' LIMIT 1`, [adminEmail]);
        if (!adminUser) { console.log('[Manual Seeder] ⚠ Admin user not found.'); process.exit(1); }

        const sessions = await allAsync(`SELECT ms.id, ms.meeting_id FROM meeting_sessions ms JOIN meetings m ON ms.meeting_id = m.id WHERE m.created_by IN (SELECT id FROM users WHERE company_id = ? AND role_id = (SELECT id FROM roles WHERE role_name = 'instructor')) LIMIT 20`, [adminUser.company_id]);
        if (sessions.length === 0) { console.log('[Manual Seeder] ℹ No sessions found.'); return; }

        let count = 0;
        for (const session of sessions) {
            const existing = await getAsync(`SELECT id FROM session_final_evaluation WHERE session_id = ? LIMIT 1`, [session.id]);
            if (existing) continue;
            const score = (Math.random() * 3 + 7).toFixed(1);
            await runAsync(
                `INSERT INTO session_final_evaluation (session_id, overall_session_rating, teacher_performance, student_engagement, learning_impact, parent_communication_readiness, recommended_action, summary_narrative, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                [session.id, score, (Math.random() * 3 + 6).toFixed(1), (Math.random() * 3 + 6).toFixed(1), (Math.random() * 3 + 6).toFixed(1), 'ready', 'Continue current approach', 'Session demonstrated effective teaching with good student engagement.']
            );
            count++;
        }
        console.log(`[Manual Seeder] ✓ Created ${count} session_final_evaluation`);
    } catch (err) { console.error('[Manual Seeder] ✗ session_final_evaluation seeder failed:', err); process.exit(1); }
};

if (require.main === module) { seedSessionFinalEvaluation().then(() => { console.log('\n[Manual Seeder] Process completed.'); process.exit(0); }).catch(err => { console.error('[Manual Seeder] Fatal error:', err); process.exit(1); }); }
module.exports = { seedSessionFinalEvaluation };