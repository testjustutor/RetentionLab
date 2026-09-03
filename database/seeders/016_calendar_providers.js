/**
 * root/database/seeders/016_calendar_providers.js
 * Seeds calendar providers (Zoom, Google Meet, Teams, etc.)
 */
const { runAsync, getAsync } = require('../seedHelpers');

const CALENDAR_PROVIDERS = [
  {
    name: 'zoom',
    display_name: 'Zoom',
    is_active: 1,
    config_json: JSON.stringify({
      auth_url: 'https://zoom.us/oauth/authorize',
      token_url: 'https://zoom.us/oauth/token',
      scopes: ['meeting:write:admin', 'meeting:read:admin'],
      join_strategy: 'webclient',
      requires_passcode: true
    })
  },
  {
    name: 'google-meet',
    display_name: 'Google Meet',
    is_active: 1,
    config_json: JSON.stringify({
      auth_url: 'https://accounts.google.com/o/oauth2/v2/auth',
      token_url: 'https://oauth2.googleapis.com/token',
      scopes: ['https://www.googleapis.com/auth/calendar.readonly', 'https://www.googleapis.com/auth/calendar.events'],
      join_strategy: 'direct-link',
      requires_passcode: false
    })
  },
  {
    name: 'teams',
    display_name: 'Microsoft Teams',
    is_active: 1,
    config_json: JSON.stringify({
      auth_url: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
      token_url: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      scopes: ['Calendars.ReadWrite', 'OnlineMeetings.ReadWrite'],
      join_strategy: 'direct-link',
      requires_passcode: false
    })
  }
];

const seedCalendarProviders = async () => {
  console.log('[Seed] Starting calendar_providers seed...');

  const { count } = await getAsync(`SELECT COUNT(*) as count FROM calendar_providers`);
  if (count > 0) {
    console.log(`[Seed] calendar_providers already seeded (${count} records found), skipping...`);
    return;
  }

  for (const provider of CALENDAR_PROVIDERS) {
    await runAsync(
      `INSERT INTO calendar_providers (name, display_name, is_active, config_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [provider.name, provider.display_name, provider.is_active, provider.config_json]
    );
  }

  console.log(`[Seed] ✓ calendar_providers seeded successfully (${CALENDAR_PROVIDERS.length} providers)`);
};

module.exports = { seedCalendarProviders, CALENDAR_PROVIDERS };

// Run seeder if executed directly
if (require.main === module) {
  seedCalendarProviders()
    .then(() => {
      console.log('[Seed] ✓ Calendar providers seeder completed successfully');
      process.exit(0);
    })
    .catch(err => {
      console.error('[Seed] ✗ Calendar providers seeder failed:', err);
      process.exit(1);
    });
}
