/**
 * Migration: Add index on ai_audit_results.session_id
 *
 * The video-processing listing runs `SELECT COUNT(*) FROM ai_audit_results
 * WHERE session_id IN (...)` per request. Without an index this is a full
 * table scan (EXPLAIN type=ALL), which gets slower as audit rows accumulate.
 *
 * Uses IF NOT EXISTS so re-running is safe.
 */
const { runAsync } = require('../seedHelpers');

const migrationName = 'add_ai_audit_results_session_index';

const up = async () => {
  console.log('[Migration ai_audit_results session index] Starting...');
  await runAsync(`
    CREATE INDEX idx_ar_session ON ai_audit_results (session_id)
  `).catch((err) => {
    // MySQL: "Duplicate key name" if the index already exists - that's fine.
    if (!/duplicate key name/i.test(err.message || '')) throw err;
    console.log('[Migration ai_audit_results session index] Already exists - skipped.');
  });
  console.log('[Migration ai_audit_results session index] Complete.');
};

const down = async () => {
  await runAsync(`DROP INDEX idx_ar_session ON ai_audit_results`).catch(() => {});
  console.log('[Migration ai_audit_results session index] Rolled back - index dropped.');
};

module.exports = { up, down, migrationName };