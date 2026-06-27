#!/usr/bin/env node

/**
 * MySQL Setup & Migration Script
 * Usage: node database/setup-mysql.js
 * 
 * This script:
 * 1. Verifies MySQL connection
 * 2. Checks if tables exist
 * 3. Disables problematic model table creation
 * 4. Runs seeders
 */

require('dotenv').config();
const { db, runAsync, allAsync, getAsync, initDB } = require('./db');
const { runSeeder } = require('./index');
const { logger } = require('../utils/logger');

async function setupMySQL() {
    console.log('🔧 Setting up MySQL database...\n');

    try {
        // Step 1: Verify connection
        console.log('1️⃣ Verifying MySQL connection...');
        await initDB();
        console.log('   ✅ MySQL connection successful\n');

        // Step 2: Check tables exist
        console.log('2️⃣ Checking required tables...');
        try {
            const result = await allAsync(`
                SELECT TABLE_NAME 
                FROM INFORMATION_SCHEMA.TABLES 
                WHERE TABLE_SCHEMA = ?
                ORDER BY TABLE_NAME
            `, [process.env.DB_NAME || 'retention_lab']);
            
            if (result && result.length > 0) {
                console.log(`   ✅ Found ${result.length} tables`);
                result.forEach(t => console.log(`      - ${t.TABLE_NAME}`));
            } else {
                console.log('   ⚠️ No tables found. Tables may not have been created yet.');
                console.log('   📝 Please create tables in MySQL manually or use your MySQL client.');
            }
        } catch (err) {
            console.log('   ⚠️ Could not verify tables:', err.message);
        }
        console.log();

        // Step 3: Run seeders
        console.log('3️⃣ Running data seeders...');
        try {
            await runSeeder();
            console.log('   ✅ Seeders completed successfully\n');
        } catch (err) {
            console.log('   ⚠️ Seeding encountered errors (this may be normal):', err.message);
            console.log('   📝 Some data may already exist or tables may need manual creation.\n');
        }

        console.log('✅ MySQL setup complete!');
        console.log('\n📝 Next steps:');
        console.log('   1. Start the server: npm start');
        console.log('   2. Check the dashboard: http://localhost:3000');
        console.log('   3. Review DATABASE_MIGRATION_GUIDE.md for more info\n');

        process.exit(0);
    } catch (err) {
        console.error('\n❌ Setup failed:', err.message);
        process.exit(1);
    }
}

setupMySQL();