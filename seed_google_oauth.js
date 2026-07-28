/**
 * Seed Google OAuth credentials from .env file to database
 */
require('dotenv').config();
const GoogleOAuthCredentialsModel = require('./models/calendar/GoogleOAuthCredentialsModel');

async function seedGoogleOAuth() {
  console.log('🌱 Seeding Google OAuth credentials from .env...\n');

  try {
    const config = {
      project_id: process.env.GOOGLE_PROJECT_ID || null,
      auth_uri: process.env.GOOGLE_AUTH_URI || 'https://accounts.google.com/o/oauth2/v2/auth',
      token_uri: process.env.GOOGLE_TOKEN_URI || 'https://oauth2.googleapis.com/token',
      auth_provider_x509_cert_url: process.env.GOOGLE_AUTH_PROVIDER_x509_CERT_URL || 'https://www.googleapis.com/oauth2/v1/certs',
      redirect_uris: process.env.GOOGLE_REDIRECT_URIS 
        ? process.env.GOOGLE_REDIRECT_URIS.split(',').map(uri => uri.trim())
        : ['http://localhost:3000/api/calendar/callback'],
      javascript_origins: process.env.GOOGLE_JAVASCRIPT_ORIGINS
        ? process.env.GOOGLE_JAVASCRIPT_ORIGINS.split(',').map(uri => uri.trim())
        : []
    };

    console.log('Configuration to seed:');
    console.log(JSON.stringify(config, null, 2));

    const result = await GoogleOAuthCredentialsModel.saveCredentials(config);
    
    console.log('\n✅ Google OAuth credentials seeded successfully!');
    console.log('   ID:', result.id);
    console.log('   Project ID:', result.project_id);
    console.log('   Auth URI:', result.auth_uri);
    console.log('   Token URI:', result.token_uri);
    console.log('   Redirect URIs:', JSON.stringify(result.redirect_uris));
    console.log('   JavaScript Origins:', JSON.stringify(result.javascript_origins));
    console.log('   Is Active:', result.is_active);
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Failed to seed Google OAuth credentials:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

// Run seeder
seedGoogleOAuth();