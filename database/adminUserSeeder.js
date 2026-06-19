/**
 * root/database/adminUserSeeder.js
 */
const crypto = require('crypto');
const { runAsync, getAsync } = require('./seedHelpers');

const hashPassword = (password, salt = crypto.randomBytes(16).toString('hex')) => {
    const derived = crypto.scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${derived}`;
};

const seedAdminUser = async () => {
    const email = process.env.ADMIN_EMAIL || 'admin@demo.local';
    const password = process.env.ADMIN_PASSWORD || 'AdminDemo@123';
    const companyCode = process.env.ADMIN_COMPANY_CODE || 'DEFAULT';

    const existing = await getAsync(`SELECT id FROM users WHERE email = ?`, [email]);
    if (existing) return;

    const company = await getAsync(`SELECT id FROM companies WHERE company_code = ?`, [companyCode]);
    const role = await getAsync(`SELECT id FROM roles WHERE role_name = ?`, ['admin']);
    if (!company || !role) return;

    const password_hash = hashPassword(password);
    await runAsync(
        `INSERT INTO users (user_uuid, company_id, role_id, first_name, last_name, email, password_hash, phone, profile_image, status, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [
            crypto.randomUUID(),
            company.id,
            role.id,
            'Demo',
            'Admin',
            email,
            password_hash,
            null,
            null,
            'active',
            null
        ]
    );
};

module.exports = { seedAdminUser };
