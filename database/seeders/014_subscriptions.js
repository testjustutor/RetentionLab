/**
 * root/database/seeders/014_subscriptions.js
 * Seeds subscription plans for the platform
 */
const { runAsync, getAsync } = require('../seedHelpers');

const SUBSCRIPTION_PLANS = [
  {
    plan_type: 'free',
    features_json: JSON.stringify({
      max_users: 5,
      max_meetings: 20,
      max_storage_gb: 5,
      ai_features: false,
      priority_support: false,
      custom_branding: false,
      api_access: false
    })
  },
  {
    plan_type: 'starter',
    features_json: JSON.stringify({
      max_users: 20,
      max_meetings: 100,
      max_storage_gb: 25,
      ai_features: true,
      priority_support: false,
      custom_branding: false,
      api_access: false
    })
  },
  {
    plan_type: 'professional',
    features_json: JSON.stringify({
      max_users: 100,
      max_meetings: 500,
      max_storage_gb: 100,
      ai_features: true,
      priority_support: true,
      custom_branding: true,
      api_access: false
    })
  },
  {
    plan_type: 'enterprise',
    features_json: JSON.stringify({
      max_users: -1, // unlimited
      max_meetings: -1, // unlimited
      max_storage_gb: 500,
      ai_features: true,
      priority_support: true,
      custom_branding: true,
      api_access: true
    })
  }
];

const seedSubscriptions = async () => {
  console.log('[Seed] Starting subscriptions seed...');

  const { count } = await getAsync(`SELECT COUNT(*) as count FROM subscriptions`);
  if (count > 0) {
    console.log(`[Seed] subscriptions already seeded (${count} records found), skipping...`);
    return;
  }

  // Get the first company (or create a default one if none exists)
  let company = await getAsync(`SELECT id FROM companies LIMIT 1`);
  if (!company) {
    console.log('[Seed] No company found, creating default company...');
    const result = await runAsync(
      `INSERT INTO companies (name, slug, is_active, created_at, updated_at)
       VALUES (?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      ['Default Organization', 'default-org']
    );
    company = { id: result.insertId };
  }

  const companyId = company.id;

  // Seed subscription plans
  for (const plan of SUBSCRIPTION_PLANS) {
    await runAsync(
      `INSERT INTO subscriptions (company_id, plan_type, status, start_date, end_date, features_json, created_at, updated_at)
       VALUES (?, ?, 'active', CURRENT_TIMESTAMP, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 1 YEAR), ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [companyId, plan.plan_type, plan.features_json]
    );
  }

  console.log(`[Seed] ✓ subscriptions seeded successfully (${SUBSCRIPTION_PLANS.length} plans)`);
};

module.exports = { seedSubscriptions, SUBSCRIPTION_PLANS };

// Run seeder if executed directly
if (require.main === module) {
  seedSubscriptions()
    .then(() => {
      console.log('[Seed] ✓ Subscriptions seeder completed successfully');
      process.exit(0);
    })
    .catch(err => {
      console.error('[Seed] ✗ Subscriptions seeder failed:', err);
      process.exit(1);
    });
}
