/**
 * Migration: Create participant_attendance_sessions table
 *
 * Stores participant attendance and session-level activity.
 */
const { runAsync } = require('../seedHelpers');

const migrationName = 'create_participant_attendance_sessions_table';

const up = async () => {
  console.log('[Migration participant_attendance_sessions] Starting...');

  await runAsync(`
    DROP TABLE IF EXISTS participant_attendance_sessions
  `);

  await runAsync(`
    CREATE TABLE IF NOT EXISTS participant_attendance_sessions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      meeting_id INT NOT NULL,
      session_id INT NOT NULL,
      participant_id INT NOT NULL,
      session_number INT,
      join_sequence INT,
      joined_at DATETIME,
      left_at DATETIME,
      duration_seconds INT,
      total_meeting_duration_seconds INT,
      participant_count_at_join INT,
      attendance_status VARCHAR(50),
      session_status VARCHAR(50),
      deleted_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_pas_meeting (meeting_id),
      INDEX idx_pas_session (session_id),
      INDEX idx_pas_participant (participant_id),
      INDEX idx_pas_deleted_at (deleted_at),
      CONSTRAINT fk_pas_meeting
        FOREIGN KEY (meeting_id)
        REFERENCES meetings(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
      CONSTRAINT fk_pas_session
        FOREIGN KEY (session_id)
        REFERENCES meeting_sessions(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
      CONSTRAINT fk_pas_participant
        FOREIGN KEY (participant_id)
        REFERENCES participants(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
    ) ENGINE=InnoDB
      DEFAULT CHARSET=utf8mb4
      COLLATE=utf8mb4_unicode_ci
  `);

  console.log('[Migration participant_attendance_sessions] Complete.');
};

const down = async () => {
  await runAsync(`
    DROP TABLE IF EXISTS participant_attendance_sessions
  `);

  console.log(
    '[Migration participant_attendance_sessions] Rolled back — participant_attendance_sessions dropped.'
  );
};

module.exports = { up, down, migrationName };
