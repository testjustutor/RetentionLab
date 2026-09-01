/**
 * Migration: Create participants table
 * Includes all columns from subsequent fix migrations (062)
 *
 * FIX 4: added UNIQUE KEY on (meeting_id, session_id, participant_name) so
 * INSERT IGNORE in ParticipantModel.recordParticipantJoin() actually has
 * something to ignore against. Without it, INSERT IGNORE inserted a fresh
 * row every single call, silently duplicating a participant if the same
 * join event fired twice (e.g. tracker lost its in-memory entry and
 * treated a known participant as a first join again).
 */
const { runAsync } = require('../seedHelpers');

const migrationName = 'create_participants_table';

const up = async () => {
  console.log('[Migration participants] Starting...');

  await runAsync(`
    DROP TABLE IF EXISTS participants
  `);

  await runAsync(`
    CREATE TABLE IF NOT EXISTS participants (
      id INT AUTO_INCREMENT PRIMARY KEY,
      meeting_id INT NOT NULL,
      session_id INT NOT NULL,
      participant_name VARCHAR(255),
      participant_email VARCHAR(255),
      participant_role VARCHAR(50),
      join_time DATETIME,
      leave_time DATETIME,
      deleted_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_participants_meeting_session_name (meeting_id, session_id, participant_name),
      INDEX idx_part_meeting (meeting_id),
      INDEX idx_part_session (session_id),
      INDEX idx_part_deleted_at (deleted_at),
      CONSTRAINT fk_participants_meeting
        FOREIGN KEY (meeting_id)
        REFERENCES meetings(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
      CONSTRAINT fk_participants_session
        FOREIGN KEY (session_id)
        REFERENCES meeting_sessions(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
    ) ENGINE=InnoDB
      DEFAULT CHARSET=utf8mb4
      COLLATE=utf8mb4_unicode_ci
  `);

  console.log('[Migration participants] Complete.');
};

const down = async () => {
  await runAsync(`DROP TABLE IF EXISTS participants`);
  console.log('[Migration participants] Rolled back — participants dropped.');
};

module.exports = { up, down, migrationName };