/**
 * Manual Seeder: Meeting Assets
 * 
 * This seeder creates realistic meeting asset data for meeting sessions
 * created by the instructor.
 * 
 * Run command: node database/manual-seeder/seed_meeting_assets.js
 */

const { runAsync, getAsync, allAsync } = require('../seedHelpers');

const seedMeetingAssets = async () => {
    console.log('[Manual Seeder] Starting meeting assets seeder...');

    try {
        // Get admin user from env and verify role
        const adminEmail = process.env.ADMIN_EMAIL;
        const adminUser = await getAsync(
            `SELECT u.id, u.company_id, u.role_id, r.role_name 
             FROM users u 
             LEFT JOIN roles r ON u.role_id = r.id 
             WHERE u.email = ? AND u.status = 'active' LIMIT 1`,
            [adminEmail]
        );

        if (!adminUser) {
            console.log('[Manual Seeder] ⚠ Admin user not found.');
            process.exit(1);
        }

        if (adminUser.role_name !== 'admin') {
            console.log(`[Manual Seeder] ⚠ User "${adminEmail}" is not admin. Aborting.`);
            process.exit(1);
        }

        console.log(`[Manual Seeder] ✓ Verified admin user: ID ${adminUser.id}`);

        // Get first instructor created by this admin
        const instructor = await getAsync(
            `SELECT id, first_name, last_name, email FROM users 
             WHERE created_by = ? AND role_id = (SELECT id FROM roles WHERE role_name = 'instructor') 
             AND deleted_at IS NULL AND status = 'active' 
             LIMIT 1`,
            [adminUser.id]
        );

        if (!instructor) {
            console.log('[Manual Seeder] ⚠ No instructor found. Run 006_test_users.js first.');
            process.exit(1);
        }

        console.log(`[Manual Seeder] ✓ Found instructor: ${instructor.first_name} ${instructor.last_name} (ID: ${instructor.id})`);

        // Get meeting sessions for this instructor's meetings
        const sessions = await allAsync(
            `SELECT ms.id, ms.meeting_id, m.title, m.status 
             FROM meeting_sessions ms 
             JOIN meetings m ON ms.meeting_id = m.id 
             WHERE m.created_by = ? AND ms.status = 'completed' 
             LIMIT 5`,
            [instructor.id]
        );

        if (sessions.length === 0) {
            console.log('[Manual Seeder] ⚠ No completed meeting sessions found. Run seed_meeting_sessions.js first.');
            process.exit(1);
        }

        console.log(`[Manual Seeder] ✓ Found ${sessions.length} completed session(s)`);

        const createdAssets = [];

        // Create assets for each session
        for (const session of sessions) {
            // Check if asset already exists
            const existingAsset = await getAsync(
                `SELECT id FROM meeting_assets WHERE session_id = ?`,
                [session.id]
            );

            if (existingAsset) {
                console.log(`[Manual Seeder] Asset for session ID ${session.id} already exists (ID: ${existingAsset.id})`);
                continue;
            }

            // Generate realistic file paths
            const meetingId = session.meeting_id;
            const sessionId = session.id;
            
            const audioPath = `storage/audio/meeting_${meetingId}_session_${sessionId}.mp3`;
            const wavAudioPath = `storage/audio/meeting_${meetingId}_session_${sessionId}.wav`;
            const transcriptPath = `storage/transcripts/meeting_${meetingId}_session_${sessionId}_transcript.json`;
            const auditJsonPath = `storage/audit/meeting_${meetingId}_session_${sessionId}_audit.json`;

            // Realistic screenshots JSON (timeline of important moments)
            const screenshotsJson = JSON.stringify([
                {
                    timestamp: "00:05:23",
                    time_in_seconds: 323,
                    description: "Introduction and agenda review",
                    file_path: `storage/screenshots/meeting_${meetingId}_session_${sessionId}_001.jpg`,
                    detected_object: "presentation_slide",
                    confidence: 0.95
                },
                {
                    timestamp: "00:15:45",
                    time_in_seconds: 945,
                    description: "Student asking question",
                    file_path: `storage/screenshots/meeting_${meetingId}_session_${sessionId}_002.jpg`,
                    detected_object: "student_engagement",
                    confidence: 0.88
                },
                {
                    timestamp: "00:32:10",
                    time_in_seconds: 1930,
                    description: "Whiteboard explanation",
                    file_path: `storage/screenshots/meeting_${meetingId}_session_${sessionId}_003.jpg`,
                    detected_object: "whiteboard_content",
                    confidence: 0.92
                },
                {
                    timestamp: "00:45:55",
                    time_in_seconds: 2755,
                    description: "Group activity breakout",
                    file_path: `storage/screenshots/meeting_${meetingId}_session_${sessionId}_004.jpg`,
                    detected_object: "collaboration",
                    confidence: 0.90
                }
            ]);

            // Realistic audit summary JSON
            const auditSummary = JSON.stringify({
                overall_score: 87.5,
                engagement_score: 92.0,
                content_quality_score: 85.0,
                interaction_score: 88.5,
                key_highlights: [
                    "Excellent student participation throughout the session",
                    "Clear explanation of complex concepts",
                    "Good use of visual aids and examples",
                    "Effective time management"
                ],
                areas_for_improvement: [
                    "Could include more interactive exercises",
                    "Consider adding a brief recap at the end"
                ],
                sentiment_analysis: {
                    positive: 0.78,
                    neutral: 0.18,
                    negative: 0.04
                },
                topics_covered: [
                    "Quadratic equations",
                    "Problem-solving strategies",
                    "Practice problems"
                ],
                duration_minutes: 58,
                participant_count: 3,
                speaker_distribution: {
                    instructor: 0.65,
                    student: 0.35
                }
            });

            const result = await runAsync(
                `INSERT INTO meeting_assets 
                 (meeting_id, session_id, audio_path, wav_audio_path, transcript_path, audit_json_path, 
                  screenshots_json, oqi_score, audit_summary, audit_completed_at, status, processed_at, created_at, updated_at) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                [
                    meetingId,
                    sessionId,
                    audioPath,
                    wavAudioPath,
                    transcriptPath,
                    auditJsonPath,
                    screenshotsJson,
                    87.50,  // OQI score
                    auditSummary,
                    new Date().toISOString().replace('T', ' ').substring(0, 19),  // audit_completed_at
                    'processed',
                    new Date().toISOString().replace('T', ' ').substring(0, 19)   // processed_at
                ]
            );

            const assetId = result.lastID;
            console.log(`[Manual Seeder] ✓ Created asset for: "${session.title}" (Asset ID: ${assetId}, OQI Score: 87.50)`);
            createdAssets.push({ id: assetId, meeting_id: meetingId, session_id: sessionId, title: session.title });
        }

        console.log('\n[Manual Seeder] ✅ Meeting assets seeder completed successfully!');
        console.log(`\nTotal assets created: ${createdAssets.length}`);
        createdAssets.forEach(a => {
            console.log(`  - ${a.title} (Asset ID: ${a.id}, Session ID: ${a.session_id})`);
        });

    } catch (err) {
        console.error('[Manual Seeder] ✗ Meeting assets seeder failed:', err);
        process.exit(1);
    }
};

// Run seeder if executed directly
if (require.main === module) {
    seedMeetingAssets()
        .then(() => {
            console.log('\n[Manual Seeder] Process completed.');
            process.exit(0);
        })
        .catch(err => {
            console.error('[Manual Seeder] Fatal error:', err);
            process.exit(1);
        });
}

module.exports = { seedMeetingAssets };