/**
 * root/database/seeders/003_permissions.js
 *
 * Seeds the master permission catalog and default role->permission mappings.
 *
 * role_name values below ('super_admin', 'admin', 'reviewer', 'instructor')
 * match root/database/roles.js exactly. Unknown role names are skipped
 * with a console warning rather than failing the seed run, in case
 * roles.js changes later.
 */
const { runAsync, allAsync } = require('../seedHelpers');

// ─── Master permission catalog ──────────────────────────────────────────────
const PERMISSIONS = [
    // Users & Access
    { key: 'users.view',         label: 'View Users',           category: 'Users',    description: 'View company user list' },
    { key: 'users.manage',       label: 'Manage Users',         category: 'Users',    description: 'Create/edit/deactivate users' },
    { key: 'users.invite',       label: 'Invite Users',         category: 'Users',    description: 'Send user invitations' },
    { key: 'roles.manage',       label: 'Manage Roles',         category: 'Users',    description: 'Create/edit roles' },
    { key: 'permissions.manage', label: 'Manage Permissions',   category: 'Users',    description: 'Assign permissions to roles/users' },

    // Rubrics
    { key: 'rubrics.view',       label: 'View Rubrics',         category: 'Rubrics',  description: 'View rubric library' },
    { key: 'rubrics.manage',     label: 'Manage Rubrics',       category: 'Rubrics',  description: 'Create/edit/delete rubrics' },

    // Reviews / Scoring
    { key: 'reviews.view',       label: 'View Reviews',         category: 'Reviews',  description: 'View review assignments and scores' },
    { key: 'reviews.assign',     label: 'Assign Reviews',       category: 'Reviews',  description: 'Assign reviewers to sessions' },
    { key: 'reviews.score',      label: 'Score Sessions',       category: 'Reviews',  description: 'Submit scores against a rubric' },

    // Meetings
    { key: 'meetings.view',      label: 'View Meetings',        category: 'Meetings', description: 'View meeting/session list' },
    { key: 'meetings.manage',    label: 'Manage Meetings',      category: 'Meetings', description: 'Create/edit meetings, manage participants' },

    // Reports & AI
    { key: 'reports.view',       label: 'View Reports',         category: 'Reports',  description: 'View quality/AI audit reports' },
    { key: 'reports.export',     label: 'Export Reports',       category: 'Reports',  description: 'Export reports/data' },
    { key: 'ai_audit.view',      label: 'View AI Audit Results',category: 'Reports',  description: 'View AI audit engine output' },

    // Archive
    { key: 'archive.view',       label: 'View Archive',         category: 'Archive',  description: 'View archived meetings/sessions' },
    { key: 'archive.manage',     label: 'Manage Archive',       category: 'Archive',  description: 'Archive/restore meetings' },

    // Company / Settings
    { key: 'settings.manage',    label: 'Manage Settings',      category: 'Settings', description: 'Edit company-level settings' },
    { key: 'company.manage',     label: 'Manage Company',       category: 'Settings', description: 'Owner-level: billing, ownership transfer, deletion' },

    // Solo Instructor (own-data only)
    { key: 'meetings.view_own',  label: 'View Own Meetings',    category: 'Meetings', description: 'View only meetings owned by the current user' },
    { key: 'meetings.manage_own',label: 'Manage Own Meetings',  category: 'Meetings', description: 'Create/edit meetings owned by the current user' },
    { key: 'calendar.connect',   label: 'Connect Calendar',     category: 'Calendar', description: 'Connect and manage personal calendar integrations' },
    { key: 'reports.view_own',   label: 'View Own Reports',     category: 'Reports',  description: 'View AI/quality reports for own sessions only' },
    { key: 'profile.edit',       label: 'Edit Profile',         category: 'Profile',  description: 'Edit own profile and account details' },
];

// ─── Default global role -> permission mapping (company_id = NULL) ─────────
// Keys must match roles.js role_name values exactly.
const DEFAULT_ROLE_PERMISSIONS = {
    super_admin: PERMISSIONS.map(p => p.key), // everything
    admin: [
        'users.view', 'users.manage', 'users.invite', 'roles.manage', 'permissions.manage',
        'rubrics.view', 'rubrics.manage',
        'reviews.view', 'reviews.assign',
        'meetings.view', 'meetings.manage',
        'reports.view', 'reports.export', 'ai_audit.view',
        'archive.view', 'archive.manage',
        'settings.manage', 'company.manage',
    ],
    reviewer: [
        'rubrics.view',
        'reviews.view', 'reviews.score',
        'meetings.view',
        'reports.view',
        'archive.view',
    ],
    // Instructor/tutor being reviewed — not a reviewer themselves.
    instructor: [
        'meetings.view',
        'reports.view',
        'archive.view',
    ],
    // Self-registered individual — sees only their own data, no team features.
    solo_instructor: [
        'meetings.view_own',
        'meetings.manage_own',
        'calendar.connect',
        'reports.view_own',
        'archive.view',
        'profile.edit',
    ],
};

const seedPermissions = async () => {
    // 1. Upsert the permission catalog
    for (const perm of PERMISSIONS) {
        await runAsync(
            `INSERT IGNORE INTO permissions (permission_key, label, category, description)
             VALUES (?, ?, ?, ?)`,
            [perm.key, perm.label, perm.category, perm.description]
        );
    }

    // 2. Load roles and permissions to resolve ids
    const roles = await allAsync('SELECT id, role_name FROM roles');
    const permissionRows = await allAsync('SELECT id, permission_key FROM permissions');
    const permIdByKey = Object.fromEntries(permissionRows.map(p => [p.permission_key, p.id]));

    // 3. Assign default global permissions per role (company_id = NULL)
    for (const [roleName, permKeys] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
        const role = roles.find(r => r.role_name === roleName);
        if (!role) {
            console.warn(`[Seed] permissionsSeeder: role "${roleName}" not found, skipping. ` +
                `Check role_name values in roles.js if this is unexpected.`);
            continue;
        }
        for (const key of permKeys) {
            const permissionId = permIdByKey[key];
            if (!permissionId) continue;
            await runAsync(
                `INSERT IGNORE INTO role_permissions (role_id, permission_id, company_id)
                 VALUES (?, ?, NULL)`,
                [role.id, permissionId]
            );
        }
    }

    console.log('[Seed] Permissions and default role_permissions seeded');
};

module.exports = { seedPermissions, PERMISSIONS, DEFAULT_ROLE_PERMISSIONS };

// Run seeder if executed directly
if (require.main === module) {
  seedPermissions()
    .then(() => {
      console.log('[Seed] ✓ Permissions seeder completed successfully');
      process.exit(0);
    })
    .catch(err => {
      console.error('[Seed] ✗ Permissions seeder failed:', err);
      process.exit(1);
    });
}
