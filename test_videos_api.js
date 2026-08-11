// Test script for videos API
const axios = require('axios');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('Enter your JWT token: ', async (token) => {
  try {
    console.log('\nTesting videos API...\n');
    
    const response = await axios.post('http://localhost:3000/api/admin/content/videos', 
      {},
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('? API Response:');
    console.log(JSON.stringify(response.data, null, 2));
    
    if (response.data.success && response.data.count > 0) {
      console.log('\n? SUCCESS! Found', response.data.count, 'recordings');
      console.log('\nFirst recording:');
      console.log(JSON.stringify(response.data.recordings[0], null, 2));
    } else {
      console.log('\n? No recordings found');
      console.log('Possible reasons:');
      console.log('  1. No data in meeting_assets table with video_path or audio_path');
      console.log('  2. Admin user has no meetings created');
      console.log('  3. Date filters are excluding your data');
    }
    
  } catch (error) {
    console.error('\n? Error:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error(error.message);
    }
  }
  
  rl.close();
});
