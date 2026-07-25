# Database Seeders

This directory contains all database seeder files for the RetentionLab application. The seeders are organized in a numbered sequence to ensure proper dependency order.

## Structure

All seeders follow a numbered naming convention to ensure they run in the correct order:

```
database/seeders/
├── 001_roles.js                    # Seeds user roles (must run first)
├── 002_companies.js                # Seeds company/organization data
├── 003_permissions.js              # Seeds permissions and role-permission mappings
├── 004_super_admin.js              # Seeds super admin user
├── 005_admin_user.js               # Seeds default admin user
├── 006_rubric.js                   # Seeds rubric categories and indicators
├── 007_settings.js                 # Seeds system and user settings
├── 008_header_role_configs.js      # Seeds header navigation configs per role
├── 009_header_menu_items.js        # Seeds header menu items per role
├── 010_header_page_configs.js      # Seeds page-specific header configs
├── 011_session_quality.js          # Seeds session quality sample data
└── README.md                       # This file
```

## Running the Seeders

### Option 1: Using npm script (Recommended)
```bash
npm run db:seed
```

### Option 2: Direct command
```bash
node database/seeder.js
```

### Option 3: Alternative npm script
```bash
npm run db:run:seed
```

## Seeder Execution Order

The seeders run in a specific order to respect foreign key dependencies:

1. **Roles** - Must be seeded first as all other seeders depend on roles
2. **Companies** - Required for admin user creation
3. **Permissions** - Depends on roles
4. **Super Admin** - Depends on roles
5. **Admin User** - Depends on roles and companies
6. **Rubric** - Depends on roles (creates evaluation framework)
7. **Settings** - Depends on users (creates system and user preferences)
8. **Header Role Configs** - Depends on roles
9. **Header Menu Items** - Depends on roles
10. **Header Page Configs** - Depends on roles
11. **Session Quality** - Depends on meeting_sessions (optional, requires existing sessions)
12. **System Settings Sample** - Independent, seeds bot/AI/platform configs

## Data Preserved

**Important:** All seeders are designed to preserve existing data:

- **INSERT IGNORE** - Used for most inserts to avoid duplicate key errors
- **Early returns** - Seeders check if data exists before inserting
- **ON DUPLICATE KEY UPDATE** - Used for upsert operations where appropriate
- **DELETE before INSERT** - Only used for menu items where order matters

Your manually inserted data will **not** be overwritten.

## Verification

To verify that seeders ran successfully:

```bash
node database/verify_seeders.js
```

This will show:
- Record counts for all seeded tables
- Sample data preview (users, roles, settings)
- Status indicators (✅ for success, ⚠️ for warnings)

## Expected Data Counts

After successful seeding, you should see approximately:

| Table | Records |
|-------|---------|
| roles | 5 |
| companies | 2 |
| permissions | 24 |
| role_permissions | ~1700+ |
| users | 4+ |
| rubric_categories | 8 |
| rubric_indicators | 94 |
| system_settings | 150+ |
| user_settings | 90+ |
| header_role_configs | 5 |
| header_menu_items | 90+ |
| header_page_configs | 285 |

## Creating New Seeders

When creating new seeders:

1. **Use numbered prefix** - e.g., `013_your_feature.js`
2. **Export a single async function** named `seedYourFeature`
3. **Use seedHelpers** - Import `runAsync`, `getAsync`, `allAsync` from `../seedHelpers`
4. **Check for existing data** - Return early if data already exists
5. **Use INSERT IGNORE** - Prevent duplicate key errors
6. **Add to database/index.js** - Import and add to `runSeeder()` function
7. **Update this README** - Document the new seeder

### Example Seeder Template

```javascript
/**
 * root/database/seeders/013_your_feature.js
 * Description of what this seeder does
 */
const { runAsync, getAsync } = require('../seedHelpers');

const seedYourFeature = async () => {
    // Check if already seeded
    const { count } = await getAsync(`SELECT COUNT(*) as count FROM your_table`);
    if (count > 0) {
        console.log('[Seed] Your feature already seeded, skipping...');
        return;
    }

    // Your seeding logic here
    await runAsync(
        `INSERT IGNORE INTO your_table (column1, column2) VALUES (?, ?)`,
        [value1, value2]
    );

    console.log('[Seed] Your feature seeded successfully');
};

module.exports = { seedYourFeature };
```

## Troubleshooting

### Session Quality Seeder Skipped
The session quality seeder requires existing `meeting_sessions` data. If you see:
```
warn: [SessionQualitySeeder] No meeting_sessions found — skipping
```

This is normal for fresh databases. Create a meeting/session first, then re-run seeders.

### Duplicate Key Errors
All seeders use `INSERT IGNORE` or check for existing data, so duplicate key errors should not occur. If they do, check:
- The seeder is using proper idempotent queries
- Foreign key constraints are satisfied

### Permission Errors
Ensure:
- Database is initialized (`npm run db:init`)
- MySQL is running
- Database credentials are correct in `.env`

## Environment Variables

Some seeders use environment variables with fallback defaults:

- `SUPER_ADMIN_EMAIL` - Default: `superadmin@retentionlab.local`
- `SUPER_ADMIN_PASSWORD` - Default: `Admin@123`
- `ADMIN_EMAIL` - Default: `admin@demo.local`
- `ADMIN_PASSWORD` - Default: `AdminDemo@123`
- `ADMIN_COMPANY_CODE` - Default: `DEFAULT`

## Dependencies

Seeders depend on:
- `database/db.js` - Database connection
- `database/seedHelpers.js` - Helper functions (runAsync, getAsync, allAsync)
- `config/settings.js` - Application configuration (for settings seeder)
- `utils/logger.js` - Logging utility

## Notes

- Seeders are **idempotent** - safe to run multiple times
- Seeders preserve existing data - no data loss
- Order matters - respect the numbered sequence
- Some seeders depend on others - check dependencies before reordering