/**
 * Run all manual seeders in database/manual-seeder folder
 * Usage: node database/run-manual-seeders.js
 */

const fs = require('fs');
const path = require('path');

const manualSeederDir = path.join(__dirname, 'manual-seeder');

async function runManualSeeders() {
  console.log('=== Running Manual Seeders ===\n');

  // Get all seeder files in manual-seeder folder
  // Files are prefixed with sequence numbers: 01_seed_departments.js
  // Exclude master seeder (06) and deprecated asset seeder (10)
  const files = fs.readdirSync(manualSeederDir)
    .filter(f => /^\d{2}_seed_.*\.js$/.test(f))
    .filter(f => !f.includes('_master_') && !f.includes('_deprecated'))
    .sort();

  if (files.length === 0) {
    console.log('No manual seeders found in database/manual-seeder/');
    process.exit(0);
  }

  console.log(`Found ${files.length} manual seeder(s):\n`);

  let success = 0;
  let failed = 0;

  for (const file of files) {
    const filePath = path.join(manualSeederDir, file);
    console.log(`Running: ${file}...`);

    try {
      // Clear require cache to allow re-running
      delete require.cache[require.resolve(filePath)];
      
      const seeder = require(filePath);
      
      // Check if seeder has an export function (default, seed, run, or first function export)
      const seedFn = seeder.default || seeder.seed || seeder.run || Object.values(seeder).find(fn => typeof fn === 'function');
      
      if (typeof seedFn === 'function') {
        await seedFn();
        console.log(`  ✓ ${file} completed\n`);
        success++;
      } else {
        console.log(`  ⚠️  ${file} - no export function found, skipping\n`);
        failed++;
      }
    } catch (err) {
      console.error(`  ✗ ${file} failed:`, err.message, '\n');
      failed++;
    }
  }

  console.log('=== Manual Seeders Complete ===');
  console.log(`  ✓ ${success} succeeded`);
  if (failed > 0) {
    console.log(`  ✗ ${failed} failed`);
    process.exit(1);
  }
  process.exit(0);
}

runManualSeeders().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});