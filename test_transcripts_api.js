/**
 * Test script for /api/admin/content/transcripts endpoint
 * Run with: node test_transcripts_api.js
 */

const http = require('http');

const HOST = 'localhost';
const PORT = 3000;
const API_PATH = '/api/admin/content/transcripts';

function makeRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });
    
    req.on('error', reject);
    
    if (body) {
      req.write(JSON.stringify(body));
    }
    
    req.end();
  });
}

async function testTranscriptsAPI() {
  console.log('Testing transcripts API...\n');
  
  // Test 1: POST with minimal data (should return 401 without auth)
  console.log('Test 1: POST without authentication');
  try {
    const result = await makeRequest({
      hostname: HOST,
      port: PORT,
      path: API_PATH,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    }, {});
    
    console.log(`  Status: ${result.status}`);
    console.log(`  Response: ${JSON.stringify(result.data, null, 2)}\n`);
  } catch (err) {
    console.log(`  Error: ${err.message}\n`);
  }
  
  // Test 2: POST with test loggedInUser (should return 401 - user not found)
  console.log('Test 2: POST with test loggedInUser');
  try {
    const result = await makeRequest({
      hostname: HOST,
      port: PORT,
      path: API_PATH,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    }, {
      loggedInUser: 'test-user-uuid',
      limit: 50
    });
    
    console.log(`  Status: ${result.status}`);
    console.log(`  Response: ${JSON.stringify(result.data, null, 2)}\n`);
  } catch (err) {
    console.log(`  Error: ${err.message}\n`);
  }
  
  // Test 3: POST with filters
  console.log('Test 3: POST with date filters');
  try {
    const result = await makeRequest({
      hostname: HOST,
      port: PORT,
      path: API_PATH,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    }, {
      loggedInUser: 'test-user-uuid',
      startDate: '2024-01-01',
      endDate: '2024-12-31',
      limit: 10
    });
    
    console.log(`  Status: ${result.status}`);
    console.log(`  Response: ${JSON.stringify(result.data, null, 2)}\n`);
  } catch (err) {
    console.log(`  Error: ${err.message}\n`);
  }
  
  console.log('Tests completed!');
  console.log('\nNote: To test with a real user, replace "test-user-uuid" with a valid user UUID from your database.');
  console.log('You can find user UUIDs in the users table or by logging in through the frontend and checking localStorage.');
}

// Check if server is running
makeRequest({
  hostname: HOST,
  port: PORT,
  path: '/api/health',
  method: 'GET'
}).then(() => {
  testTranscriptsAPI();
}).catch(() => {
  console.error('Error: Server is not running on port', PORT);
  console.log('Please start the server first: node server.js');
  process.exit(1);
});
