/**
 * Manual Seeder: transcripts
 * Inserts data ONLY into the transcripts table
 * Run command: node database/manual-seeder/12_seed_transcripts.js
 */
const { runAsync, getAsync, allAsync } = require('../seedHelpers');

const seedTranscripts = async () => {
    console.log('[Manual Seeder] Starting transcripts seeder...');
    try {
        const adminEmail = process.env.ADMIN_EMAIL;
        const adminUser = await getAsync(`SELECT u.id, u.company_id, u.role_id, r.role_name FROM users u LEFT JOIN roles r ON u.role_id = r.id WHERE u.email = ? AND u.status = 'active' LIMIT 1`, [adminEmail]);
        if (!adminUser) { console.log('[Manual Seeder] ⚠ Admin user not found.'); process.exit(1); }

        const sessions = await allAsync(`SELECT ms.id, ms.meeting_id, ms.transcript_file_name FROM meeting_sessions ms JOIN meetings m ON ms.meeting_id = m.id WHERE m.created_by IN (SELECT id FROM users WHERE company_id = ? AND role_id = (SELECT id FROM roles WHERE role_name = 'instructor')) LIMIT 20`, [adminUser.company_id]);
        if (sessions.length === 0) { console.log('[Manual Seeder] ℹ No sessions found. Run 09_seed_meeting_sessions.js first.'); return; }

        let count = 0;
        for (const session of sessions) {
            const existing = await getAsync(`SELECT id FROM transcripts WHERE meeting_id = ? AND session_id = ? LIMIT 1`, [session.meeting_id, session.id]);
            if (existing) continue;
            
            const transcriptText = JSON.stringify([
                { speaker: 'Instructor', text: `Welcome to session ${session.transcript_file_name}`, timestamp: '00:00:00' },
                { speaker: 'Student', text: 'Thank you, ready to learn.', timestamp: '00:00:15' },
                { speaker: 'Instructor', text: 'Great! Let us begin with the fundamentals.', timestamp: '00:00:30' }
            ]);

            await runAsync(
                `INSERT INTO transcripts (meeting_id, session_id, transcript_text, language, duration_seconds, word_count, created_at, updated_at)
                 VALUES (?, ?, ?, 'en-US', 3600, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                [session.meeting_id, session.id, transcriptText, Math.floor(Math.random() * 500 + 200)]
            );
            count++;
        }
        console.log(`[Manual Seeder] ✓ Created ${count} transcripts`);
    } catch (err) { console.error('[Manual Seeder] ✗ transcripts seeder failed:', err); process.exit(1); }
};

if (require.main === module) { seedTranscripts().then(() => { console.log('\n[Manual Seeder] Process completed.'); process.exit(0); }).catch(err => { console.error('[Manual Seeder] Fatal error:', err); process.exit(1); }); }
module.exports = { seedTranscripts };