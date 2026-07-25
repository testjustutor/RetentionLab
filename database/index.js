/**
 * root/database/index.js
 * Main seeder runner - executes all seeders in order
 */
const { seedRoles } = require('./seeders/001_roles');
const { seedCompanies } = require('./seeders/002_companies');
const { seedPermissions } = require('./seeders/003_permissions');
const { seedSuperAdmin } = require('./seeders/004_super_admin');
const { seedAdminUser } = require('./seeders/005_admin_user');
const { seedTestUsers } = require('./seeders/006_test_users');
const { seedRubric } = require('./seeders/006_rubric');
const { seedSettings } = require('./seeders/007_settings');
const { seedHeaderRoleConfigs } = require('./seeders/008_header_role_configs');
const { seedHeaderMenuItems } = require('./seeders/009_header_menu_items');
const { seedHeaderPageConfigs } = require('./seeders/010_header_page_configs');
const { seedSessionQuality } = require('./seeders/011_session_quality');
const { seedUserPermissions } = require('./seeders/013_user_permissions');
const { seedSubscriptions } = require('./seeders/014_subscriptions');
const { seedHeaderConfigs } = require('./seeders/015_header_configs');
const { seedCalendarProviders } = require('./seeders/016_calendar_providers');
const { seedMenuItems } = require('./seeders/017_menu_items');
const { seedRoleMenuPermissions } = require('./seeders/018_role_menu_permissions');
const { seedUserMenuPermissions } = require('./seeders/019_user_menu_permissions');

const runSeeder = async () => {
    console.log('🚀 Starting database seeding...\n');

    // Step 1: Seed roles (required for all other seeders)
    console.log('📋 Step 1/15: Seeding roles...');
    await seedRoles();
    console.log('✅ Roles seeded\n');

    // Step 2: Seed companies
    console.log('🏢 Step 2/15: Seeding companies...');
    await seedCompanies();
    console.log('✅ Companies seeded\n');

    // Step 3: Seed permissions (depends on roles)
    console.log('🔐 Step 3/15: Seeding permissions...');
    await seedPermissions();
    console.log('✅ Permissions seeded\n');

    // Step 4: Seed super admin (depends on roles)
    console.log('👑 Step 4/15: Seeding super admin...');
    await seedSuperAdmin();
    console.log('✅ Super admin seeded\n');

    // Step 5: Seed admin user (depends on roles and companies)
    console.log('👤 Step 5/15: Seeding admin user...');
    await seedAdminUser();
    console.log('✅ Admin user seeded\n');

    // Step 5.5: Seed test users (instructor, solo_instructor, reviewer)
    console.log('🧪 Step 5.5/15: Seeding test users...');
    await seedTestUsers();
    console.log('✅ Test users seeded\n');

    // Step 6: Seed rubric (depends on roles)
    console.log('📊 Step 6/15: Seeding rubric...');
    await seedRubric();
    console.log('✅ Rubric seeded\n');

    // Step 7: Seed settings (depends on users)
    console.log('⚙️  Step 7/15: Seeding settings...');
    await seedSettings();
    console.log('✅ Settings seeded\n');

    // Step 8: Seed header role configs (depends on roles)
    console.log('🎨 Step 8/15: Seeding header role configs...');
    await seedHeaderRoleConfigs();
    console.log('✅ Header role configs seeded\n');

    // Step 9: Seed header menu items (depends on roles)
    console.log('📑 Step 9/15: Seeding header menu items...');
    await seedHeaderMenuItems();
    console.log('✅ Header menu items seeded\n');

    // Step 10: Seed header page configs (depends on roles)
    console.log('📄 Step 10/15: Seeding header page configs...');
    await seedHeaderPageConfigs();
    console.log('✅ Header page configs seeded\n');

    // Step 11: Seed session quality (depends on sessions)
    console.log('🎓 Step 11/15: Seeding session quality...');
    await seedSessionQuality();
    console.log('✅ Session quality seeded\n');

    // Step 12: Seed user permissions (depends on users and permissions)
    console.log('🔑 Step 12/15: Seeding user permissions...');
    await seedUserPermissions();
    console.log('✅ User permissions seeded\n');

    // Step 13: Seed subscriptions (depends on companies)
    console.log('💳 Step 13/15: Seeding subscriptions...');
    await seedSubscriptions();
    console.log('✅ Subscriptions seeded\n');

    // Step 14: Seed header configs
    console.log('🎯 Step 14/15: Seeding header configs...');
    await seedHeaderConfigs();
    console.log('✅ Header configs seeded\n');

    // Step 15: Seed calendar providers
    console.log('📅 Step 15/18: Seeding calendar providers...');
    await seedCalendarProviders();
    console.log('✅ Calendar providers seeded\n');

    // Step 16: Seed menu items
    console.log('📋 Step 16/18: Seeding menu items...');
    await seedMenuItems();
    console.log('✅ Menu items seeded\n');

    // Step 17: Seed role menu permissions
    console.log('🔐 Step 17/18: Seeding role menu permissions...');
    await seedRoleMenuPermissions();
    console.log('✅ Role menu permissions seeded\n');

    // Step 18: Seed user menu permissions
    console.log('👤 Step 18/18: Seeding user menu permissions...');
    await seedUserMenuPermissions();
    console.log('✅ User menu permissions seeded\n');

    console.log('🎉 Database seeding completed successfully!');
};

module.exports = {
    runSeeder,
    seedRoles,
    seedCompanies,
    seedPermissions,
    seedSuperAdmin,
    seedAdminUser,
    seedTestUsers,
    seedRubric,
    seedSettings,
    seedHeaderRoleConfigs,
    seedHeaderMenuItems,
    seedHeaderPageConfigs,
    seedSessionQuality,
    seedUserPermissions,
    seedSubscriptions,
    seedHeaderConfigs,
    seedCalendarProviders,
    seedMenuItems,
    seedRoleMenuPermissions,
    seedUserMenuPermissions,
};
