 /**
  * Manual Seeder: calendar_integrations
  * Inserts data ONLY into the calendar_integrations table
  * Run command: node database/manual-seeder/06_seed_calendar_integrations.js
  */

const { runAsync, getAsync, allAsync } = require('../seedHelpers');

const seedCalendarIntegrations = async () => {
  console.log('[Manual Seeder] Starting calendar_integrations seeder...');

  try {
    const adminEmail = process.env.ADMIN_EMAIL;

    const adminUser = await getAsync(
      `SELECT u.id, u.company_id
       FROM users u
       WHERE u.email = ?
         AND u.status = 'active'
       LIMIT 1`,
      [adminEmail]
    );

    if (!adminUser) {
      console.log('[Manual Seeder] ⚠ Admin user not found.');
      process.exit(1);
    }

    const instructors = await allAsync(
      `SELECT id
       FROM users
       WHERE company_id = ?
         AND role_id = (
           SELECT id
           FROM roles
           WHERE role_name = 'instructor'
           LIMIT 1
         )
         AND status = 'active'
       LIMIT 5`,
      [adminUser.company_id]
    );

    // provider_id mapping:
    // 1 = zoom
    // 2 = google
    // 3 = microsoft
    const platforms = {
      1: 'zoom',
      2: 'google',
      3: 'microsoft'
    };

    const providerIds = Object.keys(platforms).map(Number);

    let count = 0;

    for (const instructor of instructors) {
      const existing = await getAsync(
        `SELECT id
         FROM calendar_integrations
         WHERE user_id = ?
         LIMIT 1`,
        [instructor.id]
      );

      if (existing) {
        continue;
      }

      // Random provider ID: 1, 2, or 3
      const providerId =
        providerIds[Math.floor(Math.random() * providerIds.length)];

      // Provider name based on provider_id
      const platform = platforms[providerId];

      const provider =
        platform === 'zoom'
          ? 'zoom'
          : platform === 'google'
            ? 'google_calendar'
            : 'microsoft_teams';

      const accessToken =
        'acc_' + Math.random().toString(36).substring(2, 20);

      const refreshToken =
        'ref_' + Math.random().toString(36).substring(2, 20);

      await runAsync(
        `INSERT INTO calendar_integrations (
          user_id,
          platform,
          provider,
          provider_id,
          access_token,
          refresh_token,
          expires_at,
          token_expiry,
          status,
          created_at,
          updated_at
        )
        VALUES (
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 30 DAY),
          DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 30 DAY),
          'active',
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        )`,
        [
          instructor.id,
          platform,
          provider,
          providerId,
          accessToken,
          refreshToken
        ]
      );

      count++;
    }

    console.log(
      `[Manual Seeder] ✓ Created ${count} calendar_integrations`
    );
  } catch (err) {
    console.error(
      '[Manual Seeder] ✗ calendar_integrations seeder failed:',
      err
    );

    process.exit(1);
  }
};

if (require.main === module) {
  seedCalendarIntegrations()
    .then(() => {
      console.log('\n[Manual Seeder] Process completed.');
      process.exit(0);
    })
    .catch(err => {
      console.error('[Manual Seeder] Fatal error:', err);
      process.exit(1);
    });
}

module.exports = { seedCalendarIntegrations };