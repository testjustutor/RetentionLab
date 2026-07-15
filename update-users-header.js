const { db } = require('./database/db');

db.run(
  'UPDATE header_page_configs SET description = ?, updated_at = CURRENT_TIMESTAMP WHERE page_key = ?',
  ['Manage organization users and roles', 'peopleUsers'],
  function(err) {
    if (err) {
      console.error('Error updating:', err);
    } else {
      console.log('Updated', this.changes, 'row(s)');
    }
    process.exit(0);
  }
);