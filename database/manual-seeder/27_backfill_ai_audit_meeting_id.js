/**
 * Manual Seeder: Backfill ai_audit_results.meeting_id with the real meetings.id
 *
 * Before, the AI engine wrote the filename-derived value (e.g.
 * "ebn-cmyx-wwa_Sess1_2026-07-27_14-57") into ai_audit_results.meeting_id.
 * Now the engine resolves the real numeric meetings.id (via meeting_sessions).
 * This script backfills any existing rows that still have a non-numeric
 * meeting_id by resolving through meeting_sessions (session_id -> meeting_id).
 *
 * Run command: node database/manual-seeder/27_backfill_ai_audit_meeting_id.js
 */
const { getAsync, allAsync, runAsync } = require('../seedHelpers');

const backfillAiAuditMeetingId = async () => {
  console.log('[Manual Seeder] Starting ai_audit_results.meeting_id backfill...');
  try {
    // All ai_audit_results rows whose session_id is numeric (real meeting_sessions.id)
    // but whose meeting_id is NOT purely numeric (i.e. the filename-derived value).
    const rows = await allAsync(
      `SELECT id, meeting_id, session_id
         FROM ai_audit_results
        WHERE session_id IS NOT NULL
          AND session_id REGEXP '^[0-9]+$'
          AND (meeting_id IS NULL OR meeting_id NOT REGEXP '^[0-9]+$')`
    );

    console.log(`[Manual Seeder] Found ${rows.length} rows to backfill.`);
    if (rows.length === 0) {
      console.log('[Manual Seeder] Nothing to do.');
      return;
    }

    let updated = 0;
    for (const row of rows) {
      const session = await getAsync(
        'SELECT meeting_id FROM meeting_sessions WHERE id = ? LIMIT 1',
        [Number(row.session_id)]
      );
      if (!session || !session.meeting_id) {
        console.log(`[Manual Seeder] ↻ Skipping id=${row.id} (session ${row.session_id} not found in meeting_sessions)`);
        continue;
      }
      await runAsync(
        'UPDATE ai_audit_results SET meeting_id = ? WHERE id = ?',
        [String(session.meeting_id), row.id]
      );
      updated++;
    }

    console.log(`[Manual Seeder] ✓ Updated ${updated} ai_audit_results meeting_id rows.`);
  } catch (err) {
    console.error('[Manual Seeder] ✗ ai_audit_results meeting_id backfill failed:', err);
    process.exit(1);
  }
};

if (require.main === module) {
  backfillAiAuditMeetingId()
    .then(() => { console.log('\n[Manual Seeder] Process completed.'); process.exit(0); })
    .catch((err) => { console.error('[Manual Seeder] Fatal error:', err); process.exit(1); });
}
module.exports = { backfillAiAuditMeetingId };