/**
 * Migration: Add rubric detail columns to ai_audit_results
 *
 * Adds dedicated columns so the AI rubric review data (category name + weight,
 * indicator name + value, gate flag, per-indicator evidence) is stored directly
 * on each ai_audit_results row — not only embedded in the ai_raw_response JSON.
 *
 * Uses ADD COLUMN IF NOT EXISTS so re-running is safe (MariaDB / MySQL 8.0.29+).
 */
const { runAsync, getAsync } = require('../seedHelpers');

const migrationName = 'add_rubric_detail_columns_to_ai_audit_results';

const COLUMNS = [
  // column, definition
  ['category_name',    'VARCHAR(255) DEFAULT NULL'],
  ['category_weight',  'DECIMAL(5,2) DEFAULT 0.00'],
  ['indicator_name',   'VARCHAR(255) DEFAULT NULL'],
  ['indicator_value',  'DECIMAL(5,2) DEFAULT 1.00'],
  ['is_gate',          'TINYINT(1) DEFAULT 0'],
  ['ai_evidence',      'TEXT DEFAULT NULL']
];

const up = async () => {
  console.log('[Migration ai_audit_results cols] Starting...');
  for (const [name, def] of COLUMNS) {
    // Check existence via INFORMATION_SCHEMA (works on MySQL + MariaDB).
    const exists = await getAsync(
      `SELECT 1 AS x FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ai_audit_results' AND COLUMN_NAME = ?`,
      [name]
    );
    if (exists) {
      console.log(`  ↻ ai_audit_results.${name} already exists, skipping`);
      continue;
    }
    try {
      await runAsync(`ALTER TABLE ai_audit_results ADD COLUMN ${name} ${def}`);
      console.log(`  ✓ added ai_audit_results.${name}`);
    } catch (e) {
      console.warn(`  ⚠ ${name}: ${e.message}`);
    }
  }
  console.log('[Migration ai_audit_results cols] Complete.');
};

const down = async () => {
  for (const [name] of COLUMNS) {
    try {
      await runAsync(`ALTER TABLE ai_audit_results DROP COLUMN ${name}`);
    } catch (e) { /* ignore */ }
  }
  console.log('[Migration ai_audit_results cols] Rolled back.');
};

module.exports = { up, down, migrationName };
