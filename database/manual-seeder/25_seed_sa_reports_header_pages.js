/**
 * Manual Seeder: Super Admin Meeting AI report header page configs
 * Adds header_page_configs rows for the super_admin reports pages so the
 * top-of-page header shows a proper title + description:
 *   - reportsMeetingAiEvaluation (main list page)
 *   - reportsMeetingAiSession    (session detail page)
 * Idempotent: inserts missing rows, updates existing ones.
 * Run command: node database/manual-seeder/25_seed_sa_reports_header_pages.js
 */
const { runAsync, getAsync } = require('../seedHelpers');

const PAGES = [
  {
    page_key: 'reportsMeetingAiEvaluation',
    title: 'Meeting AI Evaluation Report',
    description: 'AI-generated rubric audit results per meeting session',
    role_title: 'Super Admin'
  },
  {
    page_key: 'reportsMeetingAiSession',
    title: 'Meeting AI Session Report',
    description: 'Full AI-generated audit detail for a single session',
    role_title: 'Super Admin'
  }
];

const seedSaReportsHeaderPages = async () => {
  console.log('[Manual Seeder] Starting Super Admin reports header page config seeder...');
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

    console.log('[Manual Seeder] ✓ Super Admin reports header page configs seeded successfully');
  } catch (err) {
    console.error('[Manual Seeder] ✗ Super Admin reports header page config seeder failed:', err);
    process.exit(1);
  }
};

if (require.main === module) {
  seedSaReportsHeaderPages()
    .then(() => { console.log('\n[Manual Seeder] Process completed.'); process.exit(0); })
    .catch((err) => { console.error('[Manual Seeder] Fatal error:', err); process.exit(1); });
}
module.exports = { seedSaReportsHeaderPages };