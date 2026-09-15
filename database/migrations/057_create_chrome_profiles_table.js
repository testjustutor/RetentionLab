/**
 * Migration: Create chrome_profiles table
 *
 * Tracks every profile directory created under storage/chrome-profiles so
 * profiles can be cleaned up reliably even after Chrome crashes or the
 * server restarts. The lifecycle is driven by services/shared/profileManager.js
 * together with services/shared/browserManager.js:
 *
 *   CREATING -> ACTIVE -> CLOSING -> CLEANED      (normal close)
 *   ACTIVE   -> CLEANUP_PENDING -> CLEANED        (unexpected disconnect)
 *
 * A profile is only marked CLEANED once its directory has actually been
 * deleted and verified as gone from disk.
 */
const { runAsync } = require('../seedHelpers');

const migrationName = 'create_chrome_profiles_table';

const up = async () => {
  console.log('[Migration create_chrome_profiles_table] Starting...');

  await runAsync('DROP TABLE IF EXISTS chrome_profiles');

  await runAsync(`
    CREATE TABLE IF NOT EXISTS chrome_profiles (
      id INT AUTO_INCREMENT PRIMARY KEY,
      profile_name VARCHAR(255) NOT NULL,

      -- Absolute path to the Chrome profile directory on disk.
      profile_path VARCHAR(600) NOT NULL,

      -- Lifecycle state machine:
      --   CREATING        row inserted, directory not created/not ready yet
      --   ACTIVE          Chrome running with this profile
      --   CLOSING         intentional close in progress (browser.close called)
      --   CLEANUP_PENDING unexpected disconnect, or deletion failed; retry later
      --   CLEANED         directory verified gone from disk
      --   FAILED          automatic cleanup retries exhausted
      status ENUM('CREATING','ACTIVE','CLOSING','CLEANUP_PENDING','CLEANED','FAILED')
        NOT NULL DEFAULT 'CREATING',

      browser_pid INT DEFAULT NULL,
      bot_instance_id VARCHAR(255) DEFAULT NULL,
      meeting_id INT(11) DEFAULT NULL,

      cleanup_attempts INT NOT NULL DEFAULT 0,
      last_error TEXT DEFAULT NULL,
      cleanup_completed_at DATETIME DEFAULT NULL,

      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

      INDEX idx_cp_status (status),
      INDEX idx_cp_meeting (meeting_id),
      UNIQUE KEY uq_cp_profile_path (profile_path(300))
    ) ENGINE=InnoDB
      DEFAULT CHARSET=utf8mb4
      COLLATE=utf8mb4_unicode_ci
  `);

  console.log('[Migration create_chrome_profiles_table] Complete.');
};

const down = async () => {
  await runAsync('DROP TABLE IF EXISTS chrome_profiles');
  console.log('[Migration create_chrome_profiles_table] Rolled back - chrome_profiles dropped.');
};

module.exports = { up, down, migrationName };
