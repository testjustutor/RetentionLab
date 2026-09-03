/**
 * Manual Seeder: departments
 * Inserts data ONLY into the departments table
 * Run command: node database/manual-seeder/01_seed_departments.js
 */
const { runAsync, getAsync } = require('../seedHelpers');

const seedDepartments = async () => {
    console.log('[Manual Seeder] Starting departments seeder...');
    try {
        const adminEmail = process.env.ADMIN_EMAIL;
        const adminUser = await getAsync(`SELECT u.id, u.company_id, u.role_id, r.role_name FROM users u LEFT JOIN roles r ON u.role_id = r.id WHERE u.email = ? AND u.status = 'active' LIMIT 1`, [adminEmail]);
        if (!adminUser) { console.log('[Manual Seeder] ⚠ Admin user not found.'); process.exit(1); }
        
        const departments = [
            { name: 'Academic Department', description: 'Main academic department' },
            { name: 'Science', description: 'Science subjects department' },
            { name: 'Mathematics', description: 'Mathematics department' },
            { name: 'Languages', description: 'Languages department' },
            { name: 'Humanities', description: 'Humanities department' }
        ];

        let count = 0;
        for (const dept of departments) {
            const existing = await getAsync(`SELECT id FROM departments WHERE company_id = ? AND name = ? LIMIT 1`, [adminUser.company_id, dept.name]);
            if (existing) continue;
            await runAsync(
                `INSERT INTO departments (company_id, created_by, name, description, created_at, updated_at)
                 VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                [adminUser.company_id, adminUser.id, dept.name, dept.description]
            );
            count++;
        }
        console.log(`[Manual Seeder] ✓ Created ${count} departments`);
    } catch (err) { console.error('[Manual Seeder] ✗ departments seeder failed:', err); process.exit(1); }
};

if (require.main === module) { seedDepartments().then(() => { console.log('\n[Manual Seeder] Process completed.'); process.exit(0); }).catch(err => { console.error('[Manual Seeder] Fatal error:', err); process.exit(1); }); }
module.exports = { seedDepartments };