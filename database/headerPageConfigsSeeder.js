/**
 * root/database/headerPageConfigsSeeder.js
 */
const { runAsync, getAsync } = require('./seedHelpers');
const { db } = require('./db');

const DEFAULT_PAGES = {
  dashboard:         { title: 'Dashboard',             description: 'View your dashboard and recent activity.',                       roleTitle: 'Dashboard', showStats: true, buttons: [] },
  archives:          { title: 'Archives',              description: 'Browse and manage archived meetings.',                           roleTitle: 'Archives', showStats: false, buttons: [] },
  assets:            { title: 'Assets',                description: 'Manage media and content assets.',                               roleTitle: 'Assets', showStats: false, buttons: [] },
  audit:             { title: 'Audit Log',             description: 'View system activity and user actions.',                         roleTitle: 'Audit', showStats: false, buttons: [] },
  botManagement:     { title: 'Bot Management',        description: 'Configure and manage bot settings.',                             roleTitle: 'Settings', showStats: false, buttons: [] },
  calendarAccounts:  { title: 'Calendar Accounts',     description: 'Manage connected calendar integrations.',                       roleTitle: 'Accounts', showStats: false, buttons: [] },
  calendarEvents:    { title: 'Calendar Events',       description: 'View and manage calendar events.',                               roleTitle: 'Events', showStats: false, buttons: [] },
  dataArchitecture:  { title: 'Data Architecture',     description: 'Inspect schema models, retention flows, and topology.',          roleTitle: 'Console', showStats: false, buttons: [] },
  profile:           { title: 'Profile',               description: 'Manage your account profile and preferences.',                  roleTitle: 'Profile', showStats: false, buttons: [] },
  settings:          { title: 'Settings',              description: 'Configure system and personal settings.',                        roleTitle: 'Settings', showStats: false, buttons: [] },
  userSettings:      { title: 'User Settings',         description: 'Manage user account settings.',                                  roleTitle: 'Settings', showStats: false, buttons: [] },
  addUser:           { title: 'Add User',              description: 'Create and add new user accounts.',                              roleTitle: 'User Management', showStats: false, buttons: [] },
  manageUsers:       { title: 'Manage Users',          description: 'Edit, deactivate, and manage user accounts.',                   roleTitle: 'User Management', showStats: false, buttons: [] },
  rolesAccess:       { title: 'Roles & Access',        description: 'Manage user roles and access permissions.',                     roleTitle: 'User Management', showStats: false, buttons: [] },
  rubricManagement:  { title: 'Rubric Management',     description: 'Create, manage, and assign rubric categories and indicators.',   roleTitle: 'Super Admin', showStats: false, buttons: [] },
  sidebarMenuManagement: { title: 'Sidebar Menu Management', description: 'Create, edit, and delete sidebar menu items for all roles.', roleTitle: 'Super Admin', showStats: false, buttons: [] },
  myWorkspace:       { title: 'My Workspace',          description: 'Your personal dashboard — meetings, reports, and calendar.',      roleTitle: 'My Workspace', showStats: true, buttons: [] }
};

const seedHeaderPageConfigs = async () => {
    const { count } = await getAsync(`SELECT COUNT(*) as count FROM header_page_configs`);
    if (count > 0) return;

    const roles = await new Promise((resolve, reject) => {
        db.all(`SELECT id, role_name FROM roles`, [], (err, rows) => {
            if (err) return reject(err);
            resolve(rows || []);
        });
    });

    // Seed all pages for all roles
    for (const role of roles) {
        for (const [pageKey, pageData] of Object.entries(DEFAULT_PAGES)) {
            await runAsync(
                `INSERT OR IGNORE INTO header_page_configs 
                 (role_id, page_key, title, description, role_title, show_stats, buttons_json)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    role.id,
                    pageKey,
                    pageData.title,
                    pageData.description,
                    pageData.roleTitle,
                    pageData.showStats ? 1 : 0,
                    JSON.stringify(pageData.buttons || [])
                ]
            );
        }
    }
};

module.exports = { seedHeaderPageConfigs };