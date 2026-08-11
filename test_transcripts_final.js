const http = require('http');

const postData = JSON.stringify({
  loggedInUser: '213a4d18-1e61-4ee0-bac5-bab65ed8d90b'
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/admin/content/transcripts',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData),
    'x-user-id': '1',
    'x-user-role': 'admin',
    'x-user-company': '1'
  }
};

console.log('Testing Transcripts API...');
console.log('=======================\n');

const req = http.request(options, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('Status Code:', res.statusCode);
    console.log('\nFull Response:');
    console.log(data);
    
    try {
      const json = JSON.parse(data);
      if (json.success) {
        console.log('\n✓ SUCCESS!');
        console.log('Total transcripts:', json.count);
        
        if (json.transcripts && json.transcripts.length > 0) {
          console.log('\nFirst 3 transcripts:');
          json.transcripts.slice(0, 3).forEach((transcript, index) => {
            console.log(`\n${index + 1}. ${transcript.title}`);
            console.log(`   has_transcript: ${transcript.has_transcript}`);
            console.log(`   view_url: ${transcript.view_url}`);
            console.log(`   status: ${transcript.status}`);
            console.log(`   start_time: ${transcript.start_time}`);
            console.log(`   end_time: ${transcript.end_time}`);
          });
          
          // Count how many have transcripts
          const withTranscripts = json.transcripts.filter(t => t.has_transcript).length;
          console.log(`\n\nSummary:`);
          console.log(`  Total: ${json.count}`);
          console.log(`  With transcripts: ${withTranscripts}`);
          console.log(`  Without transcripts: ${json.count - withTranscripts}`);
        } else {
          console.log('\nNo transcripts found in response');
        }
      } else {
        console.log('\n✗ API Error:', json.error || json.message);
      }
    } catch (e) {
      console.error('Error parsing JSON:', e);
    }
  });
});

req.on('error', (e) => {
  console.error('Request error:', e);
});

req.write(postData);
req.end();