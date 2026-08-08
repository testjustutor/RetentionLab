/**
 * Manual Seeder: department_members
 * Inserts data ONLY into the department_members table
 * Run command: node database/manual-seeder/24_seed_department_members.js
 */
const { runAsync, getAsync, allAsync } = require('../seedHelpers');

const seedDepartmentMembers = async () => {
    console.log('[Manual Seeder] Starting department_members seeder...');
    try {
        const adminEmail = process.env.ADMIN_EMAIL;
        const adminUser = await getAsync(`SELECT u.id, u.company_id FROM users u WHERE u.email = ? AND u.status = 'active' LIMIT 1`, [adminEmail]);
        if (!adminUser) { console.log('[Manual Seeder] ⚠ Admin user not found.'); process.exit(1); }

        const departments = await allAsync(`SELECT id FROM departments WHERE company_id = ? LIMIT 5`, [adminUser.company_id]);
        const instructors = await allAsync(`SELECT id, role_id FROM users WHERE company_id = ? AND role_id = (SELECT id FROM roles WHERE role_name = 'instructor') AND status = 'active' LIMIT 10`, [adminUser.company_id]);
        if (departments.length === 0 || instructors.length === 0) { console.log('[Manual Seeder] ℹ Departments or instructors not found.'); return; }

        let count = 0;
        for (const instructor of instructors) {
            const dept = departments[Math.floor(Math.random() * departments.length)];
            const existing = await getAsync(`SELECT id FROM department_members WHERE department_id = ? AND user_id = ? LIMIT 1`, [dept.id, instructor.id]);
            if (existing) continue;
            await runAsync(
                `INSERT INTO department_members (department_id, user_id, role_id, joined_by, status, created_by, joined_at, created_at, updated_at)
                 VALUES (?, ?, ?, ?, 'active', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                [dept.id, instructor.id, instructor.role_id, adminUser.id, adminUser.id]
            );
            count++;
        }
        console.log(`[Manual Seeder] ✓ Created ${count} department_members`);
    } catch (err) { console.error('[Manual Seeder] ✗ department_members seeder failed:', err); process.exit(1); }
};

if (require.main === module) { seedDepartmentMembers().then(() => { console.log('\n[Manual Seeder] Process completed.'); process.exit(0); }).catch(err => { console.error('[Manual Seeder] Fatal error:', err); process.exit(1); }); }
module.exports = { seedDepartmentMembers };