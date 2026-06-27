/**
 * root/database/roles.js
 */
const { runAsync } = require('./seedHelpers');

const seedRoles = async () => {
    // IMPORTANT:
    // Do NOT early-return just because roles table has some rows.
    // Your MySQL DB may contain only partial seeded data (e.g. only solo_instructor),
    // which breaks downstream seeders like superAdmin/admin.

    const rolesToSeed = [
        { role_name: 'super_admin', description: 'Full platform administrator' },
        { role_name: 'admin', description: 'Company-level administrator' },
        { role_name: 'instructor', description: 'Instructor or tutor being reviewed' },
        { role_name: 'reviewer', description: 'Meeting reviewer' },
        { role_name: 'solo_instructor', description: 'Self-registered individual instructor with their own workspace' }
    ];

    for (const role of rolesToSeed) {
        await runAsync(
            `INSERT IGNORE INTO roles (role_name, description) VALUES (?, ?)`,
            [role.role_name, role.description]
        );
    }
};

module.exports = { seedRoles };
