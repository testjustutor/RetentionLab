/**
 * Manual Seeder: meeting_session_scores
 * Inserts data ONLY into the meeting_session_scores table
 * Run command: node database/manual-seeder/15_seed_meeting_session_scores.js
 */
const { runAsync, getAsync, allAsync } = require('../seedHelpers');

const seedMeetingSessionScores = async () => {
    console.log('[Manual Seeder] Starting meeting_session_scores seeder...');
    try {
        const adminEmail = process.env.ADMIN_EMAIL;
        const adminUser = await getAsync(`SELECT u.id, u.company_id, u.role_id, r.role_name FROM users u LEFT JOIN roles r ON u.role_id = r.id WHERE u.email = ? AND u.status = 'active' LIMIT 1`, [adminEmail]);
        if (!adminUser) { console.log('[Manual Seeder] ⚠ Admin user not found.'); process.exit(1); }

        const sessions = await allAsync(`SELECT ms.id, ms.meeting_id FROM meeting_sessions ms JOIN meetings m ON ms.meeting_id = m.id WHERE m.created_by IN (SELECT id FROM users WHERE company_id = ? AND role_id = (SELECT id FROM roles WHERE role_name = 'instructor')) LIMIT 20`, [adminUser.company_id]);
        if (sessions.length === 0) { console.log('[Manual Seeder] ℹ No sessions found.'); return; }

        // Get valid indicator IDs from rubric_indicators table
        const indicators = await allAsync(`SELECT indicator_id FROM rubric_indicators WHERE status = 'active' LIMIT 20`, []);
        if (indicators.length === 0) { console.log('[Manual Seeder] ℹ No rubric indicators found. Run rubric seeder first.'); return; }

        let count = 0;
        for (const session of sessions) {
            // Insert scores for multiple indicators per session
            const numIndicators = Math.floor(Math.random() * 5) + 3; // 3-7 indicators per session
            for (let i = 0; i < numIndicators; i++) {
                const indicator = indicators[Math.floor(Math.random() * indicators.length)];
                const existing = await getAsync(`SELECT id FROM meeting_session_scores WHERE meeting_id = ? AND session_id = ? AND indicator_id = ? LIMIT 1`, [session.meeting_id, session.id, indicator.indicator_id]);
                if (existing) continue;
                await runAsync(
                    `INSERT INTO meeting_session_scores (meeting_id, session_id, indicator_id, score, score_type, comment, reviewer_id, created_at)
                     VALUES (?, ?, ?, ?, 'AI', 'Auto-generated', ?, CURRENT_TIMESTAMP)`,
                    [session.meeting_id, session.id, indicator.indicator_id, (Math.random() * 5 + 5).toFixed(1), adminUser.id]
                );
                count++;
            }
        }
        console.log(`[Manual Seeder] ✓ Created ${count} meeting_session_scores`);
    } catch (err) { console.error('[Manual Seeder] ✗ meeting_session_scores seeder failed:', err); process.exit(1); }
};

if (require.main === module) { seedMeetingSessionScores().then(() => { console.log('\n[Manual Seeder] Process completed.'); process.exit(0); }).catch(err => { console.error('[Manual Seeder] Fatal error:', err); process.exit(1); }); }
module.exports = { seedMeetingSessionScores };