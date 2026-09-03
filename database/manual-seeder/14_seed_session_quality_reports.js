/**
 * Manual Seeder: session_quality_reports
 * Inserts data ONLY into the session_quality_reports table
 * Run command: node database/manual-seeder/16_seed_session_quality_reports.js
 */
const { runAsync, getAsync, allAsync } = require('../seedHelpers');

const seedSessionQualityReports = async () => {
    console.log('[Manual Seeder] Starting session_quality_reports seeder...');
    try {
        const adminEmail = process.env.ADMIN_EMAIL;
        const adminUser = await getAsync(`SELECT u.id, u.company_id FROM users u WHERE u.email = ? AND u.status = 'active' LIMIT 1`, [adminEmail]);
        if (!adminUser) { console.log('[Manual Seeder] ⚠ Admin user not found.'); process.exit(1); }

        const meetings = await allAsync(`SELECT id FROM meetings WHERE created_by IN (SELECT id FROM users WHERE company_id = ? AND role_id = (SELECT id FROM roles WHERE role_name = 'instructor')) LIMIT 10`, [adminUser.company_id]);
        if (meetings.length === 0) { console.log('[Manual Seeder] ℹ No meetings found.'); return; }

        let count = 0;
        for (const meeting of meetings) {
            const existing = await getAsync(`SELECT id FROM session_quality_reports WHERE meeting_id = ? LIMIT 1`, [meeting.id]);
            if (existing) continue;
            const overallScore = (Math.random() * 3 + 7).toFixed(1);
            await runAsync(
                `INSERT INTO session_quality_reports (meeting_id, overall_score, max_possible_score, percentage_score, overall_rating, student_engagement, learning_impact, parent_shareability, confidence_level, confidence_reason, executive_summary, generated_by, generated_at, created_at, updated_at)
                 VALUES (?, ?, 10, ?, ?, ?, ?, ?, ?, ?, ?, 'AI', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                [meeting.id, overallScore, (overallScore * 10).toFixed(1), 'Good', (Math.random() * 3 + 6).toFixed(1), (Math.random() * 3 + 6).toFixed(1), (Math.random() * 3 + 6).toFixed(1), 0.85, 'Consistent performance across metrics', 'Excellent session with good engagement and learning outcomes']
            );
            count++;
        }
        console.log(`[Manual Seeder] ✓ Created ${count} session_quality_reports`);
    } catch (err) { console.error('[Manual Seeder] ✗ session_quality_reports seeder failed:', err); process.exit(1); }
};

if (require.main === module) { seedSessionQualityReports().then(() => { console.log('\n[Manual Seeder] Process completed.'); process.exit(0); }).catch(err => { console.error('[Manual Seeder] Fatal error:', err); process.exit(1); }); }
module.exports = { seedSessionQualityReports };