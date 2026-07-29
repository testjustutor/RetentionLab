/**
 * Manual Seeder: Meetings
 * 
 * This seeder creates realistic meeting data for the first instructor
 * created by the admin user.
 * 
 * Run command: node database/manual-seeder/seed_meetings.js
 */

const { runAsync, getAsync } = require('../seedHelpers');

const seedMeetings = async () => {
    console.log('[Manual Seeder] Starting meetings seeder...');

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

        // Define realistic meetings with different timezones
        const meetings = [
            {
                title: 'Q4 2026 Tutoring Session - Mathematics',
                description: 'Quarterly review and planning session for mathematics tutoring program',
                platform: 'zoom',
                scheduled_start_time: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19),  // 2 days from now
                scheduled_end_time: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19),  // +1 hour
                status: 'scheduled',
                external_meeting_id: '845-1234-5678',
                meeting_link: 'https://us05web.zoom.us/wc/join/84512345678',
                passcode: 'Tutoring2026!',
                event_id: 'evt_' + Date.now() + '_1',
                timezone: 'America/New_York'
            },
            {
                title: 'Student Progress Review - Science',
                description: 'Monthly progress review meeting with student and parents',
                platform: 'google_meet',
                scheduled_start_time: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19),  // 5 days from now
                scheduled_end_time: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000 + 45 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19),  // +45 mins
                status: 'scheduled',
                external_meeting_id: 'abc-defg-hij',
                meeting_link: 'https://meet.google.com/abc-defg-hij',
                passcode: null,
                event_id: 'evt_' + Date.now() + '_2',
                timezone: 'Europe/London'
            },
            {
                title: 'Past Session - English Literature Discussion',
                description: 'Completed session on Shakespeare literature analysis',
                platform: 'zoom',
                scheduled_start_time: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19),  // 7 days ago
                scheduled_end_time: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19),
                actual_start_time: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19),
                actual_end_time: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000 + 58 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19),
                status: 'completed',
                external_meeting_id: '845-9876-5432',
                meeting_link: 'https://us05web.zoom.us/wc/join/84598765432',
                passcode: 'English2026!',
                event_id: 'evt_' + (Date.now() - 7 * 24 * 60 * 60 * 1000) + '_3',
                timezone: 'Asia/Kolkata'
            }
        ];

        const createdMeetings = [];

        for (const meeting of meetings) {
            // Check if meeting already exists
            const existing = await getAsync(
                `SELECT id FROM meetings WHERE event_id = ? AND created_by = ?`,
                [meeting.event_id, instructor.id]
            );

            if (existing) {
                console.log(`[Manual Seeder] Meeting "${meeting.title}" already exists (ID: ${existing.id})`);
                createdMeetings.push({ ...meeting, id: existing.id });
                continue;
            }

            const result = await runAsync(
                `INSERT INTO meetings 
                 (external_meeting_id, title, description, scheduled_start_time, scheduled_end_time, 
                  actual_start_time, actual_end_time, platform, meeting_link, passcode, event_id, 
                  timezone, status, created_by, created_at, updated_at) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                [
                    meeting.external_meeting_id,
                    meeting.title,
                    meeting.description,
                    meeting.scheduled_start_time,
                    meeting.scheduled_end_time,
                    meeting.actual_start_time || null,
                    meeting.actual_end_time || null,
                    meeting.platform,
                    meeting.meeting_link,
                    meeting.passcode,
                    meeting.event_id,
                    meeting.timezone,
                    meeting.status,
                    instructor.id
                ]
            );

            const meetingId = result.lastID;
            console.log(`[Manual Seeder] ✓ Created meeting: "${meeting.title}" (ID: ${meetingId}, Status: ${meeting.status})`);
            createdMeetings.push({ ...meeting, id: meetingId });
        }

        console.log('\n[Manual Seeder] ✅ Meetings seeder completed successfully!');
        console.log(`\nTotal meetings created: ${createdMeetings.length}`);
        createdMeetings.forEach(m => {
            console.log(`  - ${m.title} (ID: ${m.id}, Status: ${m.status})`);
        });

    } catch (err) {
        console.error('[Manual Seeder] ✗ Meetings seeder failed:', err);
        process.exit(1);
    }
};

// Run seeder if executed directly
if (require.main === module) {
    seedMeetings()
        .then(() => {
            console.log('\n[Manual Seeder] Process completed.');
            process.exit(0);
        })
        .catch(err => {
            console.error('[Manual Seeder] Fatal error:', err);
            process.exit(1);
        });
}

module.exports = { seedMeetings };