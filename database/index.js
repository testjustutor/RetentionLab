/**
 * root/database/index.js
 */
const { seedRoles } = require('./roles');
const { seedSuperAdmin } = require('./superAdmin');
const { seedRubric } = require('./rubricSeeder');
const { seedSettings } = require('./settingsSeeder');

const runSeeder = async () => {
    await seedRoles();
    await seedSuperAdmin();
    await seedRubric();
    await seedSettings();
};

module.exports = { runSeeder, seedRoles, seedSuperAdmin, seedRubric, seedSettings };
