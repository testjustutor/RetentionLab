/**
 * root/database/index.js
 */
const { seedRoles } = require('./roles');
const { seedCompanies } = require('./companiesSeeder');
const { seedHeaderRoleConfigs } = require('./headerRoleConfigSeeder');
const { seedHeaderMenuItems } = require('./headerMenuItemsSeeder');
const { seedHeaderPageConfigs } = require('./headerPageConfigsSeeder');
const { seedSuperAdmin } = require('./superAdmin');
const { seedAdminUser } = require('./adminUserSeeder');
const { seedRubric } = require('./rubricSeeder');
const { seedSettings } = require('./settingsSeeder');
const { seedPermissions } = require('./permissionsSeeder');
const { seedSessionQuality } = require('./sessionQualitySeeder');

const runSeeder = async () => {
    await seedRoles();
    await seedCompanies();
    await seedHeaderRoleConfigs();
    await seedHeaderMenuItems();
    await seedHeaderPageConfigs();
    await seedSuperAdmin();
    await seedAdminUser();
    await seedRubric();
    await seedSettings();
    // Must run after seedRoles (needs role ids) and after seedSuperAdmin/
    // seedAdminUser if you later seed user-level overrides here too.
    await seedPermissions();
    
    // Session Quality & Impact Report sample data
    await seedSessionQuality();
};

module.exports = {
    runSeeder,
    seedRoles,
    seedCompanies,
    seedHeaderRoleConfigs,
    seedHeaderMenuItems,
    seedHeaderPageConfigs,
    seedSuperAdmin,
    seedAdminUser,
    seedRubric,
    seedSettings,
    seedPermissions,
};