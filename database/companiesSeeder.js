/**
 * root/database/companiesSeeder.js
 */
const { runAsync, getAsync } = require('./seedHelpers');

const seedCompanies = async () => {
    const { count } = await getAsync(`SELECT COUNT(*) as count FROM companies`);
    if (count > 0) return;

    const seedCompanies = [
        {
            company_uuid: 'comp_001_default',
            company_name: 'Default Company',
            company_code: 'DEFAULT',
            domain: 'localhost',
            logo_url: null,
            status: 'active'
        },
        {
            company_uuid: 'comp_002_demo',
            company_name: 'Demo Organization',
            company_code: 'DEMO',
            domain: 'demo.local',
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
