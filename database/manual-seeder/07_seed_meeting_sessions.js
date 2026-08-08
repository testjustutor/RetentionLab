/**
 * Manual Seeder: meeting_sessions
 * Inserts data ONLY into the meeting_sessions table
 * 
 * Session start_time is random (1-10 min before/after meeting actual_start_time)
 * to track late/early joins. Session end_time is calculated from session start.
 * Status values vary: 'completed', 'active', 'scheduled', 'cancelled', 'no_show'
 * 
 * Run command: node database/manual-seeder/09_seed_meeting_sessions.js
 */
const { runAsync, getAsync, allAsync } = require('../seedHelpers');

const seedMeetingSessions = async () => {
    console.log('[Manual Seeder] Starting meeting_sessions seeder...');
    try {
        const adminEmail = process.env.ADMIN_EMAIL;
        const adminUser = await getAsync(`SELECT u.id, u.company_id FROM users u WHERE u.email = ? AND u.status = 'active' LIMIT 1`, [adminEmail]);
        if (!adminUser) { console.log('[Manual Seeder] ⚠ Admin user not found.'); process.exit(1); }

        // Get meetings with their actual_start_time (from seed_meetings)
        const meetings = await allAsync(
            `SELECT m.id, m.actual_start_time, m.actual_end_time, m.status AS meeting_status, m.scheduled_start_time, m.scheduled_end_time
             FROM meetings m 
             WHERE m.created_by IN (SELECT id FROM users WHERE company_id = ? AND role_id = (SELECT id FROM roles WHERE role_name = 'instructor'))
             LIMIT 50`,
            [adminUser.company_id]
        );
        if (meetings.length === 0) { console.log('[Manual Seeder] ℹ No meetings found. Run 08_seed_meetings.js first.'); return; }

        // Session statuses based on meeting status
        const sessionStatusesMap = {
            'completed': ['completed', 'completed', 'completed', 'completed', 'completed', 'cancelled'],
            'active': ['active', 'active', 'active', 'active', 'cancelled'],
            'joining': ['active', 'active', 'joining', 'active'],
            'scheduled': ['scheduled', 'scheduled', 'scheduled', 'cancelled', 'no_show'],
        };
        
        const platforms = ['zoom', 'google_meet', 'teams'];
        let count = 0;

        for (const meeting of meetings) {
            // Number of sessions per meeting (2-5)
            const numSessions = Math.floor(Math.random() * 4) + 2;

            // Determine base time - use actual_start_time if available, else scheduled_start_time
            const baseTime = meeting.actual_start_time 
                ? new Date(meeting.actual_start_time) 
                : new Date(meeting.scheduled_start_time || new Date());

            const baseEndTime = meeting.actual_end_time 
                ? new Date(meeting.actual_end_time) 
                : new Date(baseTime.getTime() + 60 * 60 * 1000);

            for (let s = 0; s < numSessions; s++) {
                // Session start: random 1-10 minutes BEFORE or AFTER the meeting actual_start_time
                // 30% chance join early (1-10 min before), 70% chance join late (1-10 min after)
                const earlyOrLate = Math.random();
                let offsetMs = 0;
                if (earlyOrLate < 0.3) {
                    // Join early: 1-10 minutes before
                    offsetMs = -(Math.floor(Math.random() * 10) + 1) * 60 * 1000;
                } else {
                    // Join late: 1-10 minutes after
                    offsetMs = (Math.floor(Math.random() * 10) + 1) * 60 * 1000;
                }

                const sessionStart = new Date(baseTime.getTime() + offsetMs);

                // Session duration 20-50 min (random)
                const sessionDuration = (Math.floor(Math.random() * 31) + 20) * 60 * 1000;
                const sessionEnd = new Date(sessionStart.getTime() + sessionDuration);

                // Session status based on meeting status
                const statusPool = sessionStatusesMap[meeting.meeting_status] || ['scheduled'];
                const sessionStatus = statusPool[Math.floor(Math.random() * statusPool.length)];

                // Platform-based transcript/audio filenames (variety)
                const platform = platforms[Math.floor(Math.random() * platforms.length)];
                const transcriptFile = `transcript_${meeting.id}_${s}_${Math.random().toString(36).substring(2, 6)}.txt`;
                const audioFile = `audio_${meeting.id}_${s}_${Math.random().toString(36).substring(2, 6)}.mp3`;

                // Check if session already exists
                const existing = await getAsync(
                    `SELECT id FROM meeting_sessions WHERE meeting_id = ? AND start_time = ? LIMIT 1`, 
                    [meeting.id, sessionStart.toISOString().replace('T', ' ').substring(0, 19)]
                );
                if (existing) continue;

                // Don't create sessions in the future if meeting is completed
                if (meeting.meeting_status === 'completed' && sessionStart > new Date()) continue;

                await runAsync(
                    `INSERT INTO meeting_sessions (meeting_id, transcript_file_name, audio_file_name, start_time, end_time, status, created_at, updated_at)
                     VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                    [
                        meeting.id,
                        transcriptFile,
                        audioFile,
                        sessionStart.toISOString().replace('T', ' ').substring(0, 19),
                        sessionEnd.toISOString().replace('T', ' ').substring(0, 19),
                        sessionStatus
                    ]
                );
                count++;
            }
        }

        console.log(`[Manual Seeder] ✓ Created ${count} meeting_sessions`);
        console.log(`  - Session start times are 1-10 min before/after meeting actual_start_time`);
        console.log(`  - Session durations are random (20-50 min)`);
        console.log(`  - Status varies: completed/active/scheduled/cancelled/no_show`);
    } catch (err) { console.error('[Manual Seeder] ✗ meeting_sessions seeder failed:', err); process.exit(1); }
};

if (require.main === module) { seedMeetingSessions().then(() => { console.log('\n[Manual Seeder] Process completed.'); process.exit(0); }).catch(err => { console.error('[Manual Seeder] Fatal error:', err); process.exit(1); }); }
module.exports = { seedMeetingSessions };