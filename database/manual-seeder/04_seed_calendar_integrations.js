/**
 * Manual Seeder: calendar_connections (connection/integration side)
 * Inserts connection rows into the merged calendar_connections table.
 * Run command: node database/manual-seeder/04_seed_calendar_integrations.js
 */

const { runAsync, getAsync, allAsync } = require('../seedHelpers');

const seedCalendarIntegrations = async () => {
  console.log('[Manual Seeder] Starting calendar_connections (integrations) seeder...');

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
      console.log('[Manual Seeder] Warning: Admin user not found.');
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

    // provider_id mapping (calendar_providers): 1=zoom, 2=google-meet, 3=teams
    const providerIds = [1, 2, 3];

    let count = 0;

    for (const instructor of instructors) {
      const providerId = providerIds[Math.floor(Math.random() * providerIds.length)];

      const existing = await getAsync(
        `SELECT id
         FROM calendar_connections
         WHERE user_id = ?
           AND provider_id = ?
         LIMIT 1`,
        [instructor.id, providerId]
      );

      if (existing) {
        continue;
      }

      const accessToken =
        'acc_' + Math.random().toString(36).substring(2, 20);

      const refreshToken =
        'ref_' + Math.random().toString(36).substring(2, 20);

      await runAsync(
        `INSERT INTO calendar_connections (
          user_id,
          provider_id,
          access_token,
          refresh_token,
          token_expires_at,
          connection_status,
          created_at,
          updated_at
        )
        VALUES (
          ?,
          ?,
          ?,
          ?,
          DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 30 DAY),
          'active',
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        )`,
        [
          instructor.id,
          providerId,
          accessToken,
          refreshToken
        ]
      );

      count++;
    }

    console.log(
      `[Manual Seeder] Created ${count} calendar_connections (integrations)`
    );
  } catch (err) {
    console.error(
      '[Manual Seeder] calendar_connections (integrations) seeder failed:',
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
