/**
 * Migration: Create user_settings table
 */
const { runAsync } = require('../seedHelpers');

const migrationName = 'create_user_settings_table';

const up = async () => {
  console.log('[Migration user_settings] Starting...');

  await runAsync(
    `DROP TABLE IF EXISTS user_settings`
  );

  await runAsync(`
CREATE TABLE IF NOT EXISTS user_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    setting_key VARCHAR(255) NOT NULL,
    setting_value TEXT,
    setting_type VARCHAR(50) DEFAULT 'string',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_user_setting (user_id, setting_key),
    INDEX idx_us_user (user_id),
    INDEX idx_us_key (setting_key)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`);

  console.log('[Migration user_settings] Complete.');
};

const down = async () => {
  await runAsync(`DROP TABLE IF EXISTS user_settings`);
  console.log('[Migration user_settings] Rolled back — user_settings dropped.');
};

module.exports = { up, down, migrationName };
