/**
 * Manual Seeder: Additional Super Admin page headers
 * Ensures header_page_configs rows exist for these super_admin pages so the
 * top-of-page header shows a title + description:
 *   - permissionRubrics       (people/manage-rubrics)
 *   - botConfiguration        (settings/bot-configuration)
 *   - aiProviders             (settings/ai-providers)
 * Idempotent: inserts missing rows, updates existing ones.
 * Run command: node database/manual-seeder/26_seed_sa_more_page_headers.js
 */
const { runAsync, getAsync } = require('../seedHelpers');

const PAGES = [
  {
    page_key: 'permissionRubrics',
    title: 'Manage Rubrics',
    description: 'Create, manage, and assign rubric categories and indicators.',
    role_title: 'Super Admin'
  },
  {
    page_key: 'botConfiguration',
    title: 'Bot Configuration',
    description: 'Configure default bot behavior, join rules, and recording settings.',
    role_title: 'Super Admin'
  },
  {
    page_key: 'aiProviders',
    title: 'AI Providers',
    description: 'Manage connected AI provider credentials and model settings.',
    role_title: 'Super Admin'
  }
];

const seedSaMorePageHeaders = async () => {
  console.log('[Manual Seeder] Starting additional Super Admin page header seeder...');
  try {
    const role = await getAsync("SELECT id FROM roles WHERE role_name = 'super_admin' LIMIT 1");
    if (!role) {
      console.log('[Manual Seeder] ⚠ super_admin role not found.');
      process.exit(1);
    }

    for (const page of PAGES) {
      const existing = await getAsync(
        'SELECT id FROM header_page_configs WHERE role_id = ? AND page_key = ? AND deleted_at IS NULL LIMIT 1',
        [role.id, page.page_key]
      );

      if (existing) {
        await runAsync(
          `UPDATE header_page_configs
             SET title = ?, description = ?, role_title = ?, show_stats = 0,
                 is_active = 1, is_deleted = 0, deleted_at = NULL
           WHERE id = ?`,
          [page.title, page.description, page.role_title, existing.id]
        );
        console.log(`[Manual Seeder] ↻ Updated header page config ${page.page_key} (id=${existing.id})`);
      } else {
        await runAsync(
          `INSERT INTO header_page_configs
             (role_id, page_key, title, description, role_title, show_stats, buttons_json, is_deleted, is_active, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 0, '[]', 0, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          [role.id, page.page_key, page.title, page.description, page.role_title]
        );
        console.log(`[Manual Seeder] ✓ Created header page config ${page.page_key}`);
      }
    }

    console.log('[Manual Seeder] ✓ Additional Super Admin page headers seeded successfully');
  } catch (err) {
    console.error('[Manual Seeder] ✗ Additional Super Admin page header seeder failed:', err);
    process.exit(1);
  }
};

if (require.main === module) {
  seedSaMorePageHeaders()
    .then(() => { console.log('\n[Manual Seeder] Process completed.'); process.exit(0); })
    .catch((err) => { console.error('[Manual Seeder] Fatal error:', err); process.exit(1); });
}
module.exports = { seedSaMorePageHeaders };