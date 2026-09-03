/**
 * Manual Seeder: Super Admin Reports menu items + role menu permissions
 * Adds a "Reports" section to the Super Admin sidebar with a
 * "Meeting AI Evaluation" link (route /super_admin/reports/meeting-ai-evaluation-report).
 * Idempotent: skips any menu_key already present.
 * Run command: node database/manual-seeder/24_seed_sa_reports_menu.js
 */
const { runAsync, getAsync } = require('../seedHelpers');
const MenuModel = require('../../models/super_admin/menu/MenuModel');

const REPORTS_MENU_KEY = 'sa-reports';
const REPORT_CHILD_MENU_KEY = 'sa-meeting-ai-evaluation';

const seedSaReportsMenu = async () => {
  console.log('[Manual Seeder] Starting Super Admin Reports menu seeder...');
  try {
    // Resolve the super_admin role id.
    const role = await getAsync(
      "SELECT id FROM roles WHERE role_name = 'super_admin' LIMIT 1"
    );
    if (!role) {
      console.log('[Manual Seeder] ⚠ super_admin role not found.');
      process.exit(1);
    }

    // 1) Upsert the parent "Reports" menu item (role_id from super_admin role).
    let reportsItem = await getAsync(
      'SELECT id FROM menu_items WHERE menu_key = ? LIMIT 1',
      [REPORTS_MENU_KEY]
    );
    if (!reportsItem) {
      const res = await runAsync(
        `INSERT INTO menu_items (menu_key, label, icon, route_path, parent_id, sort_order, is_active, role_id)
         VALUES (?, 'Reports', 'bar-chart', NULL, NULL, 6, 1, ?)`,
        [REPORTS_MENU_KEY, role.id]
      );
      reportsItem = { id: res.lastID };
      console.log(`[Manual Seeder] ✓ Created menu item ${REPORTS_MENU_KEY} (id=${reportsItem.id})`);
    } else {
      console.log(`[Manual Seeder] ↻ Menu item ${REPORTS_MENU_KEY} already exists (id=${reportsItem.id})`);
    }

    // 2) Upsert the child "Meeting AI Evaluation" menu item.
    let childItem = await getAsync(
      'SELECT id FROM menu_items WHERE menu_key = ? LIMIT 1',
      [REPORT_CHILD_MENU_KEY]
    );
    if (!childItem) {
      const res = await runAsync(
        `INSERT INTO menu_items (menu_key, label, icon, route_path, parent_id, sort_order, is_active, role_id)
         VALUES (?, 'Meeting AI Evaluation', NULL, '/super_admin/reports/meeting-ai-evaluation-report', ?, 1, 1, ?)`,
        [REPORT_CHILD_MENU_KEY, reportsItem.id, role.id]
      );
      childItem = { id: res.lastID };
      console.log(`[Manual Seeder] ✓ Created menu item ${REPORT_CHILD_MENU_KEY} (id=${childItem.id})`);
    } else {
      console.log(`[Manual Seeder] ↻ Menu item ${REPORT_CHILD_MENU_KEY} already exists (id=${childItem.id})`);
    }

    // 3) Upsert role_menu_permissions for the parent (parent_id NULL).
    let reportsPerm = await getAsync(
      'SELECT id FROM role_menu_permissions WHERE role_id = ? AND menu_item_id = ? LIMIT 1',
      [role.id, reportsItem.id]
    );
    if (!reportsPerm) {
      const res = await runAsync(
        `INSERT INTO role_menu_permissions (role_id, menu_item_id, is_visible, sort_order, parent_id)
         VALUES (?, ?, 1, 0, NULL)`,
        [role.id, reportsItem.id]
      );
      reportsPerm = { id: res.lastID };
      console.log(`[Manual Seeder] ✓ Created permission for ${REPORTS_MENU_KEY} (perm id=${reportsPerm.id})`);
    } else {
      console.log(`[Manual Seeder] ↻ Permission for ${REPORTS_MENU_KEY} already exists (id=${reportsPerm.id})`);
    }

    // 4) Upsert role_menu_permissions for the child (parent_id = reports permission id).
    const childPerm = await getAsync(
      'SELECT id FROM role_menu_permissions WHERE role_id = ? AND menu_item_id = ? LIMIT 1',
      [role.id, childItem.id]
    );
    if (!childPerm) {
      await runAsync(
        `INSERT INTO role_menu_permissions (role_id, menu_item_id, is_visible, sort_order, parent_id)
         VALUES (?, ?, 1, 1, ?)`,
        [role.id, childItem.id, reportsPerm.id]
      );
      console.log(`[Manual Seeder] ✓ Created permission for ${REPORT_CHILD_MENU_KEY}`);
    } else {
      console.log(`[Manual Seeder] ↻ Permission for ${REPORT_CHILD_MENU_KEY} already exists (id=${childPerm.id})`);
    }

    // 5) Clear the in-memory menu cache so the sidebar reflects the change immediately.
    MenuModel.clearAllCache();

    console.log('[Manual Seeder] ✓ Super Admin Reports menu seeded successfully');
  } catch (err) {
    console.error('[Manual Seeder] ✗ Super Admin Reports menu seeder failed:', err);
    process.exit(1);
  }
};

if (require.main === module) {
  seedSaReportsMenu()
    .then(() => { console.log('\n[Manual Seeder] Process completed.'); process.exit(0); })
    .catch((err) => { console.error('[Manual Seeder] Fatal error:', err); process.exit(1); });
}
module.exports = { seedSaReportsMenu };