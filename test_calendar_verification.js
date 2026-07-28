/**
 * Test script for CalendarVerificationModel
 * Tests the updated model with user_id instead of email
 */
const CalendarVerificationModel = require('./models/calendar/CalendarVerificationModel');
const UsersModel = require('./models/users/UsersModel');

async function testCalendarVerification() {
  console.log('🧪 Testing CalendarVerificationModel with user_id...\n');

  try {
    // Test 1: Get an existing user directly from database
    console.log('1. Getting existing user...');
    const { db } = require('./database/db');
    const user = await new Promise((resolve, reject) => {
      db.get('SELECT id, email FROM users WHERE deleted_at IS NULL LIMIT 1', (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    if (!user) {
      throw new Error('No users found in database. Please create a user first.');
    }
    console.log(`   ✓ Using user: id=${user.id}, email=${user.email}\n`);

    // Test 2: Create verification with user_id
    console.log('2. Creating verification record with user_id...');
    const verification = await CalendarVerificationModel.create(user.id);
    console.log(`   ✓ Created verification: id=${verification.id}, userId=${verification.user_id}, token=${verification.token?.substring(0, 20)}...\n`);

    // Test 3: Get verification by user_id
    console.log('3. Getting verification by user_id...');
    const byUserId = await CalendarVerificationModel.getByUserId(user.id);
    console.log(`   ✓ Found verification: id=${byUserId.id}, userId=${byUserId.user_id}\n`);

    // Test 4: Get verification by token
    console.log('4. Getting verification by token...');
    const byToken = await CalendarVerificationModel.getByToken(verification.token);
    console.log(`   ✓ Found verification: id=${byToken.id}, token=${byToken.token?.substring(0, 20)}...\n`);

    // Test 5: Update token by user_id
    console.log('5. Updating token by user_id...');
    const newToken = 'new_test_token_' + Date.now();
    const updated = await CalendarVerificationModel.updateTokenByUserId(user.id, newToken);
    console.log(`   ✓ Updated verification: id=${updated.id}, newToken=${updated.token?.substring(0, 20)}...\n`);

    // Test 6: Verify token
    console.log('6. Verifying token...');
    const verified = await CalendarVerificationModel.verifyToken(newToken);
    console.log(`   ✓ Verified: id=${verified.id}, status=${verified.status}\n`);

    // Test 7: Mark as connected
    console.log('7. Marking as connected...');
    const connected = await CalendarVerificationModel.markAsConnected(newToken);
    console.log(`   ✓ Connected: id=${connected.id}, status=${connected.status}\n`);

    // Test 8: Clean up
    console.log('8. Cleaning up test data...');
    await CalendarVerificationModel.deleteByUserId(user.id);
    console.log('   ✓ Test data cleaned up\n');

    console.log('✅ All tests passed! CalendarVerificationModel works correctly with user_id.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run tests
testCalendarVerification();