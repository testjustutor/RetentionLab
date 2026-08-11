const { db } = require('./database/db');

console.log('Debugging Transcripts API...');
console.log('===========================\n');

// Check 0: Find the admin user by UUID
console.log('0. Finding admin user by UUID...');
db.all(`
  SELECT u.id, u.email, u.first_name, u.last_name, r.role_name
  FROM users u
  LEFT JOIN roles r ON r.id = u.role_id
  WHERE u.user_uuid = '213a4d18-1e61-4ee0-bac5-bab65ed8d90b'
`, (err, adminUsers) => {
  if (err) {
    console.error('Error finding admin:', err);
    process.exit(0);
  }
  
  if (adminUsers.length === 0) {
    console.log('  ⚠️  Admin user not found by UUID!\n');
    process.exit(0);
  }
  
  const admin = adminUsers[0];
  console.log(`  Found: ${admin.email} (ID: ${admin.id}, Role: ${admin.role_name})\n`);
  
  // Check 1: What instructors does this admin have?
  console.log(`1. Checking instructors created by admin ID ${admin.id}...`);
  db.all(`
    SELECT u.id, u.email, u.first_name, u.last_name, r.role_name
    FROM users u
    LEFT JOIN roles r ON r.id = u.role_id
    WHERE u.created_by = ?
    AND r.role_name IN ('instructor', 'solo_instructor')
    AND u.deleted_at IS NULL
  `, [admin.id], (err, instructors) => {
    if (err) {
      console.error('Error:', err);
      process.exit(0);
    }
    
    console.log(`Found ${instructors.length} instructors:`);
    instructors.forEach(inst => {
      console.log(`  - ${inst.email} (${inst.first_name} ${inst.last_name})`);
    });
    
    if (instructors.length === 0) {
      console.log('  ⚠️  No instructors found! This is why count is 0.\n');
      process.exit(0);
    }
    
    // Check 2: What meetings do these instructors have?
    const emails = instructors.map(i => i.email.toLowerCase());
    const placeholders = emails.map(() => '?').join(',');
    
    console.log('\n2. Checking meetings for these instructors...');
    db.all(`
      SELECT m.id, m.external_meeting_id, m.title, m.status, m.scheduled_start_time
      FROM meetings m
      WHERE LOWER(m.calendar_account) IN (${placeholders})
      AND (m.status = 'completed' OR m.scheduled_end_time < NOW())
      ORDER BY m.scheduled_start_time DESC
      LIMIT 10
    `, emails, (err, meetings) => {
      if (err) {
        console.error('Error:', err);
        process.exit(0);
      }
      
      console.log(`Found ${meetings.length} meetings:`);
      meetings.forEach(m => {
        console.log(`  - Meeting ${m.id}: ${m.title} (${m.status})`);
      });
      
      if (meetings.length === 0) {
        console.log('  ⚠️  No meetings found! This is why count is 0.\n');
        process.exit(0);
      }
      
      // Check 3: Do these meetings have meeting_sessions?
      const meetingIds = meetings.map(m => m.id);
      const sessionPlaceholders = meetingIds.map(() => '?').join(',');
      
      console.log('\n3. Checking meeting_sessions for these meetings...');
      db.all(`
        SELECT meeting_id, COUNT(*) as session_count, 
               GROUP_CONCAT(audio_file_name) as audio_files,
               GROUP_CONCAT(transcript_file_name) as transcript_files
        FROM meeting_sessions
        WHERE meeting_id IN (${sessionPlaceholders})
        GROUP BY meeting_id
      `, meetingIds, (err, sessions) => {
        if (err) {
          console.error('Error:', err);
          process.exit(0);
        }
        
        console.log(`Found sessions for ${sessions.length} meetings:`);
        sessions.forEach(s => {
          console.log(`  - Meeting ${s.meeting_id}: ${s.session_count} sessions`);
          console.log(`    Audio: ${s.audio_files || 'None'}`);
          console.log(`    Transcripts: ${s.transcript_files || 'None'}`);
        });
        
        if (sessions.length === 0) {
          console.log('  ⚠️  No meeting_sessions found! This is why count is 0.\n');
        }
        
        process.exit(0);
      });
    });
  });
});