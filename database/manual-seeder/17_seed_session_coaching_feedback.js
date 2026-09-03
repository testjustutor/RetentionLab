/**
 * Manual Seeder: session_coaching_feedback
 * Inserts data ONLY into the session_coaching_feedback table
 * Run command: node database/manual-seeder/19_seed_session_coaching_feedback.js
 */
const { runAsync, getAsync, allAsync } = require('../seedHelpers');

const seedSessionCoachingFeedback = async () => {
    console.log('[Manual Seeder] Starting session_coaching_feedback seeder...');
    try {
        const adminEmail = process.env.ADMIN_EMAIL;
        const adminUser = await getAsync(`SELECT u.id, u.company_id FROM users u WHERE u.email = ? AND u.status = 'active' LIMIT 1`, [adminEmail]);
        if (!adminUser) { console.log('[Manual Seeder] ⚠ Admin user not found.'); process.exit(1); }

        const sessions = await allAsync(`SELECT ms.id, ms.meeting_id FROM meeting_sessions ms JOIN meetings m ON ms.meeting_id = m.id WHERE m.created_by IN (SELECT id FROM users WHERE company_id = ? AND role_id = (SELECT id FROM roles WHERE role_name = 'instructor')) LIMIT 20`, [adminUser.company_id]);
        if (sessions.length === 0) { console.log('[Manual Seeder] ℹ No sessions found.'); return; }

        let count = 0;
        for (const session of sessions) {
            const existing = await getAsync(`SELECT id FROM session_coaching_feedback WHERE session_id = ? LIMIT 1`, [session.id]);
            if (existing) continue;
            await runAsync(
                `INSERT INTO session_coaching_feedback (session_id, meeting_id, feedback_type, feedback_content, action_items, priority, status, target_date, created_at, updated_at)
                 VALUES (?, ?, 'coaching', ?, ?, 'high', 'pending', DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 7 DAY), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                [session.id, session.meeting_id, 'Focus on improving student engagement through more interactive questions.', JSON.stringify(['Add more interactive exercises', 'Use visual aids more effectively'])]
            );
            count++;
        }
        console.log(`[Manual Seeder] ✓ Created ${count} session_coaching_feedback`);
    } catch (err) { console.error('[Manual Seeder] ✗ session_coaching_feedback seeder failed:', err); process.exit(1); }
};

if (require.main === module) { seedSessionCoachingFeedback().then(() => { console.log('\n[Manual Seeder] Process completed.'); process.exit(0); }).catch(err => { console.error('[Manual Seeder] Fatal error:', err); process.exit(1); }); }
module.exports = { seedSessionCoachingFeedback };