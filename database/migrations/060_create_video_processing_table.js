/**
 * Migration: Create video_processing table
 *
 * Tracks video -> audio conversion and audio-processing jobs in the Super Admin
 * "Video Processing" page. Also acts as a reconciliation table: raw values are
 * parsed from the video's file_name, then matched/resolved against real users,
 * meetings, and sessions tables.
 *
 *
 * NOTE: the filename carries only ONE id (either a meeting id or a session id,
 * never both). video_meeting_type tells you which one it is, so only ONE of
 * video_meeting_id / video_session_id will be populated per row (the other
 * stays NULL). The resolved side (meeting_id / session_id) may still end up
 * with both filled in once a meeting is matched to its session.
 *
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
        video_user_id INT DEFAULT NULL,
        video_meeting_type VARCHAR(50) DEFAULT NULL,
        video_meeting_id INT DEFAULT NULL,
        video_session_id INT DEFAULT NULL,
        file_user_id INT DEFAULT NULL,
        file_meeting_id INT DEFAULT NULL,
        file_session_id INT DEFAULT NULL,
        user_id INT DEFAULT NULL,
        first_name VARCHAR(100) DEFAULT NULL,
        last_name VARCHAR(100) DEFAULT NULL,
        meeting_type VARCHAR(50) DEFAULT NULL,
        meeting_id INT DEFAULT NULL,
        session_id INT DEFAULT NULL,
        external_meeting_id VARCHAR(150) DEFAULT NULL,
        title VARCHAR(255) DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT NULL,
        INDEX idx_video_processing_file_name (file_name),
        INDEX idx_video_processing_status (status),
        INDEX idx_video_processing_user_id (user_id),
        INDEX idx_video_processing_meeting_id (meeting_id),
        INDEX idx_video_processing_session_id (session_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('[Migration video_processing] Complete.');
};
const down = async () => {
  await runAsync(`DROP TABLE IF EXISTS video_processing`);
  console.log('[Migration video_processing] Rolled back — video_processing dropped.');
};
module.exports = { up, down, migrationName };