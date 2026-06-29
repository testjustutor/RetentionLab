async function main() {
  const { seedHeaderMenuItems } = require('./headerMenuItemsSeeder');
  const { seedHeaderRoleConfigs } = require('./headerRoleConfigSeeder');
  const { seedHeaderPageConfigs } = require('./headerPageConfigsSeeder');
  await seedHeaderMenuItems();
  console.log('Menu items seeded');
  await seedHeaderRoleConfigs();
  console.log('Role configs seeded');
  await seedHeaderPageConfigs();
  console.log('Page configs seeded');
}
main().catch(e => console.error(e));
