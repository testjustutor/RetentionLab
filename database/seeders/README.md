# Database Seeders

This directory contains all database seeder files for the RetentionLab application. The seeders are organized in a numbered sequence to ensure proper dependency order.

## Structure

All seeders follow a numbered naming convention to ensure they run in the correct order:

```
database/seeders/
├── 000_comprehensive_seeder.js     # COMPREHENSIVE: Seeds ALL tables in one file
├── 001_roles.js                    # Seeds user roles (must run first)
├── 002_companies.js                # Seeds company/organization data
├── 003_permissions.js              # Seeds permissions and role-permission mappings
├── 004_super_admin.js              # Seeds super admin user
├── 005_admin_user.js               # Seeds default admin user
├── 006_rubric.js                   # Seeds rubric categories and indicators
├── 006_test_users.js               # Seeds test users (instructor, solo_instructor, reviewer)
├── 007_settings.js                 # Seeds system and user settings
├── 008_header_role_configs.js      # Seeds header navigation configs per role
├── 009_header_menu_items.js        # Seeds header menu items per role
├── 010_header_page_configs.js      # Seeds page-specific header configs
├── 011_session_quality.js          # Seeds session quality sample data
├── 013_user_permissions.js         # Seeds user-specific permission overrides
├── 014_subscriptions.js            # Seeds subscription plans
├── 015_header_configs.js           # Seeds header config (logos, titles, themes)
├── 016_calendar_providers.js       # Seeds calendar providers (Zoom, Google Meet, Teams)
├── 017_menu_items.js               # Seeds sidebar menu items with nested structure
├── 018_role_menu_permissions.js    # Seeds default role-based menu permissions
├── 019_user_menu_permissions.js    # Seeds user-specific menu overrides
└── README.md                       # This file
```

## The Comprehensive Seeder (Recommended)

**`000_comprehensive_seeder.js`** is the recommended way to seed a fresh database. It seeds **ALL tables** in a single execution, handling all FK dependencies internally. It combines the logic of all 19 individual seeders plus additional data for tables that had no dedicated seeder.

### Benefits over individual seeders:
- **Single execution** — seeds everything in one pass
- **Dependency-order guaranteed** — handles FK relationships internally
- **More complete** — seeds departments, meetings, participants, transcripts, session quality, and other tables that individual seeders skip
- **Idempotent** — safe to run multiple times (checks for existing data before inserting)
- **Consistent with migrations** — mirrors the pattern of `000_comprehensive_schema.js`

### Usage:
```bash
# Run standalone
node database/seeders/000_comprehensive_seeder.js

# Or programmatically
const { seedAll } = require('./000_comprehensive_seeder');
await seedAll();
```

## Running the Seeders

### Option 1: Comprehensive Seeder (Recommended for fresh installs)
```bash
node database/seeders/000_comprehensive_seeder.js
```

### Option 2: Using npm script
```bash
npm run db:seed
```

### Option 3: Direct command
```bash
node database/seeder.js
```

### Option 4: Alternative npm script
```bash
npm run db:run:seed
```

### Option 5: Run individual seeder directly
Each seeder can be executed independently (useful for debugging or re-seeding a specific table):

```bash
# Run a single seeder
node database/seeders/001_roles.js
node database/seeders/006_test_users.js
node database/seeders/019_user_menu_permissions.js

# Run multiple seeders sequentially (PowerShell)
node database/seeders/001_roles.js; node database/seeders/002_companies.js

# Run multiple seeders sequentially (Bash)
node database/seeders/001_roles.js && node database/seeders/002_companies.js
```

## Seeder Execution Order

The seeders run in a specific order to respect foreign key dependencies. **The comprehensive seeder (000) handles all of these internally:**

1. **001_roles** - Must be seeded first as all other seeders depend on roles
2. **002_companies** - Required for admin user creation
3. **003_permissions** - Depends on roles
4. **004_super_admin** - Depends on roles
5. **005_admin_user** - Depends on roles and companies
6. **006_rubric** / **006_test_users** - Depends on roles and companies
7. **007_settings** - Depends on users (creates system and user preferences)
8. **008_header_role_configs** - Depends on roles
9. **009_header_menu_items** - Depends on roles
10. **010_header_page_configs** - Depends on roles
11. **011_session_quality** - Depends on meeting_sessions
12. **013_user_permissions** - Depends on users and permissions
13. **014_subscriptions** - Depends on companies
14. **015_header_configs** - Independent, seeds header config data
15. **016_calendar_providers** - Independent, seeds calendar providers
16. **017_menu_items** - Independent, seeds sidebar menu items
17. **018_role_menu_permissions** - Depends on roles and menu_items
18. **019_user_menu_permissions** - Depends on users and menu_items

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