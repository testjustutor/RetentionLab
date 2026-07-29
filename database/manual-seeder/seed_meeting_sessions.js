/**
 * Manual Seeder: Meeting Sessions
 * 
 * This seeder creates realistic meeting session data for meetings
 * created by the instructor.
 * 
 * Run command: node database/manual-seeder/seed_meeting_sessions.js
 */

const { runAsync, getAsync, allAsync } = require('../seedHelpers');

const seedMeetingSessions = async () => {
    console.log('[Manual Seeder] Starting meeting sessions seeder...');

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
             AND status = 'active' 
             LIMIT 1`,
            [adminUser.id]
        );

        if (!instructor) {
            console.log('[Manual Seeder] ⚠ No instructor found. Run 006_test_users.js first.');
            process.exit(1);
        }

        console.log(`[Manual Seeder] ✓ Found instructor: ${instructor.first_name} ${instructor.last_name} (ID: ${instructor.id})`);

        // Get meetings created by this instructor
        const meetings = await allAsync(
            `SELECT id, title, status, scheduled_start_time, scheduled_end_time 
             FROM meetings 
             WHERE created_by = ?
             LIMIT 5`,
            [instructor.id]
        );

        if (meetings.length === 0) {
            console.log('[Manual Seeder] ⚠ No meetings found. Run seed_meetings.js first.');
            process.exit(1);
        }

        console.log(`[Manual Seeder] ✓ Found ${meetings.length} meeting(s)`);

        const createdSessions = [];

        // Create sessions for each meeting
        for (const meeting of meetings) {
            // Check if session already exists
            const existingSession = await getAsync(
                `SELECT id FROM meeting_sessions WHERE meeting_id = ?`,
                [meeting.id]
            );

            if (existingSession) {
                console.log(`[Manual Seeder] Session for meeting "${meeting.title}" already exists (ID: ${existingSession.id})`);
                continue;
            }

            let startTime, endTime, status;

            if (meeting.status === 'completed') {
                // For completed meetings, create a completed session
                const meetingStart = new Date(meeting.scheduled_start_time);
                const meetingEnd = new Date(meeting.scheduled_end_time);
                const actualDuration = (meetingEnd - meetingStart) * 0.95 / 1000; // 95% of scheduled time (in seconds)
                
                startTime = meetingStart.toISOString().replace('T', ' ').substring(0, 19);
                endTime = new Date(meetingStart.getTime() + actualDuration * 1000).toISOString().replace('T', ' ').substring(0, 19);
                status = 'completed';
            } else {
                // For scheduled meetings, don't create session yet
                console.log(`[Manual Seeder] Skipping session for scheduled meeting: "${meeting.title}"`);
                continue;
            }

            const result = await runAsync(
                `INSERT INTO meeting_sessions 
                 (meeting_id, transcript_file_name, audio_file_name, start_time, end_time, status, created_at, updated_at) 
                 VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                [
                    meeting.id,
                    `transcripts/meeting_${meeting.id}_transcript.json`,
                    `audio/meeting_${meeting.id}_audio.wav`,
                    startTime,
                    endTime,
                    status
                ]
            );

            const sessionId = result.lastID;
            console.log(`[Manual Seeder] ✓ Created session for: "${meeting.title}" (Session ID: ${sessionId}, Status: ${status})`);
            createdSessions.push({ id: sessionId, meeting_id: meeting.id, title: meeting.title });
        }

        console.log('\n[Manual Seeder] ✅ Meeting sessions seeder completed successfully!');
        console.log(`\nTotal sessions created: ${createdSessions.length}`);
        createdSessions.forEach(s => {
            console.log(`  - Meeting: ${s.title} (Session ID: ${s.id})`);
        });

    } catch (err) {
        console.error('[Manual Seeder] ✗ Meeting sessions seeder failed:', err);
        process.exit(1);
    }
};

// Run seeder if executed directly
if (require.main === module) {
    seedMeetingSessions()
        .then(() => {
            console.log('\n[Manual Seeder] Process completed.');
            process.exit(0);
        })
        .catch(err => {
            console.error('[Manual Seeder] Fatal error:', err);
            process.exit(1);
        });
}

module.exports = { seedMeetingSessions };