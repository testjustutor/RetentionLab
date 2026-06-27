#!/usr/bin/env node

/**
 * SQLite to MySQL Data Migration Script
 * Usage: node database/migrate-sqlite-to-mysql.js
 * 
 * This script helps migrate data from an SQLite database to MySQL
 * Requirements: sqlite3 and mysql2 packages
 */

const sqlite3 = require('sqlite3').verbose();
const mysql = require('mysql2/promise');
require('dotenv').config();
const path = require('path');
const fs = require('fs');

const SQLITE_PATH = path.join(__dirname, '..', 'retention_lab_backup.db');
const SKIP_TABLES = ['sqlite_sequence']; // Skip SQLite internal tables

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'retention_lab'
});

async function migrateData() {
    console.log('🔄 Starting SQLite to MySQL migration...\n');

    // Check if SQLite file exists
    if (!fs.existsSync(SQLITE_PATH)) {
        console.log('❌ SQLite database not found at:', SQLITE_PATH);
        console.log('   If you have an SQLite backup, place it at that location and try again.');
        process.exit(1);
    }

    const sqliteDb = new sqlite3.Database(SQLITE_PATH);

    try {
        // Get list of tables from SQLite
        const tables = await new Promise((resolve, reject) => {
            sqliteDb.all(
                "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
                (err, tables) => {
                    if (err) reject(err);
                    else resolve(tables.map(t => t.name));
                }
            );
        });

        console.log(`Found ${tables.length} tables to migrate:\n`);

        const connection = await pool.getConnection();

        for (const tableName of tables) {
            if (SKIP_TABLES.includes(tableName)) continue;

            try {
                // Get data from SQLite
                const rows = await new Promise((resolve, reject) => {
                    sqliteDb.all(`SELECT * FROM ${tableName}`, (err, rows) => {
                        if (err) reject(err);
                        else resolve(rows || []);
                    });
                });

                if (rows.length === 0) {
                    console.log(`⏭️  ${tableName}: No data to migrate`);
                    continue;
                }

                // Build INSERT IGNORE query
                const columns = Object.keys(rows[0]);
                const placeholders = columns.map(() => '?').join(', ');
                const insertQuery = `INSERT IGNORE INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`;

                let migratedCount = 0;
                for (const row of rows) {
                    const values = columns.map(col => {
                        let val = row[col];
                        // Convert SQLite UNIX timestamps if needed
                        if (val && typeof val === 'number' && col.includes('_at')) {
                            // This is handled by MySQL - keep the value as is
                        }
                        return val;
                    });

                    try {
                        await connection.query(insertQuery, values);
                        migratedCount++;
                    } catch (err) {
                        // Log error but continue with other rows
                        console.error(`  Error inserting row in ${tableName}:`, err.message);
                    }
                }

                console.log(`✅ ${tableName}: ${migratedCount}/${rows.length} rows migrated`);

            } catch (err) {
                console.log(`⚠️  ${tableName}: Migration failed - ${err.message}`);
            }
        }

        await connection.release();
        console.log('\n✅ Migration complete!');
        console.log('   Run `npm run db:seed` to populate any missing reference data.');

    } catch (err) {
        console.error('❌ Migration failed:', err.message);
        process.exit(1);
    } finally {
        sqliteDb.close();
        await pool.end();
    }
}

migrateData().catch(console.error);

module.exports = { migrateData };
