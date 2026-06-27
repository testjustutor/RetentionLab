# SQLite to MySQL Migration Guide

## Status
✅ MySQL database connection established
✅ Core seeders converted to MySQL syntax
✅ Table structure created in MySQL

## What Has Been Done

### 1. Database Connection (db.js)
- Switched from SQLite to MySQL using `mysql2` package
- Created compatibility layer with `db.run()`, `db.all()`, `db.get()` methods
- Connection pooling configured for better performance

### 2. Seeder Updates
All seeders have been updated to use MySQL syntax:
- ✅ `INSERT OR IGNORE` → `INSERT IGNORE`
- ✅ `INSERT OR REPLACE` → `INSERT IGNORE` (check specific logic)
- ✅ SQLite transactions removed from seeders

### 3. Syntax Fixes Applied
- roles.js
- companiesSeeder.js
- headerPageConfigsSeeder.js
- headerRoleConfigSeeder.js
- permissionsSeeder.js
- rubricSeeder.js (converted to async/await)
- MeetingReviewersModel.js
- ParticipantsModel.js
- RolesModel.js
- transcriptModel.js
- RubricAdminModel.js

## Data Migration Steps

### Option 1: Use Existing MySQL Tables (Recommended)
If your MySQL tables are already populated:

```bash
npm run db:seed
```

This will seed any missing master data (roles, permissions, rubric definitions, etc.)

### Option 2: Migrate from SQLite Backup

If you have an SQLite database with production data:

1. **Export SQLite data to CSV:**
   ```bash
   sqlite3 retention_lab_backup.db
   
   # For each table, run:
   .mode csv
   .headers on
   .output table_name.csv
   SELECT * FROM table_name;
   ```

2. **Import into MySQL:**
   ```sql
   LOAD DATA LOCAL INFILE '/path/to/table_name.csv'
   INTO TABLE table_name
   FIELDS TERMINATED BY ','
   ENCLOSED BY '"'
   LINES TERMINATED BY '\n'
   IGNORE 1 ROWS;
   ```

3. **Re-seed missing data:**
   ```bash
   npm run db:seed
   ```

## Known Issues & Solutions

### Issue: "db.serialize is not a function"
**Solution:** ✅ Fixed in rubricSeeder.js - converted to async/await

### Issue: "INSERT OR IGNORE" syntax error
**Solution:** ✅ Fixed throughout codebase - replaced with MySQL-compatible syntax

### Issue: Model tables using AUTOINCREMENT and TEXT PRIMARY KEY
**Status:** Requires further refactoring of models
- Models currently use SQLite-specific methods like `db.prepare()` and `ON CONFLICT`
- These need to be refactored to use the MySQL compatibility layer

### Issue: "AUTOINCREMENT" syntax
**Note:** This keyword is still present in model CREATE TABLE statements but won't execute since tables already exist

## Next Steps

### To fully complete migration:

1. **Update Model Table Creation (if needed):**
   - Convert `db.prepare()` calls to use `db.run()` compatibility layer
   - Replace `ON CONFLICT` with `ON DUPLICATE KEY UPDATE`
   - Update column types for MySQL compatibility

2. **Test each model's data operations:**
   - CalendarUsersModel
   - CalendarVerificationModel
   - RubricAdminModel
   - ParticipantModel
   - ParticipantsModel
   - MeetingReviewersModel
   - transcriptModel

3. **Run integration tests:**
   ```bash
   npm start
   npm run dev
   ```

## Seed Command Usage

```bash
# Initialize database connection
npm run db:init

# Seed base data (roles, permissions, companies, rubric, etc.)
npm run db:seed

# Build (both init and seed)
npm run build
```

## Configuration

Ensure `.env` has correct MySQL credentials:
```env
DB_HOST=localhost
DB_PORT=3306
DB_NAME=retention_lab
DB_USER=root
DB_PASSWORD=your_password
```

## Troubleshooting

### Connection refused
- Verify MySQL is running
- Check credentials in `.env`
- Ensure `retention_lab` database exists

### "Unknown column" error
- Verify all tables exist in MySQL
- Check column names match between SQLite and MySQL schemas

### Seeding fails with "Duplicate entry"
- Some data may already exist (this is normal)
- Use `INSERT IGNORE` to skip existing records

## Rollback Plan

If needed to revert to SQLite:
1. Keep `db-sqlite.js` as backup (current location)
2. Restore `db.js` from git history or backup
3. Update connection string back to SQLite path
