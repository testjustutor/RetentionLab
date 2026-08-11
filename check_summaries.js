const db = require('./database/db');

console.log('=== CHECKING SUMMARIES DATA ===\n');

// Check 1: Total meeting_assets with summary_path
db.all('SELECT COUNT(*) as total FROM meeting_assets WHERE summary_path IS NOT NULL AND summary_path != ''''', (err, row) => {
  if (err) { console.error('Error:', err); return; }
  console.log('1. Total meeting_assets with summary_path:', row.total);
  
  // Check 2: Sample data
db.all('SELECT meeting_id, summary_path FROM meeting_assets WHERE summary_path IS NOT NULL LIMIT 5', (err, rows) => {
    if (err) { console.error('Error:', err); return; }
    console.log('\n2. Sample meeting_assets data:');
    console.log(rows);
    
    // Check 3: Total instructor meetings
db.all('SELECT COUNT(*) as total FROM meetings WHERE created_by IN (SELECT id FROM users WHERE company_id = 1 AND role_id = (SELECT id FROM roles WHERE role_name = ''instructor''))', (err, row) => {
      if (err) { console.error('Error:', err); return; }
      console.log('\n3. Total instructor meetings:', row.total);
      
      // Check 4: Check if meeting_id matches
db.all('SELECT m.id as meeting_db_id, m.external_meeting_id, ma.meeting_id as asset_meeting_id, ma.summary_path FROM meetings m LEFT JOIN meeting_assets ma ON ma.meeting_id = m.id WHERE ma.summary_path IS NOT NULL LIMIT 5', (err, rows) => {
        if (err) { console.error('Error:', err); return; }
        console.log('\n4. Meeting ID matching:');
        console.log(rows);
        
        db.close();
      });
    });
  });
});
