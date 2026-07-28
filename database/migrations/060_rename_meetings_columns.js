/**
 * Migration: Rename meetings table columns
 * Changes:
 * - meeting_id -> external_meeting_id
 * - start_time -> scheduled_start_time
 * - end_time -> scheduled_end_time
 * - Add actual_start_time
 * - Add actual_end_time
 */
const { runAsync } = require('../seedHelpers');

const migrationName = 'rename_meetings_columns';

const up = async () => {
  console.log('[Migration rename_meetings_columns] Starting...');

  // Check if columns exist before altering
  try {
    // Rename meeting_id to external_meeting_id
    await runAsync(`
      ALTER TABLE meetings 
      CHANGE meeting_id external_meeting_id VARCHAR(255)
    `);
    console.log('[Migration rename_meetings_columns]   ✓ Renamed meeting_id to external_meeting_id');
  } catch (e) {
    console.log('[Migration rename_meetings_columns]   ⚠ meeting_id column rename:', e.message);
  }

  try {
    // Rename start_time to scheduled_start_time
    await runAsync(`
      ALTER TABLE meetings 
      CHANGE start_time scheduled_start_time DATETIME
    `);
    console.log('[Migration rename_meetings_columns]   ✓ Renamed start_time to scheduled_start_time');
  } catch (e) {
    console.log('[Migration rename_meetings_columns]   ⚠ start_time column rename:', e.message);
  }

  try {
    // Rename end_time to scheduled_end_time
    await runAsync(`
      ALTER TABLE meetings 
      CHANGE end_time scheduled_end_time DATETIME
    `);
    console.log('[Migration rename_meetings_columns]   ✓ Renamed end_time to scheduled_end_time');
  } catch (e) {
    console.log('[Migration rename_meetings_columns]   ⚠ end_time column rename:', e.message);
  }

  try {
    // Add actual_start_time column
    await runAsync(`
      ALTER TABLE meetings 
      ADD COLUMN actual_start_time DATETIME NULL AFTER scheduled_end_time
    `);
    console.log('[Migration rename_meetings_columns]   ✓ Added actual_start_time column');
  } catch (e) {
    console.log('[Migration rename_meetings_columns]   ⚠ actual_start_time column add:', e.message);
  }

  try {
    // Add actual_end_time column
    await runAsync(`
      ALTER TABLE meetings 
      ADD COLUMN actual_end_time DATETIME NULL AFTER actual_start_time
    `);
    console.log('[Migration rename_meetings_columns]   ✓ Added actual_end_time column');
  } catch (e) {
    console.log('[Migration rename_meetings_columns]   ⚠ actual_end_time column add:', e.message);
  }

  console.log('[Migration rename_meetings_columns] Complete.');
};

const down = async () => {
  console.log('[Migration rename_meetings_columns] Rolling back...');

  try {
    // Remove actual_end_time
    await runAsync(`ALTER TABLE meetings DROP COLUMN IF EXISTS actual_end_time`);
  } catch (e) {
    console.log('[Migration rename_meetings_columns]   ⚠ Error dropping actual_end_time:', e.message);
  }

  try {
    // Remove actual_start_time
    await runAsync(`ALTER TABLE meetings DROP COLUMN IF EXISTS actual_start_time`);
  } catch (e) {
    console.log('[Migration rename_meetings_columns]   ⚠ Error dropping actual_start_time:', e.message);
  }

  try {
    // Rename scheduled_end_time back to end_time
    await runAsync(`
      ALTER TABLE meetings 
      CHANGE scheduled_end_time end_time DATETIME
    `);
  } catch (e) {
    console.log('[Migration rename_meetings_columns]   ⚠ Error renaming scheduled_end_time:', e.message);
  }

  try {
    // Rename scheduled_start_time back to start_time
    await runAsync(`
      ALTER TABLE meetings 
      CHANGE scheduled_start_time start_time DATETIME
    `);
  } catch (e) {
    console.log('[Migration rename_meetings_columns]   ⚠ Error renaming scheduled_start_time:', e.message);
  }

  try {
    // Rename external_meeting_id back to meeting_id
    await runAsync(`
      ALTER TABLE meetings 
      CHANGE external_meeting_id meeting_id VARCHAR(255)
    `);
  } catch (e) {
    console.log('[Migration rename_meetings_columns]   ⚠ Error renaming external_meeting_id:', e.message);
  }

  console.log('[Migration rename_meetings_columns] Rollback complete.');
};

module.exports = { up, down, migrationName };