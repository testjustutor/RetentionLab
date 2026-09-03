/**
 * Migration: Create meeting_session_scores table
 */
const { runAsync } = require('../seedHelpers');

const migrationName = 'create_meeting_session_scores_table';

const up = async () => {
  console.log('[Migration meeting_session_scores] Starting...');

  await runAsync(`
    DROP TABLE IF EXISTS meeting_session_scores
  `);

  await runAsync(`
    CREATE TABLE IF NOT EXISTS meeting_session_scores (
      id INT AUTO_INCREMENT PRIMARY KEY,
      meeting_id INT NOT NULL,
      session_id INT NOT NULL,
      indicator_id INT NULL,
      reviewer_id INT NULL,
      score DECIMAL(5,2) NULL,
      score_type VARCHAR(50) DEFAULT 'AI',
      comment TEXT,
      scored_at DATETIME NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_mss_meeting (meeting_id),
      INDEX idx_mss_session (session_id),
      INDEX idx_mss_indicator (indicator_id),
      INDEX idx_mss_reviewer (reviewer_id),
      CONSTRAINT fk_mss_meeting
        FOREIGN KEY (meeting_id)
        REFERENCES meetings(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
      CONSTRAINT fk_mss_session
        FOREIGN KEY (session_id)
        REFERENCES meeting_sessions(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
    ) ENGINE=InnoDB
      DEFAULT CHARSET=utf8mb4
      COLLATE=utf8mb4_unicode_ci
  `);

  console.log('[Migration meeting_session_scores] Complete.');
};

const down = async () => {
  await runAsync(`
    DROP TABLE IF EXISTS meeting_session_scores
  `);

  console.log(
    '[Migration meeting_session_scores] Rolled back — meeting_session_scores dropped.'
  );
};

module.exports = {
  up,
  down,
  migrationName
};
