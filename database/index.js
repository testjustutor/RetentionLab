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
const { seedAiProviders } = require('./seeders/019_seed_ai_providers');
const { seedAdminRubric } = require('./seeders/020_admin_rubric');

const runSeeder = async () => {
    const TOTAL_STEPS = 20;

    console.log('🚀 Starting database seeding...\n');

    // Step 1: Seed roles
    console.log(`📋 Step 1/${TOTAL_STEPS}: Seeding roles...`);
    await seedRoles();
    console.log('✅ Roles seeded\n');

    // Step 2: Seed companies
    console.log(`🏢 Step 2/${TOTAL_STEPS}: Seeding companies...`);
    await seedCompanies();
    console.log('✅ Companies seeded\n');

    // Step 3: Seed permissions
    console.log(`🔐 Step 3/${TOTAL_STEPS}: Seeding permissions...`);
    await seedPermissions();
    console.log('✅ Permissions seeded\n');

    // Step 4: Seed super admin
    console.log(`👑 Step 4/${TOTAL_STEPS}: Seeding super admin...`);
    await seedSuperAdmin();
    console.log('✅ Super admin seeded\n');

    // Step 5: Seed admin user
    console.log(`👤 Step 5/${TOTAL_STEPS}: Seeding admin user...`);
    await seedAdminUser();
    console.log('✅ Admin user seeded\n');

    // Step 6: Seed test users
    console.log(`🧪 Step 6/${TOTAL_STEPS}: Seeding test users...`);
    await seedTestUsers();
    console.log('✅ Test users seeded\n');

    // Step 7: Seed rubric
    console.log(`📊 Step 7/${TOTAL_STEPS}: Seeding rubric...`);
    await seedRubric();
    console.log('✅ Rubric seeded\n');

    // Step 8: Seed settings
    console.log(`⚙️  Step 8/${TOTAL_STEPS}: Seeding settings...`);
    await seedSettings();
    console.log('✅ Settings seeded\n');

    // Step 9: Seed header role configs
    console.log(`🎨 Step 9/${TOTAL_STEPS}: Seeding header role configs...`);
    await seedHeaderRoleConfigs();
    console.log('✅ Header role configs seeded\n');

    // Step 10: Seed header menu items
    console.log(`📑 Step 10/${TOTAL_STEPS}: Seeding header menu items...`);
    await seedHeaderMenuItems();
    console.log('✅ Header menu items seeded\n');

    // Step 11: Seed header page configs
    console.log(`📄 Step 11/${TOTAL_STEPS}: Seeding header page configs...`);
    await seedHeaderPageConfigs();
    console.log('✅ Header page configs seeded\n');

    // Step 12: Seed session quality
    console.log(`🎓 Step 12/${TOTAL_STEPS}: Seeding session quality...`);
    await seedSessionQuality();
    console.log('✅ Session quality seeded\n');

    // Step 13: Seed user permissions
    console.log(`🔑 Step 13/${TOTAL_STEPS}: Seeding user permissions...`);
    await seedUserPermissions();
    console.log('✅ User permissions seeded\n');

    // Step 14: Seed subscriptions
    console.log(`💳 Step 14/${TOTAL_STEPS}: Seeding subscriptions...`);
    await seedSubscriptions();
    console.log('✅ Subscriptions seeded\n');

    // Step 15: Seed header configs
    console.log(`🎯 Step 15/${TOTAL_STEPS}: Seeding header configs...`);
    await seedHeaderConfigs();
    console.log('✅ Header configs seeded\n');

    // Step 16: Seed calendar providers
    console.log(`📅 Step 16/${TOTAL_STEPS}: Seeding calendar providers...`);
    await seedCalendarProviders();
    console.log('✅ Calendar providers seeded\n');

    // Step 17: Seed menu items
    console.log(`📋 Step 17/${TOTAL_STEPS}: Seeding menu items...`);
    await seedMenuItems();
    console.log('✅ Menu items seeded\n');

    // Step 18: Seed role menu permissions
    console.log(`🔐 Step 18/${TOTAL_STEPS}: Seeding role menu permissions...`);
    await seedRoleMenuPermissions();
    console.log('✅ Role menu permissions seeded\n');

    // Step 19: Seed AI providers
    console.log(`🧠 Step 19/${TOTAL_STEPS}: Seeding AI providers...`);
    await seedAiProviders();
    console.log('✅ AI providers seeded\n');

    // Step 20: Seed admin rubric
    console.log(`📊 Step 20/${TOTAL_STEPS}: Seeding admin rubric...`);
    await seedAdminRubric();
    console.log('✅ Admin rubric seeded\n');

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
    seedAiProviders,
    seedAdminRubric,
};
