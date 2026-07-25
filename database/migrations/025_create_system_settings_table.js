/**
 * Database migration for system_settings table
 * Creates table if it doesn't exist
 */

const { db } = require('../db');

const createSystemSettingsTable = async () => {
  try {
    console.log('Creating system_settings table...');
    
    const sql = `
      CREATE TABLE IF NOT EXISTS system_settings (
        id INT PRIMARY KEY AUTO_INCREMENT,
        company_id INT NULL,
        setting_key VARCHAR(255) NOT NULL,
        setting_value TEXT,
        setting_type VARCHAR(50) DEFAULT 'string',
        is_static TINYINT(1) DEFAULT 0,
        is_editable TINYINT(1) DEFAULT 1,
        editable_by_role VARCHAR(255) NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_setting_key (setting_key),
        INDEX idx_company_id (company_id),
        INDEX idx_static (is_static),
        INDEX idx_editable (is_editable),
        UNIQUE KEY unique_setting (company_id, setting_key)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    
    await new Promise((resolve, reject) => {
      db.run(sql, function(err) {
        if (err) {
          console.error('Error creating system_settings table:', err);
          return reject(err);
        }
        console.log('✓ system_settings table created/verified');
        resolve();
      });
    });
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
};

const createUserSettingsTable = async () => {
  console.log('Creating user_settings table...');
  
  const sql = `
    CREATE TABLE IF NOT EXISTS user_settings (
      id INT PRIMARY KEY AUTO_INCREMENT,
      user_id INT NOT NULL,
      setting_key VARCHAR(255) NOT NULL,
      setting_value TEXT,
      setting_type VARCHAR(50) DEFAULT 'string',
      editable_by_role VARCHAR(255) NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_user_id (user_id),
      INDEX idx_setting_key (setting_key),
      UNIQUE KEY unique_user_setting (user_id, setting_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `;
  
  await new Promise((resolve, reject) => {
    db.run(sql, function(err) {
      if (err) {
        console.error('Error creating user_settings table:', err);
        return reject(err);
      }
      console.log('✓ user_settings table created/verified');
      resolve();
    });
  });
};

// Run migrations
const run = async () => {
  await createSystemSettingsTable();
  await createUserSettingsTable();
  console.log('✓ All settings tables migration completed');
};

// Run if called directly
if (require.main === module) {
  run();
}

module.exports = { run };