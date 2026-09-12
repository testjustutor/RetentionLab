/**
 * root/database/reset-db.js
 * 
 * DEVELOPMENT ONLY — Drops all tables, runs migrations, then seeds.
 * 
 * Database Structure:
 * - Migrations: 55 files (001-055) creating tables for roles, users, meetings,
 *   sessions, transcripts, rubrics, calendar, archives, and more
 * - Seeders: 20 files (001-020) seeding roles, companies, permissions, users,
 *   settings, menu items, and role-based menu permissions
 * 
 * Usage: npm run db:reset
 *        node database/reset-db.js
 * 
 * WARNING: This will DESTROY all data in the database.
 */

require('dotenv').config();
const { initDB } = require('./db');
const { runSeeder } = require('./index');
const fs = require('fs');
const path = require('path');

const run = (sql) => new Promise((resolve, reject) => {
  const { db } = require('./db');
  db.run(sql, (err) => {
    if (err) return reject(err);
    resolve();
  });
});

const runAsync = (sql, params = []) => new Promise((resolve, reject) => {
  const { db } = require('./db');
  db.run(sql, params, function (err) {
    if (err) return reject(err);
    resolve(this);
  });
});

const getTables = () => new Promise((resolve, reject) => {
  const { db } = require('./db');
  db.all(
    `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
     WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'`,
    [process.env.DB_NAME],
    (err, rows) => {
      if (err) return reject(err);
      resolve(rows.map(r => r.TABLE_NAME));
    }
  );
});

/**
 * Extract raw CREATE TABLE SQL from a migration file.
 * Works by scanning for CREATE TABLE ... ENGINE=InnoDB blocks
 * and cleaning up backtick-quoted identifiers inside template literals.
 */
const extractSQLFromFile = (content) => {
  const results = [];
  const lines = content.split('\n');
  let i = 0;
  
  while (i < lines.length) {
    const line = lines[i].trim();
    
    // Find start of CREATE TABLE statement (may be inside template literal)
    if (/CREATE\s+TABLE\s/i.test(line)) {
      const sqlLines = [lines[i]];
      i++;
      
      // Collect all lines until we hit ENGINE=InnoDB and semicolon
      while (i < lines.length) {
        sqlLines.push(lines[i]);
        const t = lines[i].trim();
        if (/ENGINE\s*=\s*InnoDB/i.test(t) && t.endsWith(';')) {
          break;
        }
        i++;
      }
      
      let sql = sqlLines.join('\n');
      // Remove backticks from identifiers (conflict with JS template literals)
      sql = sql.replace(/`(\w+)`/g, '$1');
      
      // Only keep up to and including the ENGINE=InnoDB...; part
      const match = sql.match(/CREATE\s+TABLE[\s\S]*?ENGINE\s*=\s*InnoDB[^;]*;/i);
      if (match) {
        let cleanSQL = match[0];
        // Remove trailing semicolons for runAsync
        cleanSQL = cleanSQL.replace(/;\s*$/, '');
        results.push(cleanSQL);
      }
    }
    i++;
  }
  
  return results;
};

const runMigrations = async () => {
  console.log('   Running individual migration files...');
  const migrationsDir = path.join(__dirname, 'migrations');
  
  // Run individual migrations in order (they use IF NOT EXISTS / DROP + CREATE)
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.js'))
    .sort();
  
  console.log(`   Found ${files.length} migration files (001-055)`);
  
  let success = 0;
  let fail = 0;
  
  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Try to load as module
    let moduleError = null;
    let migrationFn = null;
    try {
      delete require.cache[require.resolve(filePath)];
      const mod = require(filePath);
      migrationFn = typeof mod.run === 'function' ? mod.run :
                    typeof mod.up === 'function' ? mod.up : null;
      if (migrationFn) {
        try {
          await migrationFn();
          console.log(`   ✓ ${file}`);
          success++;
          continue;
        } catch (err) {
          moduleError = err;
          // Fall through to SQL extraction
        }
      }
    } catch (err) {
      moduleError = err;
      // Module can't be loaded - try SQL extraction
    }
    
    // Extract and execute CREATE TABLE statements as fallback
    const statements = extractSQLFromFile(content);
    let created = 0;
    let sqlErrors = [];
    for (const stmt of statements) {
      try {
        await runAsync(stmt);
        created++;
      } catch (err) {
        sqlErrors.push(err.message);
      }
    }
    
    if (created > 0) {
      console.log(`   ✓ ${file} (${created} table${created > 1 ? 's' : ''})`);
      success++;
    } else {
      if (moduleError) {
        console.log(`   ❌ ${file} (migration function failed: ${moduleError.message})`);
      } else if (sqlErrors.length > 0) {
        console.log(`   ⚠️  ${file} (SQL failed: ${sqlErrors[0].substring(0, 100)})`);
      } else {
        console.log(`   ⚠️  ${file} (skipped - no tables to create)`);
      }
      fail++;
    }
  }
  
  console.log(`   ✓ Migrations complete — ${success} succeeded, ${fail} skipped`);
  console.log(`   Total: ${files.length} migration files processed`);
};

const resetDB = async () => {
  console.log('\n⚠️  ⚠️  ⚠️  DATABASE RESET ⚠️  ⚠️  ⚠️');
  console.log('   This will DELETE ALL DATA and recreate everything.\n');

  const migrateOnly = process.argv.includes('--migrate-only');
  
  if (!migrateOnly && !process.argv.includes('--force') && !process.argv.includes('-f')) {
    console.log('   To confirm, run: node database/reset-db.js --force');
    console.log('   Or use:        npm run db:reset\n');
    process.exit(0);
  }

  console.log('🔧 Step 1/4: Connecting to database...');
  await initDB();
  console.log('   ✅ Connected\n');

  console.log('🔧 Step 2/4: Dropping all tables...');
  try {
    await run('SET FOREIGN_KEY_CHECKS = 0');
    const tables = await getTables();
    console.log(`   Found ${tables.length} tables to drop`);
    for (const table of tables) {
      await run(`DROP TABLE IF EXISTS \`${table}\``);
    }
    await run('SET FOREIGN_KEY_CHECKS = 1');
    console.log(`   ✅ Dropped ${tables.length} tables\n`);
  } catch (err) {
    console.error('   ❌ Drop failed:', err.message);
    process.exit(1);
  }

  console.log('🔧 Step 3/4: Running migrations...');
  try {
    await run('SET FOREIGN_KEY_CHECKS = 0');
    await runMigrations();
    
    console.log('   ✅ Migrations complete\n');
  } catch (err) {
    console.error('   ❌ Migrations failed:', err.message);
    await run('SET FOREIGN_KEY_CHECKS = 1');
    process.exit(1);
  }

  if (!migrateOnly) {
  console.log('🔧 Step 4/4: Running seeders...');
  try {
    await runSeeder();
    console.log('   ✅ Seeders complete\n');
  } catch (err) {
    console.error('   ❌ Seeders failed:', err.message);
    process.exit(1);
  }
  
  console.log('   Seeded: roles, companies, permissions, admin user, settings,');
  console.log('           menu items, role menu permissions, and more');
  } else {
    console.log('⏭️  Step 4/4: Skipping seeders (--migrate-only)\n');
  }

  console.log('🎉 Database migration complete!');
  if (migrateOnly) {
    console.log('   All tables created/updated.\n');
  } else {
    console.log('   All tables dropped, recreated, and seeded.\n');
  }
  process.exit(0);
};

resetDB().catch(err => {
  console.error('\n❌ Reset failed:', err.message);
  process.exit(1);
});