const db = require('./database/db');

console.log('=== CHECKING SUMMARIES DATA ===');

const query1 = 'SELECT COUNT(*) as total FROM meeting_assets WHERE summary_path IS NOT NULL';
db.all(query1, (err, row) => {
  if (err) { console.error('Error:', err); process.exit(1); }
  console.log('1. Total meeting_assets with summary_path:', row.total);
  
  const query2 = 'SELECT meeting_id, summary_path FROM meeting_assets WHERE summary_path IS NOT NULL LIMIT 5';
  db.all(query2, (err, rows) => {
    if (err) { console.error('Error:', err); process.exit(1); }
    console.log('');
    console.log('2. Sample data:', rows);
    
    const query3 = 'SELECT COUNT(*) as total FROM meetings WHERE created_by IN (SELECT id FROM users WHERE company_id = 1 AND role_id = (SELECT id FROM roles WHERE role_name = \'instructor\'))';
    db.all(query3, (err, row) => {
      if (err) { console.error('Error:', err); process.exit(1); }
      console.log('');
      console.log('3. Total instructor meetings:', row.total);
      
      db.close();
    });
  });
});
