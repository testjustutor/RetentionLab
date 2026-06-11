/**
 * root/database/seeder.js
 */
const { initDB } = require('./db');
const { runSeeder } = require('./index');

initDB()
  .then(() => runSeeder())
  .then(() => {
    console.log('Database seed complete.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Database seed failed:', err);
    process.exit(1);
  });