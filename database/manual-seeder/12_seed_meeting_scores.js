/**
 * Manual Seeder: meeting_scores
 * Inserts data ONLY into the meeting_scores table
 * Run command: node database/manual-seeder/14_seed_meeting_scores.js
 */
const { runAsync, getAsync, allAsync } = require('../seedHelpers');

const seedMeetingScores = async () => {
    console.log('[Manual Seeder] Starting meeting_scores seeder...');
    try {
        const adminEmail = process.env.ADMIN_EMAIL;
        const adminUser = await getAsync(`SELECT u.id, u.company_id, u.role_id, r.role_name FROM users u LEFT JOIN roles r ON u.role_id = r.id WHERE u.email = ? AND u.status = 'active' LIMIT 1`, [adminEmail]);
        if (!adminUser) { console.log('[Manual Seeder] ⚠ Admin user not found.'); process.exit(1); }

        const meetings = await allAsync(`SELECT id FROM meetings WHERE created_by IN (SELECT id FROM users WHERE company_id = ? AND role_id = (SELECT id FROM roles WHERE role_name = 'instructor')) LIMIT 10`, [adminUser.company_id]);
        const reviewers = await allAsync(`SELECT id FROM users WHERE company_id = ? AND role_id = (SELECT id FROM roles WHERE role_name = 'reviewer') AND status = 'active' LIMIT 5`, [adminUser.company_id]);
        if (meetings.length === 0 || reviewers.length === 0) { console.log('[Manual Seeder] ℹ Meetings or reviewers not found.'); return; }

        let count = 0;
        for (const meeting of meetings) {
            const reviewer = reviewers[Math.floor(Math.random() * reviewers.length)];
            const existing = await getAsync(`SELECT id FROM meeting_scores WHERE meeting_id = ? AND reviewer_id = ? LIMIT 1`, [meeting.id, reviewer.id]);
            if (existing) continue;
            await runAsync(
                `INSERT INTO meeting_scores (meeting_id, indicator_id, reviewer_id, score, comment, score_type, scored_at, created_at, updated_at)
                 VALUES (?, ?, ?, ?, 'AI generated score', 'AI', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                [meeting.id, 1, reviewer.id, (Math.random() * 5 + 5).toFixed(1)]
            );
            count++;
        }
        console.log(`[Manual Seeder] ✓ Created ${count} meeting_scores`);
    } catch (err) { console.error('[Manual Seeder] ✗ meeting_scores seeder failed:', err); process.exit(1); }
};

if (require.main === module) { seedMeetingScores().then(() => { console.log('\n[Manual Seeder] Process completed.'); process.exit(0); }).catch(err => { console.error('[Manual Seeder] Fatal error:', err); process.exit(1); }); }
module.exports = { seedMeetingScores };