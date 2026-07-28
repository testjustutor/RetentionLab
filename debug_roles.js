const { db } = require('./database/db');

async function debug() {
  console.log('\n=== ROLE MENU PERMISSIONS ===');
  const perms = await new Promise((resolve, reject) => {
    db.all(`
      SELECT r.role_name, COUNT(*) as perm_count, 
             GROUP_CONCAT(mi.menu_key) as menu_keys
      FROM role_menu_permissions rmp 
      JOIN roles r ON r.id = rmp.role_id 
      JOIN menu_items mi ON mi.id = rmp.menu_item_id 
      GROUP BY r.role_name
    `, (err, rows) => err ? reject(err) : resolve(rows || []));
  });
  
  perms.forEach(p => {
    console.log(`${p.role_name}: ${p.perm_count} permissions`);
    console.log(`  Keys: ${p.menu_keys}`);
  });

  console.log('\n=== MENU ITEMS COUNT ===');
  const menuCount = await new Promise((resolve, reject) => {
    db.get('SELECT COUNT(*) as count FROM menu_items', (err, row) => err ? reject(err) : resolve(row));
  });
  console.log(`Total menu items: ${menuCount.count}`);

  console.log('\n=== PAGE CONFIGS BY ROLE ===');
  const pages = await new Promise((resolve, reject) => {
    db.all(`
      SELECT r.role_name, COUNT(*) as page_count
      FROM header_page_configs hpc
      JOIN roles r ON r.id = hpc.role_id
      WHERE hpc.deleted_at IS NULL
      GROUP BY r.role_name
    `, (err, rows) => err ? reject(err) : resolve(rows || []));
  });
  
  pages.forEach(p => {
    console.log(`${p.role_name}: ${p.page_count} page configs`);
  });

  console.log('\n=== SAMPLE MENU ITEMS WITH ROUTES ===');
  const sampleMenus = await new Promise((resolve, reject) => {
    db.all(`
      SELECT mi.menu_key, mi.route_path, mi.parent_id
      FROM menu_items mi
      WHERE mi.is_active = 1
      LIMIT 20
    `, (err, rows) => err ? reject(err) : resolve(rows || []));
  });
  
  sampleMenus.forEach(m => {
    console.log(`${m.menu_key} -> ${m.route_path} (parent: ${m.parent_id || 'none'})`);
  });

  db.close();
}

debug().catch(console.error);