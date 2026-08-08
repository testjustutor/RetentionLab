/**
 * Manual Seeder: participants
 * Inserts data ONLY into the participants table
 * Run command: node database/manual-seeder/10_seed_participants.js
 */
const { runAsync, getAsync, allAsync } = require('../seedHelpers');

const seedParticipants = async () => {
    console.log('[Manual Seeder] Starting participants seeder...');
    try {
        const adminEmail = process.env.ADMIN_EMAIL;
        const adminUser = await getAsync(`SELECT u.id, u.company_id, u.role_id, r.role_name FROM users u LEFT JOIN roles r ON u.role_id = r.id WHERE u.email = ? AND u.status = 'active' LIMIT 1`, [adminEmail]);
        if (!adminUser) { console.log('[Manual Seeder] ⚠ Admin user not found.'); process.exit(1); }

        const meetings = await allAsync(`SELECT id FROM meetings WHERE created_by IN (SELECT id FROM users WHERE company_id = ? AND role_id = (SELECT id FROM roles WHERE role_name = 'instructor')) LIMIT 20`, [adminUser.company_id]);
        if (meetings.length === 0) { console.log('[Manual Seeder] ℹ No meetings found. Run 08_seed_meetings.js first.'); return; }

        let count = 0;
        for (const meeting of meetings) {
            const numParticipants = Math.floor(Math.random() * 4) + 2;
            for (let p = 0; p < numParticipants; p++) {
                const participantEmail = `participant${p + 1}@example.com`;
                const existing = await getAsync(`SELECT id FROM participants WHERE meeting_id = ? AND participant_email = ? LIMIT 1`, [meeting.id, participantEmail]);
                if (existing) continue;
                await runAsync(
                    `INSERT INTO participants (meeting_id, participant_name, participant_email, participant_role, join_time, created_at, updated_at)
                     VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                    [meeting.id, `Participant ${p + 1}`, participantEmail, 'student']
                );
                count++;
            }
        }
        console.log(`[Manual Seeder] ✓ Created ${count} participants`);
    } catch (err) { console.error('[Manual Seeder] ✗ participants seeder failed:', err); process.exit(1); }
};

if (require.main === module) { seedParticipants().then(() => { console.log('\n[Manual Seeder] Process completed.'); process.exit(0); }).catch(err => { console.error('[Manual Seeder] Fatal error:', err); process.exit(1); }); }
module.exports = { seedParticipants };