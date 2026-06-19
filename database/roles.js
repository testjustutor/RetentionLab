/**
 * root/database/roles.js
 */
const { runAsync, getAsync } = require('./seedHelpers');
const seedRoles = async () => {
    const { count } = await getAsync(`SELECT COUNT(*) as count FROM roles`);
    if (count > 0) return;
    const seedRoles = [
        { role_name: 'super_admin', description: 'Full platform administrator' },
        { role_name: 'admin', description: 'Company-level administrator' },
        { role_name: 'instructor', description: 'Instructor or tutor being reviewed' },
        { role_name: 'reviewer', description: 'Meeting reviewer' },
        { role_name: 'solo_instructor', description: 'Self-registered individual instructor with their own workspace' }
    ];
    for (const role of seedRoles) {
        await runAsync(`INSERT OR IGNORE INTO roles (role_name, description) VALUES (?, ?)`, [role.role_name, role.description]);
    }
};
module.exports = { seedRoles };