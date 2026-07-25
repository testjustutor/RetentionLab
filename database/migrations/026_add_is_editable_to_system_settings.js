/**
 * Database migration to add is_editable column to existing system_settings table
 */

const { db } = require('../db');

const addIsEditableColumn = async () => {
  try {
    console.log('Adding is_editable column to system_settings table...');
    
    // Check if column already exists
    const checkColumn = await new Promise((resolve, reject) => {
      db.get("SHOW COLUMNS FROM system_settings LIKE 'is_editable'", (err, row) => {
        if (err) return reject(err);
        resolve(row);
      });
    });

    if (checkColumn) {
      console.log('  ✓ is_editable column already exists');
      return;
    }

    // Add the column
    await new Promise((resolve, reject) => {
      db.run("ALTER TABLE system_settings ADD COLUMN is_editable TINYINT(1) DEFAULT 1 AFTER is_static", function(err) {
        if (err) {
          console.error('Error adding is_editable column:', err);
          return reject(err);
        }
        console.log('  ✓ is_editable column added successfully');
        resolve();
      });
    });

    // Add index
    await new Promise((resolve, reject) => {
      db.run("CREATE INDEX idx_editable ON system_settings(is_editable)", function(err) {
        if (err) {
          console.error('Error creating index:', err);
          return reject(err);
        }
        console.log('  ✓ Index on is_editable created');
        resolve();
      });
    });

  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
};

const run = async () => {
  await addIsEditableColumn();
  console.log('✓ Migration completed: is_editable column added to system_settings');
};

if (require.main === module) {
  run();
}

module.exports = { run };