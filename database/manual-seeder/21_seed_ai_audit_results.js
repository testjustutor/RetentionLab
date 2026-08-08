/**
 * Manual Seeder: ai_audit_results
 * Inserts data ONLY into the ai_audit_results table
 * Run command: node database/manual-seeder/23_seed_ai_audit_results.js
 */
const { runAsync, getAsync, allAsync } = require('../seedHelpers');

const seedAiAuditResults = async () => {
    console.log('[Manual Seeder] Starting ai_audit_results seeder...');
    try {
        const adminEmail = process.env.ADMIN_EMAIL;
        const adminUser = await getAsync(`SELECT u.id, u.company_id FROM users u WHERE u.email = ? AND u.status = 'active' LIMIT 1`, [adminEmail]);
        if (!adminUser) { console.log('[Manual Seeder] ⚠ Admin user not found.'); process.exit(1); }

        const sessions = await allAsync(`SELECT ms.id, ms.meeting_id FROM meeting_sessions ms JOIN meetings m ON ms.meeting_id = m.id WHERE m.created_by IN (SELECT id FROM users WHERE company_id = ? AND role_id = (SELECT id FROM roles WHERE role_name = 'instructor')) LIMIT 20`, [adminUser.company_id]);
        if (sessions.length === 0) { console.log('[Manual Seeder] ℹ No sessions found.'); return; }

        let count = 0;
        for (const session of sessions) {
            const existing = await getAsync(`SELECT id FROM ai_audit_results WHERE session_id = ? LIMIT 1`, [session.id]);
            if (existing) continue;
            const oqiScore = (Math.random() * 3 + 7).toFixed(2);
            await runAsync(
                `INSERT INTO ai_audit_results (session_id, category_id, indicator_id, ai_score, ai_max_score, ai_raw_response, oqi_score, evidence_quote, talk_ratio, scored_at, created_at, updated_at)
                 VALUES (?, 1, 1, ?, 10, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                [session.id, (Math.random() * 3 + 6).toFixed(1), JSON.stringify({ response: 'AI generated audit', confidence: 0.9 }), oqiScore, 'Good clarity and structure in teaching', Math.random().toFixed(2)]
            );
            count++;
        }
        console.log(`[Manual Seeder] ✓ Created ${count} ai_audit_results`);
    } catch (err) { console.error('[Manual Seeder] ✗ ai_audit_results seeder failed:', err); process.exit(1); }
};

if (require.main === module) { seedAiAuditResults().then(() => { console.log('\n[Manual Seeder] Process completed.'); process.exit(0); }).catch(err => { console.error('[Manual Seeder] Fatal error:', err); process.exit(1); }); }
module.exports = { seedAiAuditResults };