/**
 * root/database/seeders/020_admin_rubric.js
 * Seeds admin_rubric_categories and admin_rubric_indicators by cloning the
 * master rubric_categories / rubric_indicators (seeded by 006_rubric.js)
 * for each admin-type user (seeded by 004_super_admin.js / 005_admin_user.js).
 *
 * Each cloned row keeps source = 'master' and links back to the master row
 * via master_category_id / master_indicator_id, so admins start with an
 * editable 1:1 copy of the master rubric.
 *
 * MUST RUN AFTER: 001_roles, 004_super_admin, 005_admin_user, 006_rubric
 */
const { runAsync, getAsync, allAsync } = require('../seedHelpers');

const seedAdminRubric = async () => {
    console.log('[Seed] Starting admin_rubric_categories / admin_rubric_indicators seed...');

    // Admin-type users to clone the master rubric for.
    // Both super_admin and admin get their own editable rubric copy.
    const adminUsers = await allAsync(`
        SELECT users.id, roles.role_name
        FROM users
        LEFT JOIN roles ON roles.id = users.role_id
        WHERE roles.role_name IN ('admin')
    `);

    if (!adminUsers || adminUsers.length === 0) {
        console.log('[Seed] ⚠ No super_admin/admin users found. Run 004_super_admin.js and 005_admin_user.js first. Skipping.');
        return;
    }

    const masterCategories = await allAsync(`SELECT * FROM rubric_categories`);
    if (!masterCategories || masterCategories.length === 0) {
        console.log('[Seed] ⚠ No rubric_categories found. Run 006_rubric.js first. Skipping.');
        return;
    }

    for (const adminUser of adminUsers) {
        const adminUserId = adminUser.id;

        // Idempotent: skip if this admin already has a cloned rubric.
        const existing = await getAsync(
            `SELECT id FROM admin_rubric_categories WHERE admin_user_id = ? LIMIT 1`,
            [adminUserId]
        );
        if (existing) {
            console.log(`[Seed] admin_rubric already seeded for admin_user_id=${adminUserId}, skipping...`);
            continue;
        }

        for (const category of masterCategories) {
            await runAsync(
                `INSERT IGNORE INTO admin_rubric_categories
                    (master_category_id, category_code, admin_user_id, source, name, weight, status)
                 VALUES (?, ?, ?, 'master', ?, ?, ?)`,
                [
                    category.id,
                    category.category_code,
                    adminUserId,
                    category.name,
                    category.weight,
                    category.status
                ]
            );

            // Get the actual DB primary key for this admin's cloned category
            const adminCategoryRow = await getAsync(
                `SELECT id FROM admin_rubric_categories
                 WHERE admin_user_id = ? AND master_category_id = ?
                 LIMIT 1`,
                [adminUserId, category.id]
            );

            if (!adminCategoryRow) {
                console.warn(`[Seed] admin_rubric_categories row not found after insert (admin_user_id=${adminUserId}, master_category_id=${category.id})`);
                continue;
            }

            const adminCategoryId = adminCategoryRow.id;

            const masterIndicators = await allAsync(
                `SELECT * FROM rubric_indicators WHERE category_id = ?`,
                [category.id]
            );

            for (const indicator of masterIndicators) {
                await runAsync(
                    `INSERT IGNORE INTO admin_rubric_indicators
                        (admin_category_id, master_indicator_id, indicator_code, master_category_id,
                         category_code, admin_user_id, source, subgroup_name, name, type,
                         is_gate, value, benchmark, requires_video, status)
                     VALUES (?, ?, ?, ?, ?, ?, 'master', ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        adminCategoryId,
                        indicator.id,
                        indicator.indicator_code,
                        category.id,
                        category.category_code,
                        adminUserId,
                        indicator.subgroup_name,
                        indicator.name,
                        indicator.type,
                        indicator.is_gate,
                        indicator.value,
                        indicator.benchmark,
                        indicator.requires_video,
                        indicator.status
                    ]
                );
            }
        }

        console.log(`[Seed] ✓ Cloned rubric (categories + indicators) for admin_user_id=${adminUserId} (${adminUser.role_name})`);
    }

    console.log('[Seed] ✓ admin_rubric_categories / admin_rubric_indicators seeded successfully');
};

module.exports = { seedAdminRubric };

// Run seeder if executed directly
if (require.main === module) {
  seedAdminRubric()
    .then(() => {
      console.log('[Seed] ✓ Admin rubric seeder completed successfully');
      process.exit(0);
    })
    .catch(err => {
      console.error('[Seed] ✗ Admin rubric seeder failed:', err);
      process.exit(1);
    });
}