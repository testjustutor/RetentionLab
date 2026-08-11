/**
 * Manual Seeder: meeting_assets
 * Inserts data ONLY into the meeting_assets table
 * Run command: node database/manual-seeder/11_seed_meeting_assets.js
 */
const { runAsync, getAsync, allAsync } = require('../seedHelpers');

const seedMeetingAssets = async () => {
    console.log('[Manual Seeder] Starting meeting_assets seeder...');
    try {
        const adminEmail = process.env.ADMIN_EMAIL;
        const adminUser = await getAsync(`SELECT u.id, u.company_id FROM users u WHERE u.email = ? AND u.status = 'active' LIMIT 1`, [adminEmail]);
        if (!adminUser) { console.log('[Manual Seeder] ⚠ Admin user not found.'); process.exit(1); }

        const sessions = await allAsync(`SELECT ms.id, ms.meeting_id, m.title FROM meeting_sessions ms JOIN meetings m ON ms.meeting_id = m.id WHERE m.created_by IN (SELECT id FROM users WHERE company_id = ? AND role_id = (SELECT id FROM roles WHERE role_name = 'instructor')) LIMIT 30`, [adminUser.company_id]);
        if (sessions.length === 0) { console.log('[Manual Seeder] ℹ No sessions found. Run 09_seed_meeting_sessions.js first.'); return; }

        let count = 0;
        const now = new Date();

        const dateTime = now.toISOString()
          .slice(0, 16)
          .replace('T', '_')
          .replace(':', '-');

        for (const session of sessions) {
            const existing = await getAsync(`SELECT id FROM meeting_assets WHERE meeting_id = ? AND session_id = ? LIMIT 1`, [session.meeting_id, session.id]);
            if (existing) continue;

            const meetingId = session.meeting_id;
            const sessionId = session.id;
            const audioPath = `storage/recordings/REC_${meetingId}_session_${sessionId}_${dateTime}.mp3`;
            const transcriptPath = `storage/transcripts/TRANS_${meetingId}_session_${sessionId}_${dateTime}.txt`;
            const summaryPath = `storage/summaries/SUMMARY_${meetingId}_session_${sessionId}_${dateTime}.txt`;
            const videoPath = `storage/screen-recordings/SCREEN_${meetingId}_session_${sessionId}_${dateTime}.mp4`;

            const oqiScore = (Math.random() * 3 + 7).toFixed(2);

            const screenshotsJson = JSON.stringify([
                { timestamp: "00:05:23", time_in_seconds: 323, description: "Introduction and agenda review", file_path: `storage/screenshots/meeting_${meetingId}_session_${sessionId}_001.jpg`, detected_object: "presentation_slide", confidence: 0.95 }
            ]);

            const auditSummary = JSON.stringify({
                overall_score: parseFloat(oqiScore) * 10,
                engagement_score: 92.0,
                content_quality_score: 85.0,
                interaction_score: 88.5,
                key_highlights: ["Excellent student participation", "Clear explanation of complex concepts"],
                areas_for_improvement: ["Could include more interactive exercises"]
            });

            await runAsync(
                `INSERT INTO meeting_assets 
                 (meeting_id, session_id, audio_path, transcript_path, summary_path, video_path, oqi_score, audit_summary, audit_completed_at, status, 
                  processed_at, created_at, updated_at) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                [meetingId, sessionId, audioPath, transcriptPath, summaryPath, videoPath, parseFloat(oqiScore), auditSummary,
                 new Date().toISOString().replace('T', ' ').substring(0, 19), 'processed',
                 new Date().toISOString().replace('T', ' ').substring(0, 19)]
            );
            count++;
        }
        console.log(`[Manual Seeder] ✓ Created ${count} meeting_assets`);
    } catch (err) { console.error('[Manual Seeder] ✗ meeting_assets seeder failed:', err); process.exit(1); }
};

if (require.main === module) { seedMeetingAssets().then(() => { console.log('\n[Manual Seeder] Process completed.'); process.exit(0); }).catch(err => { console.error('[Manual Seeder] Fatal error:', err); process.exit(1); }); }
module.exports = { seedMeetingAssets };