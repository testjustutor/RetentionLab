const { db } = require('./database/db');

// Check if role_menu_permissions has data
db.all('SELECT COUNT(*) as count FROM role_menu_permissions', (err, result) => {
  console.log('Total role_menu_permissions:', result[0].count);
  
  // Check instructor permissions
  db.all(`
    SELECT r.role_name, rmp.menu_item_id, mi.menu_id, mi.label
    FROM role_menu_permissions rmp
    JOIN roles r ON r.id = rmp.role_id
    JOIN menu_items mi ON mi.id = rmp.menu_item_id
    WHERE r.role_name IN ('instructor', 'reviewer')
    ORDER BY r.role_name, rmp.menu_item_id
  `, (err2, perms) => {
    console.log('\nInstructor & Reviewer permissions:');
    console.log(JSON.stringify(perms, null, 2));
    
    // Check if menu_items table has the right data
    db.all('SELECT id, menu_id, label FROM menu_items WHERE menu_id IN ("dashboard", "profile")', (err3, items) => {
      console.log('\nDashboard & Profile menu items:');
      console.log(JSON.stringify(items, null, 2));
      
      db.close();
    });
  });
});