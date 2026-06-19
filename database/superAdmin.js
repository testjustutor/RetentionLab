/**
 * root/database/superAdmin.js
 */
const crypto = require('crypto');
const { runAsync, getAsync } = require('./seedHelpers');

const hashPassword = (password, salt = crypto.randomBytes(16).toString('hex')) => {
    const derived = crypto.scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${derived}`;
};

const seedSuperAdmin = async () => {
    const email = process.env.SUPER_ADMIN_EMAIL || 'superadmin@retentionlab.local';
    const password = process.env.SUPER_ADMIN_PASSWORD || 'Admin@123';

    const existing = await getAsync(`SELECT id FROM users WHERE email = ?`, [email]);
    if (existing) return;

    const role = await getAsync(`SELECT id FROM roles WHERE role_name = ?`, ['super_admin']);
    const password_hash = hashPassword(password);
    await runAsync(
        `INSERT INTO users (user_uuid, company_id, role_id, first_name, last_name, email, password_hash, phone, profile_image, status, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [crypto.randomUUID(), null, role?.id || null, 'Super', 'Admin', email, password_hash, null, null, 'active', null]
    );
};

module.exports = { seedSuperAdmin };