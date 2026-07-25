/**
 * Compare config/settings.js with database system_settings
 */
const { initDB } = require('./db');
const appConfig = require('../config/settings');

const check = async () => {
  await initDB();
  
  const { db } = require('./db');
  
  // Get settings from database
  const dbSettings = await new Promise((resolve, reject) => {
    db.all('SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN (?, ?, ?, ?, ?)', 
      ['puppeteer', 'audio', 'screen', 'platforms', 'ai'], 
      (err, rows) => {
        if (err) return reject(err);
        resolve(rows || []);
      }
    );
  });

  console.log('🔍 Comparing config/settings.js with database system_settings\n');
  console.log('=' .repeat(80));

  const dbSettingsMap = {};
  dbSettings.forEach(row => {
    dbSettingsMap[row.setting_key] = JSON.parse(row.setting_value);
  });

  // Compare each setting
  const settingsToCheck = ['puppeteer', 'audio', 'screen', 'platforms', 'ai'];
  
  for (const key of settingsToCheck) {
    const configValue = appConfig[key];
    const dbValue = dbSettingsMap[key];
    
    console.log(`\n📋 ${key.toUpperCase()}:`);
    console.log('-'.repeat(80));
    
    if (!dbValue) {
      console.log('❌ NOT FOUND in database');
      continue;
    }

    // Deep compare
    const configStr = JSON.stringify(configValue, null, 2);
    const dbStr = JSON.stringify(dbValue, null, 2);
    
    if (configStr === dbStr) {
      console.log('✅ MATCH - Database settings match config/settings.js');
    } else {
      console.log('⚠️  MISMATCH DETECTED');
      console.log('\nConfig/settings.js value:');
      console.log(configStr);
      console.log('\nDatabase value:');
      console.log(dbStr);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('\n📊 Summary:');
  console.log('Settings are stored in database and loaded at runtime.');
  console.log('The application uses database settings, not config/settings.js directly.');
  console.log('\n💡 Note: config/settings.js is used as a fallback/seeding source.');
  console.log('   The actual runtime settings come from system_settings table.\n');
  
  process.exit(0);
};

check().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});