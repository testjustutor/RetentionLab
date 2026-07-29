/**
 * Manual Seeder: Calendar Credentials
 * 
 * This seeder creates realistic calendar integration data for the first instructor
 * created by the admin user. It populates:
 * - calendar_verifications
 * - calendar_integrations
 * - calendar_credentials
 * 
 * Run command: node database/manual-seeder/seed_calendar_credentials.js
 */

const { runAsync, getAsync, allAsync } = require('../seedHelpers');

const seedCalendarCredentials = async () => {
    console.log('[Manual Seeder] Starting calendar credentials seeder...');

    try {
        // Get admin user from env and verify role
        const adminEmail = process.env.ADMIN_EMAIL;
        const adminUser = await getAsync(
            `SELECT u.id, u.company_id, u.role_id, r.role_name 
             FROM users u 
             LEFT JOIN roles r ON u.role_id = r.id 
             WHERE u.email = ? AND u.status = 'active' LIMIT 1`,
            [adminEmail]
        );

        if (!adminUser) {
            console.log('[Manual Seeder] ⚠ Admin user not found. Please run 005_admin_user.js seeder first.');
            process.exit(1);
        }

        // Verify the user has admin role
        if (adminUser.role_name !== 'admin') {
            console.log(`[Manual Seeder] ⚠ User "${adminEmail}" has role "${adminUser.role_name}", not "admin". Aborting.`);
            process.exit(1);
        }

        console.log(`[Manual Seeder] ✓ Verified admin user: ID ${adminUser.id}, Company ID ${adminUser.company_id}`);

        // Get first instructor created by this admin
        const instructor = await getAsync(
            `SELECT id, first_name, last_name, email FROM users 
             WHERE created_by = ? AND role_id = (SELECT id FROM roles WHERE role_name = 'instructor') 
             AND deleted_at IS NULL AND status = 'active' 
             LIMIT 1`,
            [adminUser.id]
        );

        if (!instructor) {
            console.log('[Manual Seeder] ⚠ No instructor found created by this admin. Run 006_test_users.js seeder first.');
            process.exit(1);
        }

        console.log(`[Manual Seeder] ✓ Found instructor: ${instructor.first_name} ${instructor.last_name} (ID: ${instructor.id}, Email: ${instructor.email})`);

        // Get Google provider ID
        const googleProvider = await getAsync(
            `SELECT id FROM calendar_providers WHERE display_name = 'Google Meet' LIMIT 1`
        );

        if (!googleProvider) {
            console.log('[Manual Seeder] ⚠ Google calendar provider not found. Please run 016_calendar_providers.js seeder first.');
            process.exit(1);
        }

        console.log(`[Manual Seeder] ✓ Found Google calendar provider (ID: ${googleProvider.id})`);

        // Check if instructor already has calendar integration
        const existingIntegration = await getAsync(
            `SELECT id FROM calendar_integrations WHERE user_id = ? AND platform = 'google' AND status ='1' `,
            [instructor.id]
        );

        if (existingIntegration) {
            console.log(`[Manual Seeder] Instructor already has Google calendar integration (ID: ${existingIntegration.id}). Skipping...`);
            console.log('[Manual Seeder] ✅ Calendar credentials seeder completed (no changes needed)');
            return;
        }

        // Generate realistic OAuth tokens (simulated)
        const accessToken = Buffer.from(JSON.stringify({
            access_token: "ya29.a0AfB_byABC123xyz789def456ghi789jkl012mno345pqr678stu901vwx234yz",
            token_type: "Bearer",
            expires_in: 3599,
            scope: "https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events",
            refresh_token: "1//03abc123xyz456def789ghi012jkl345mno678pqr901stu234vwx567yz",
            created_at: Math.floor(Date.now() / 1000)
        })).toString('base64');

        const refreshToken = "1//03abc123xyz456def789ghi012jkl345mno678pqr901stu234vwx567yz";
        
        // Token expiry: 1 hour from now
        const tokenExpiry = new Date(Date.now() + 60 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19);
        
        // Create verification record
        const verificationResult = await runAsync(
            `INSERT INTO calendar_verifications 
             (user_id, provider, code, token, status, expires_at, verified_at, connected_at, created_at, updated_at) 
             VALUES (?, ?, ?, ?, 'verified', ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
            [
                instructor.id,
                'google',
                '4/0AZEOVfEabc123xyz456',  // OAuth authorization code
                accessToken,
                new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19),  // expires_at: 24 hours
                new Date().toISOString().replace('T', ' ').substring(0, 19),  // verified_at: now
                new Date().toISOString().replace('T', ' ').substring(0, 19)   // connected_at: now
            ]
        );
        const verificationId = verificationResult.lastID;
        console.log(`[Manual Seeder] ✓ Created calendar verification (ID: ${verificationId})`);

        // Create integration record
        const integrationResult = await runAsync(
            `INSERT INTO calendar_integrations 
             (user_id, platform, provider, provider_id, access_token, refresh_token, expires_at, token_expiry, status, created_at, updated_at) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
            [
                instructor.id,
                'google',
                'google',
                googleProvider.id,
                accessToken,
                refreshToken,
                new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19),  // expires_at: 24 hours
                tokenExpiry  // token_expiry: 1 hour
            ]
        );
        const integrationId = integrationResult.lastID;
        console.log(`[Manual Seeder] ✓ Created calendar integration (ID: ${integrationId})`);

        // Create credentials record with JSON blob
        const credentialsJson = JSON.stringify({
            client_id: process.env.GOOGLE_CLIENT_ID || "365220553177-v1k7ccn0abecc9vednoa81pojp57isgk.apps.googleusercontent.com",
            client_secret: process.env.GOOGLE_CLIENT_SECRET || "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",
            refresh_token: refreshToken,
            access_token: "ya29.a0AfB_byABC123xyz789def456ghi789jkl012mno345pqr678stu901vwx234yz",
            token_expiry: tokenExpiry,
            scope: [
                "https://www.googleapis.com/auth/calendar",
                "https://www.googleapis.com/auth/calendar.events"
            ],
            token_uri: "https://oauth2.googleapis.com/token",
            auth_uri: "https://accounts.google.com/o/oauth2/auth",
            redirect_uris: ["http://localhost:3000/api/calendar/callback"],
            calendar_id: "primary",
            timezone: "America/New_York",
            synced_at: new Date().toISOString()
        });

        const credentialsResult = await runAsync(
            `INSERT INTO calendar_credentials 
             (user_id, provider, credentials_json, is_active, created_at, updated_at) 
             VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
            [instructor.id, 'google', credentialsJson]
        );
        const credentialsId = credentialsResult.lastID;
        console.log(`[Manual Seeder] ✓ Created calendar credentials (ID: ${credentialsId})`);

        console.log('\n[Manual Seeder] ✅ Calendar credentials seeder completed successfully!');
        console.log('\nCreated Calendar Integration for:');
        console.log(`  Instructor: ${instructor.first_name} ${instructor.last_name} (ID: ${instructor.id})`);
        console.log(`  Email: ${instructor.email}`);
        console.log(`  Platform: Google Calendar`);
        console.log(`  Provider ID: ${googleProvider.id}`);
        console.log('\nRecords Created:');
        console.log(`  - calendar_verifications: ID ${verificationId}`);
        console.log(`  - calendar_integrations: ID ${integrationId}`);
        console.log(`  - calendar_credentials: ID ${credentialsId}`);

    } catch (err) {
        console.error('[Manual Seeder] ✗ Calendar credentials seeder failed:', err);
        process.exit(1);
    }
};

// Run seeder if executed directly
if (require.main === module) {
    seedCalendarCredentials()
        .then(() => {
            console.log('\n[Manual Seeder] Process completed.');
            process.exit(0);
        })
        .catch(err => {
            console.error('[Manual Seeder] Fatal error:', err);
            process.exit(1);
        });
}

module.exports = { seedCalendarCredentials };