const http = require('http');
const path = require('path');

// Load the app
const appPath = path.join(__dirname, 'app.js');
require(appPath);

console.log('Server is running. Testing videos API...');
console.log('Please use Postman or browser to test:');
console.log('POST http://localhost:3000/api/admin/content/videos');
console.log('Headers: Authorization: Bearer YOUR_JWT_TOKEN');
console.log('');
console.log('Or test with curl:');
console.log('curl -X POST http://localhost:3000/api/admin/content/videos \');
console.log('  -H "Authorization: Bearer YOUR_JWT_TOKEN" \');
console.log('  -H "Content-Type: application/json" \');
console.log('  -d "{}"');
