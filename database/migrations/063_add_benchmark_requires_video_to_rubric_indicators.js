/**
 * Migration: Add benchmark + requires_video columns to rubric_indicators
 *
 * Adds the benchmark (TEXT) and requires_video (TINYINT) columns used by the
 * AI audit/evaluation rubric prompt. These were previously added imperatively
 * from the rubric seeder (006_rubric.js) at seed time; this migration moves them
 * into the versioned migration set. Non-destructive (INFORMATION_SCHEMA check).
 */
const { runAsync, getAsync } = require('../seedHelpers');

const migrationName = 'add_benchmark_requires_video_to_rubric_indicators';

const COLUMNS = [
  ['benchmark',      'TEXT NULL AFTER value'],
  ['requires_video', 'TINYINT(1) DEFAULT 0 AFTER benchmark']
];

const up = async () => {
  console.log(`[Migration ${migrationName}] Starting...`);
  for (const [name, def] of COLUMNS) {
    const exists = await getAsync(
      `SELECT 1 AS x FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'rubric_indicators' AND COLUMN_NAME = ?`,
      [name]
    );
    if (exists) {
      console.log(`  ↻ rubric_indicators.${name} already exists, skipping`);
      continue;
    }
    await runAsync(`ALTER TABLE rubric_indicators ADD COLUMN ${name} ${def}`);
    console.log(`  ✓ added rubric_indicators.${name}`);
  }
  console.log(`[Migration ${migrationName}] Complete.`);
};

const down = async () => {
  for (const [name] of COLUMNS) {
    try {
      await runAsync(`ALTER TABLE rubric_indicators DROP COLUMN ${name}`);
    } catch (e) { /* ignore if missing */ }
  }
  console.log(`[Migration ${migrationName}] Rolled back.`);
};

module.exports = { up, down, migrationName };