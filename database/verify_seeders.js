/**
 * Verification script to check seeded data
 */
const { initDB } = require('./db');

const verify = async () => {
  await initDB();
  
  const checks = [
    { name: 'Roles', query: 'SELECT COUNT(*) as count FROM roles' },
    { name: 'Companies', query: 'SELECT COUNT(*) as count FROM companies' },
    { name: 'Permissions', query: 'SELECT COUNT(*) as count FROM permissions' },
    { name: 'Role Permissions', query: 'SELECT COUNT(*) as count FROM role_permissions' },
    { name: 'Users', query: 'SELECT COUNT(*) as count FROM users' },
    { name: 'Rubric Categories', query: 'SELECT COUNT(*) as count FROM rubric_categories' },
    { name: 'Rubric Indicators', query: 'SELECT COUNT(*) as count FROM rubric_indicators' },
    { name: 'System Settings', query: 'SELECT COUNT(*) as count FROM system_settings' },
    { name: 'User Settings', query: 'SELECT COUNT(*) as count FROM user_settings' },
    { name: 'Header Role Configs', query: 'SELECT COUNT(*) as count FROM header_role_configs' },
    { name: 'Header Menu Items', query: 'SELECT COUNT(*) as count FROM header_menu_items' },
    { name: 'Header Page Configs', query: 'SELECT COUNT(*) as count FROM header_page_configs' },
    { name: 'Session Rubric Evaluations', query: 'SELECT COUNT(*) as count FROM session_rubric_evaluations' },
    { name: 'Session Rubric Summary', query: 'SELECT COUNT(*) as count FROM session_rubric_summary' },
  ];

  console.log('🔍 Verifying seeded data...\n');
  
  for (const check of checks) {
    const result = await new Promise((resolve, reject) => {
      initDB().then(() => {
        const { db } = require('./db');
        db.get(check.query, [], (err, row) => {
          if (err) return reject(err);
          resolve(row);
        });
      });
    });
    
    const count = result?.count || 0;
    const status = count > 0 ? '✅' : '⚠️';
    console.log(`${status} ${check.name}: ${count} records`);
  }

  console.log('\n📊 Sample data preview:');
  
  // Show users
  const users = await new Promise((resolve, reject) => {
    const { db } = require('./db');
    db.all('SELECT id, email, first_name, last_name, role_id, status FROM users', [], (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
  
  console.log('\n👤 Users:');
  users.forEach(user => {
    console.log(`  - ${user.email} (${user.first_name} ${user.last_name}) - Role: ${user.role_id} - Status: ${user.status}`);
  });

  // Show roles
  const roles = await new Promise((resolve, reject) => {
    const { db } = require('./db');
    db.all('SELECT id, role_name, description FROM roles', [], (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
  
  console.log('\n🎭 Roles:');
  roles.forEach(role => {
    console.log(`  - ${role.role_name}: ${role.description}`);
  });

  // Show sample settings
  const settings = await new Promise((resolve, reject) => {
    const { db } = require('./db');
    db.all('SELECT setting_key, setting_value, setting_type FROM system_settings LIMIT 10', [], (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
  
  console.log('\n⚙️  Sample System Settings (first 10):');
  settings.forEach(setting => {
    console.log(`  - ${setting.setting_key}: ${setting.setting_value} (${setting.setting_type})`);
  });

  console.log('\n✅ Verification complete!');
  process.exit(0);
};

verify().catch(err => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});