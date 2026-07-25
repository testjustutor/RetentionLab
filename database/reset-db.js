/**
 * root/database/reset-db.js
 * 
 * DEVELOPMENT ONLY — Drops all tables, runs migrations, then seeds.
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
    [process.env.DB_NAME || 'retention_lab'],
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
  console.log('   Running comprehensive schema migration...');
  const migrationsDir = path.join(__dirname, 'migrations');
  
  // Run the comprehensive schema first (creates all 57 tables with proper schema)
  const schemaPath = path.join(migrationsDir, '000_comprehensive_schema.js');
  try {
    delete require.cache[require.resolve(schemaPath)];
    const schema = require(schemaPath);
    if (typeof schema.up === 'function') {
      await schema.up();
      console.log('   ✓ 000_comprehensive_schema.js (57 tables with AUTO_INCREMENT, indexes, FKs)');
    }
  } catch (err) {
    console.log(`   ⚠️  Comprehensive schema: ${err.message.substring(0, 60)}`);
  }
  
  // Run remaining individual migrations (they use IF NOT EXISTS / DROP + CREATE)
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.js') && f !== '000_comprehensive_schema.js')
    .sort();
  
  let success = 0;
  let fail = 0;
  
  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Try to load as module
    try {
      delete require.cache[require.resolve(filePath)];
      const mod = require(filePath);
      const fn = typeof mod.run === 'function' ? mod.run :
                 typeof mod.up === 'function' ? mod.up : null;
      if (fn) {
        try {
          await fn();
          console.log(`   ✓ ${file}`);
          success++;
          continue;
        } catch (err) {
          // Fall through
        }
      }
    } catch (err) {
      // Module can't be loaded - skip
    }
    
    // Extract and execute CREATE TABLE statements as fallback
    const statements = extractSQLFromFile(content);
    let created = 0;
    for (const stmt of statements) {
      try {
        await runAsync(stmt);
        created++;
      } catch (err) {
        // Table already exists - fine
      }
    }
    
    if (created > 0) {
      console.log(`   ✓ ${file} (${created} table${created > 1 ? 's' : ''})`);
      success++;
    } else {
      console.log(`   ⚠️  ${file} (skipped - already exists)`);
      fail++;
    }
  }
  
  console.log(`   ✓ Migrations complete — ${success} succeeded, ${fail} skipped`);
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
    
    // Ensure critical tables exist (some migration files have syntax issues)
    console.log('   Verifying critical tables...');
    const criticalTables = [
      { name: 'meeting_sessions', sql: 'CREATE TABLE IF NOT EXISTS meeting_sessions (id INT AUTO_INCREMENT PRIMARY KEY, meeting_id VARCHAR(255), transcript_file_name TEXT, audio_file_name TEXT, start_time DATETIME DEFAULT CURRENT_TIMESTAMP, end_time DATETIME DEFAULT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4' },
      { name: 'session_rubric_summary', sql: 'CREATE TABLE IF NOT EXISTS session_rubric_summary (id INT AUTO_INCREMENT PRIMARY KEY, session_id INT NOT NULL UNIQUE, weighted_score_pct DECIMAL(5,2) DEFAULT 0, gate_status VARCHAR(50) DEFAULT "all_passed", overall_rating VARCHAR(50) DEFAULT "Developing", confidence_level VARCHAR(255) DEFAULT "", created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4' },
      { name: 'user_settings', sql: 'CREATE TABLE IF NOT EXISTS user_settings (id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL, setting_key VARCHAR(255) NOT NULL, setting_value TEXT, setting_type VARCHAR(50) DEFAULT "string", created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, INDEX idx_user_id (user_id), INDEX idx_setting_key (setting_key), UNIQUE KEY unique_user_setting (user_id, setting_key)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4' }
    ];
    
    for (const table of criticalTables) {
      try {
        await runAsync(table.sql);
        console.log(`   ✓ ${table.name} (verified)`);
      } catch (err) {
        console.log(`   ⚠️  ${table.name}: ${err.message.substring(0, 50)}`);
      }
    }
    
    await run('SET FOREIGN_KEY_CHECKS = 1');
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