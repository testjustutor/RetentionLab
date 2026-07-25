/**
 * root/database/seeders/002_companies.js
 * Seeds the default companies
 */
const { runAsync, getAsync } = require('../seedHelpers');

const seedCompanies = async () => {
    const { count } = await getAsync(`SELECT COUNT(*) as count FROM companies`);
    if (count > 0) return;

    const seedCompanies = [
        {
            company_uuid: 'comp_001_default',
            company_name: 'Default Organization',
            company_code: process.env.ADMIN_COMPANY_CODE,
            domain: 'default.local',
            logo_url: null,
            status: 'active'
        }
    ];

    for (const company of seedCompanies) {
        await runAsync(
            `INSERT IGNORE INTO companies 
             (company_uuid, company_name, company_code, domain, logo_url, status) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
                company.company_uuid,
                company.company_name,
                company.company_code,
                company.domain,
                company.logo_url,
                company.status
            ]
        );
    }
};

module.exports = { seedCompanies };