/**
 * Manual Seeder: meetings
 * Inserts data ONLY into the meetings table
 * 
 * Creates meetings for the last 30 days:
 * - One meeting per day (running day-wise loop backwards)
 * - Each meeting has random scheduled_start_time/end_time (exactly 60 min duration)
 * - Random actual_start_time/actual_end_time for completed meetings
 * - Random platform, status, timezone, passcode
 * 
 * Run command: node database/manual-seeder/06_seed_meetings.js
 */
const { runAsync, getAsync, allAsync } = require('../seedHelpers');

const seedMeetings = async () => {
    console.log('[Manual Seeder] Starting meetings seeder...');
    try {
        const adminEmail = process.env.ADMIN_EMAIL;
        const adminUser = await getAsync(`SELECT u.id, u.company_id FROM users u WHERE u.email = ? AND u.status = 'active' LIMIT 1`, [adminEmail]);
        if (!adminUser) { console.log('[Manual Seeder] ⚠ Admin user not found.'); process.exit(1); }

        const instructors = await allAsync(`SELECT id, first_name, last_name, email FROM users WHERE company_id = ? AND role_id = (SELECT id FROM roles WHERE role_name = 'instructor') AND status = 'active' LIMIT 10`, [adminUser.company_id]);
        if (instructors.length === 0) { console.log('[Manual Seeder] ℹ No instructors found. Run 02_seed_users.js first.'); return; }

        const platforms = ['zoom', 'google-meet', 'teams'];
        const statuses = ['sync'];
        const subjects = ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'English', 'History', 'Geography', 'Computer Science', 'Economics', 'Psychology'];
        const timezones = ['UTC', 'America/New_York', 'America/Los_Angeles', 'Europe/London', 'Asia/Tokyo', 'Asia/Kolkata', 'Australia/Sydney', 'Europe/Berlin'];

        let count = 0;

        // Day-wise loop: last 30 days (each day gets a set of meetings)
        for (let dayOffset = 30; dayOffset >= 1; dayOffset--) {
            const day = new Date();
            day.setDate(day.getDate() - dayOffset); // Start from 30 days ago

            // Create a meeting for EACH instructor on this day (or a random subset)
            for (const instructor of instructors) {
                // Skip randomly to create variety (each instructor doesn't have meetings every day)
                if (Math.random() < 0.4) continue; // 40% chance skip

                // Random time of day for scheduled_start_time (between 8:00 AM and 6:00 PM)
                const startHour = Math.floor(Math.random() * 10) + 8; // 8-17
                const startMinute = Math.floor(Math.random() * 4) * 15; // 0,15,30,45
                
                const scheduledStart = new Date(day);
                scheduledStart.setHours(startHour, startMinute, 0, 0);

                // Scheduled end = exactly 60 minutes after scheduled start
                const scheduledEnd = new Date(scheduledStart.getTime() + 60 * 60 * 1000);

                // Actual start/end times - only for completed/active meetings
                // Random - can start a few min early/late
                const status = statuses[Math.floor(Math.random() * statuses.length)];

                let actualStart = null;
                let actualEnd = null;

                if (status === 'sync') {
                    // Actual start can be 5-15 min after scheduled start, OR 5-10 min early
                    const earlyOrLate = Math.random();
                    let actualStartOffset = 0;
                    if (earlyOrLate < 0.3) {
                        actualStartOffset = -(Math.floor(Math.random() * 6) + 5) * 60 * 1000; // 5-10 min early
                    } else {
                        actualStartOffset = (Math.floor(Math.random() * 11) + 5) * 60 * 1000; // 5-15 min late
                    }
                    actualStart = new Date(scheduledStart.getTime() + actualStartOffset);
                }

                if (status === 'sync') {
                    // Actual duration can be 40-75 min (random)
                    const actualDuration = (Math.floor(Math.random() * 36) + 40) * 60 * 1000; // 40-75 min
                    actualEnd = new Date(actualStart.getTime() + actualDuration);
                }

                const title = `Session - ${subjects[Math.floor(Math.random() * subjects.length)]} - ${instructor.last_name} - ${dayOffset}d ago`;
                const externalMeetingId = `meeting_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
                const eventId = `event_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
                const platform = platforms[Math.floor(Math.random() * platforms.length)];
                const timezone = timezones[Math.floor(Math.random() * timezones.length)];
                const passcode = Math.random().toString(36).substring(2, 10).toUpperCase();

                let meetingLink = '';
                if (platform === 'zoom') meetingLink = `https://zoom.us/j/${externalMeetingId.split('_')[1]}?pwd=${passcode}`;
                else if (platform === 'google-meet') meetingLink = `https://meet.google.com/${externalMeetingId.split('_')[1]}`;
                else if (platform === 'teams') meetingLink = `https://teams.microsoft.com/l/meetup-join/${externalMeetingId.split('_')[1]}`;

                const existing = await getAsync(`SELECT id FROM meetings WHERE title = ? AND created_by = ? LIMIT 1`, [title, instructor.id]);
                if (existing) continue;

                await runAsync(
                    `INSERT INTO meetings (title, description, scheduled_start_time, scheduled_end_time, actual_start_time, actual_end_time, platform, calendar_account, meeting_link, passcode, event_id, timezone, status, external_meeting_id, created_by, created_at, updated_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                    [
                        title,
                        `Interactive learning session on ${subjects[Math.floor(Math.random() * subjects.length)]} covering key concepts and practice problems`,
                        scheduledStart.toISOString().replace('T', ' ').substring(0, 19),
                        scheduledEnd.toISOString().replace('T', ' ').substring(0, 19),
                        actualStart ? actualStart.toISOString().replace('T', ' ').substring(0, 19) : null,
                        actualEnd ? actualEnd.toISOString().replace('T', ' ').substring(0, 19) : null,
                        platform,
                        instructor.email,
                        meetingLink,
                        passcode,
                        eventId,
                        timezone,
                        status,
                        externalMeetingId,
                        instructor.id
                    ]
                );
                count++;
            }
        }

        console.log(`[Manual Seeder] ✓ Created ${count} meetings across last 30 days`);
        console.log(`  - Each meeting is 60 minutes (scheduled)`);
        console.log(`  - Random scheduled start times between 8AM-6PM`);
        console.log(`  - Random actual start/end times for completed/active meetings`);
    } catch (err) { console.error('[Manual Seeder] ✗ meetings seeder failed:', err); process.exit(1); }
};

if (require.main === module) { seedMeetings().then(() => { console.log('\n[Manual Seeder] Process completed.'); process.exit(0); }).catch(err => { console.error('[Manual Seeder] Fatal error:', err); process.exit(1); }); }
module.exports = { seedMeetings };