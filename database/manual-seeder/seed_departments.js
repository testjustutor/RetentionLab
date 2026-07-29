/**
 * Manual Seeder: Departments
 * 
 * This seeder creates professional departments for the admin user
 * and adds the admin user as a member of those departments.
 * 
 * Run command: node database/manual-seeder/seed_departments.js
 */

const { runAsync, getAsync, allAsync } = require('../seedHelpers');

const seedDepartments = async () => {
    console.log('[Manual Seeder] Starting department seeder...');

    try {
        // Get admin user from env and verify role
        const adminEmail = process.env.ADMIN_EMAIL;
        const adminUser = await getAsync(
            `SELECT u.id, u.company_id, u.role_id, r.role_name 
             FROM users u 
             LEFT JOIN roles r ON u.role_id = r.id 
             WHERE u.email = ? AND u.status = 'active' LIMIT 1`,
            [adminEmail]
        );

        if (!adminUser) {
            console.log('[Manual Seeder] ⚠ Admin user not found. Please run 005_admin_user.js seeder first.');
            process.exit(1);
        }

        // Verify the user has admin role
        if (adminUser.role_name !== 'admin') {
            console.log(`[Manual Seeder] ⚠ User "${adminEmail}" has role "${adminUser.role_name}", not "admin". Aborting.`);
            process.exit(1);
        }

        console.log(`[Manual Seeder] ✓ Verified admin user: ID ${adminUser.id}, Company ID ${adminUser.company_id}, Role: ${adminUser.role_name}`);

        // Get admin role id for department membership
        const adminRole = await getAsync(`SELECT id FROM roles WHERE role_name = 'admin' LIMIT 1`);
        if (!adminRole) {
            console.log('[Manual Seeder] ⚠ Admin role not found in roles table.');
            process.exit(1);
        }

        // Get all users created by this admin (include their role_id)
        const usersCreatedByAdmin = await allAsync(
            `SELECT id, first_name, last_name, email, role_id FROM users WHERE created_by = ? AND deleted_at IS NULL AND status = 'active'`,
            [adminUser.id]
        );

        if (usersCreatedByAdmin.length === 0) {
            console.log('[Manual Seeder] ⚠ No users found created by this admin. Run seeders first to create test users.');
            process.exit(1);
        }

        console.log(`[Manual Seeder] Found ${usersCreatedByAdmin.length} user(s) created by admin:`);
        for (const u of usersCreatedByAdmin) {
            console.log(`   - ${u.first_name} ${u.last_name} (ID: ${u.id}, Email: ${u.email})`);
        }

        // Define professional departments
        const departments = [
            {
                name: 'Engineering & Technology',
                description: 'Responsible for software development, system architecture, infrastructure management, and technical innovation. Handles all coding, DevOps, and technology stack decisions.'
            },
            {
                name: 'Operations & Administration',
                description: 'Manages day-to-day business operations, administrative tasks, process optimization, and cross-functional coordination. Ensures smooth workflow across all departments.'
            }
        ];

        const createdDepartments = [];

        // Create departments
        for (const dept of departments) {
            // Check if department already exists
            const existingDept = await getAsync(
                `SELECT id FROM departments WHERE name = ? AND company_id = ? AND deleted_at IS NULL`,
                [dept.name, adminUser.company_id]
            );

            let departmentId;
            if (existingDept) {
                console.log(`[Manual Seeder] Department "${dept.name}" already exists (ID: ${existingDept.id})`);
                departmentId = existingDept.id;
            } else {
                const result = await runAsync(
                    `INSERT INTO departments (company_id, created_by, name, description, created_at, updated_at) 
                     VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                    [adminUser.company_id, adminUser.id, dept.name, dept.description]
                );
                departmentId = result.lastID;
                console.log(`[Manual Seeder] ✓ Created department: "${dept.name}" (ID: ${departmentId})`);
            }

            createdDepartments.push({
                id: departmentId,
                name: dept.name,
                description: dept.description
            });

            // Add each user created by admin to this department
            for (const user of usersCreatedByAdmin) {
                const existingMember = await getAsync(
                    `SELECT id FROM department_members WHERE department_id = ? AND user_id = ? AND deleted_at IS NULL`,
                    [departmentId, user.id]
                );

                if (!existingMember) {
                    await runAsync(
                        `INSERT INTO department_members 
                         (department_id, user_id, role_id, joined_by, status, created_by, joined_at, created_at, updated_at) 
                         VALUES (?, ?, ?, ?, 'active', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                        [departmentId, user.id, user.role_id, adminUser.id, adminUser.id]
                    );
                    console.log(`[Manual Seeder] ✓ Added user "${user.first_name} ${user.last_name}" (ID: ${user.id}, Role ID: ${user.role_id}) to department: "${dept.name}"`);
                } else {
                    console.log(`[Manual Seeder] User "${user.first_name} ${user.last_name}" already member of department: "${dept.name}"`);
                }
            }
        }

        console.log('\n[Manual Seeder] ✅ Department seeder completed successfully!');
        console.log('\nCreated/Updated Departments:');
        createdDepartments.forEach(dept => {
            console.log(`  - ${dept.name} (ID: ${dept.id})`);
            console.log(`    Description: ${dept.description}`);
        });
        console.log(`\nUsers added to departments (${usersCreatedByAdmin.length} total):`);
        for (const u of usersCreatedByAdmin) {
            console.log(`   - ${u.first_name} ${u.last_name} (ID: ${u.id})`);
        }

    } catch (err) {
        console.error('[Manual Seeder] ✗ Department seeder failed:', err);
        process.exit(1);
    }
};

// Run seeder if executed directly
if (require.main === module) {
    seedDepartments()
        .then(() => {
            console.log('\n[Manual Seeder] Process completed.');
            process.exit(0);
        })
        .catch(err => {
            console.error('[Manual Seeder] Fatal error:', err);
            process.exit(1);
        });
}

module.exports = { seedDepartments };