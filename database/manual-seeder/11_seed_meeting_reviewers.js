/**
 * Manual Seeder: meeting_reviewers
 * Inserts data ONLY into the meeting_reviewers table
 * Run command: node database/manual-seeder/13_seed_meeting_reviewers.js
 */
const { runAsync, getAsync, allAsync } = require('../seedHelpers');

const seedMeetingReviewers = async () => {
    console.log('[Manual Seeder] Starting meeting_reviewers seeder...');
    try {
        const adminEmail = process.env.ADMIN_EMAIL;
        const adminUser = await getAsync(`SELECT u.id, u.company_id, u.role_id, r.role_name FROM users u LEFT JOIN roles r ON u.role_id = r.id WHERE u.email = ? AND u.status = 'active' LIMIT 1`, [adminEmail]);
        if (!adminUser) { console.log('[Manual Seeder] ⚠ Admin user not found.'); process.exit(1); }

        const reviewers = await allAsync(`SELECT id FROM users WHERE company_id = ? AND role_id = (SELECT id FROM roles WHERE role_name = 'reviewer') AND status = 'active' LIMIT 5`, [adminUser.company_id]);
        const meetings = await allAsync(`SELECT id FROM meetings WHERE created_by IN (SELECT id FROM users WHERE company_id = ? AND role_id = (SELECT id FROM roles WHERE role_name = 'instructor')) LIMIT 10`, [adminUser.company_id]);
        if (reviewers.length === 0 || meetings.length === 0) { console.log('[Manual Seeder] ℹ Reviewers or meetings not found.'); return; }

        let count = 0;
        for (const meeting of meetings) {
            const reviewer = reviewers[Math.floor(Math.random() * reviewers.length)];
            const existing = await getAsync(`SELECT id FROM meeting_reviewers WHERE meeting_id = ? AND reviewer_id = ? LIMIT 1`, [meeting.id, reviewer.id]);
            if (existing) continue;
            await runAsync(
                `INSERT INTO meeting_reviewers (meeting_id, reviewer_id, assigned_by, review_status, assigned_at, reviewed_at, comments, created_at)
                 VALUES (?, ?, ?, 'pending', CURRENT_TIMESTAMP, NULL, NULL, CURRENT_TIMESTAMP)`,
                [meeting.id, reviewer.id, adminUser.id]
            );
            count++;
        }
        console.log(`[Manual Seeder] ✓ Created ${count} meeting_reviewers`);
    } catch (err) { console.error('[Manual Seeder] ✗ meeting_reviewers seeder failed:', err); process.exit(1); }
};

if (require.main === module) { seedMeetingReviewers().then(() => { console.log('\n[Manual Seeder] Process completed.'); process.exit(0); }).catch(err => { console.error('[Manual Seeder] Fatal error:', err); process.exit(1); }); }
module.exports = { seedMeetingReviewers };