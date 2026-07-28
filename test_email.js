/**
 * Test email sending functionality
 */
const { sendMail } = require('./utils/mailer');

async function testEmail() {
  console.log('🧪 Testing email sending...\n');

  try {
    console.log('1. Sending test email...');
    const result = await sendMail({
      to: 'test.justtutors@gmail.com',
      subject: 'Test Email from RetentionLab',
      text: 'This is a test email to verify SMTP configuration.',
      html: '<h1>Test Email</h1><p>This is a test email to verify SMTP configuration.</p>',
      purpose: 'test'
    });
    
    console.log('   ✓ Email sent successfully!');
    console.log('   Message ID:', result.messageId);
    console.log('\n✅ Email test passed!');
    process.exit(0);
  } catch (error) {
    console.error('   ❌ Email test failed:', error.message);
    console.error('   Full error:', error);
    process.exit(1);
  }
}

// Run test
testEmail();