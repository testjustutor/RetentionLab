/**
 * Migration: Create session_diarization table
 *
 * Stores per-session diarization output (talk_ratio + speaker segments).
 * Diarization runs as a manual/on-demand process (services/engine/manual/
 * run_diarization.py), NOT as a pipeline task. The manual script writes a
 * row for the chosen meeting/session whenever the user runs it.
 *
 * Uses CREATE TABLE IF NOT EXISTS so re-running is safe.
 */
const { runAsync } = require('../seedHelpers');

const migrationName = 'create_session_diarization_table';

const up = async () => {
  console.log('[Migration session_diarization] Starting...');

  await runAsync(`
    CREATE TABLE IF NOT EXISTS session_diarization (
        id INT AUTO_INCREMENT PRIMARY KEY,
        meeting_id INT NOT NULL,
        session_id INT NOT NULL,
        talk_ratio JSON DEFAULT NULL,
        speaker_segments JSON DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_session_diarization (session_id),
        INDEX idx_sd_meeting (meeting_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('[Migration session_diarization] Complete.');
};

const down = async () => {
  await runAsync(`DROP TABLE IF EXISTS session_diarization`);
  console.log('[Migration session_diarization] Rolled back — session_diarization dropped.');
};

module.exports = { up, down, migrationName };