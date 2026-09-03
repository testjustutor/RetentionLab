/**
 * Migration: Create rubric_audit_log table
 */
const { runAsync } = require('../seedHelpers');

const migrationName = 'create_rubric_audit_log_table';

const up = async () => {
  console.log('[Migration rubric_audit_log] Starting...');

  await runAsync(
    `DROP TABLE IF EXISTS rubric_audit_log`
  );

  await runAsync(`
          CREATE TABLE IF NOT EXISTS rubric_audit_log (
            id INT AUTO_INCREMENT PRIMARY KEY,
            action VARCHAR(50) NOT NULL,
            entity_type VARCHAR(50) NOT NULL,
            entity_id VARCHAR(255),
            admin_user_id INT,
            performed_by INT NOT NULL,
            old_values TEXT,
            new_values TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_ral_performed (performed_by),
            INDEX idx_ral_entity (entity_type, entity_id)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`);

  console.log('[Migration rubric_audit_log] Complete.');
};

const down = async () => {
  await runAsync(`DROP TABLE IF EXISTS rubric_audit_log`);
  console.log('[Migration rubric_audit_log] Rolled back — rubric_audit_log dropped.');
};

module.exports = { up, down, migrationName };
