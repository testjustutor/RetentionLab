/**
 * Migration: Create video_processing table
 *
 * Tracks video -> audio conversion and audio-processing jobs in the Super Admin
 * "Video Processing" page.
 *
 * Columns:
 *   id         - auto-increment primary key
 *   file_name  - source file name (e.g. SCREEN_*.mp4, REC_*.mp3)
 *   status     - pending / converting / converted / processing / processed / failed
 *   mp3_path   - filesystem path of the produced/converted MP3
 *   created_at - row creation timestamp
 *
 * Uses CREATE TABLE IF NOT EXISTS so an already-existing table (with real
 * tracking data) is left untouched when the migration runs.
 */
const { runAsync } = require('../seedHelpers');

const migrationName = 'create_video_processing_table';

const up = async () => {
  console.log('[Migration video_processing] Starting...');

  await runAsync(`
    CREATE TABLE IF NOT EXISTS video_processing (
        id INT AUTO_INCREMENT PRIMARY KEY,
        file_name VARCHAR(255) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        mp3_path VARCHAR(500) DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_video_processing_file_name (file_name),
        INDEX idx_video_processing_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('[Migration video_processing] Complete.');
};

const down = async () => {
  await runAsync(`DROP TABLE IF EXISTS video_processing`);
  console.log('[Migration video_processing] Rolled back — video_processing dropped.');
};

module.exports = { up, down, migrationName };
