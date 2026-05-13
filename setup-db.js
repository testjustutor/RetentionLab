const { initDB } = require('./database/db');

(async () => {
  try {
    await initDB();
    console.log('✅ Database initialized and seeders executed (if configured).');
    process.exit(0);
  } catch (err) {
    console.error('❌ Database setup failed:', err);
    process.exit(1);
  }
})();

