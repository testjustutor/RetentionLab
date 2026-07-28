const { db } = require('./database/db');

// Check menu items
db.all('SELECT menu_key, route_path FROM menu_items WHERE is_active = 1', (err, menus) => {
  console.log('\n=== MENU ITEMS ===');
  menus.forEach(m => console.log(m.menu_key, '->', m.route_path));
  
  // Check role menu permissions for instructor
  db.all('SELECT r.role_name, rmp.is_visible, mi.menu_key, mi.route_path FROM role_menu_permissions rmp JOIN roles r ON r.id = rmp.role_id JOIN menu_items mi ON mi.id = rmp.menu_item_id WHERE r.role_name = "instructor"', (err2, perms) => {
    console.log('\n=== INSTRUCTOR ROLE MENU PERMISSIONS ===');
    perms.forEach(p => console.log(p.menu_key, '->', p.route_path, '(visible:', p.is_visible, ')'));
    
    // Check page configs for instructor
    db.all('SELECT hpc.role_id, hpc.page_key, hpc.title, hpc.is_active FROM header_page_configs hpc JOIN roles r ON r.id = hpc.role_id WHERE r.role_name = "instructor" AND hpc.deleted_at IS NULL', (err3, pages) => {
      console.log('\n=== INSTRUCTOR PAGE CONFIGS ===');
      pages.forEach(p => console.log(p.page_key, '-', p.title, '(active:', p.is_active, ')'));
      
      db.close();
    });
  });
});