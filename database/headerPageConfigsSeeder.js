/**
 * root/database/headerPageConfigsSeeder.js
 */
const { runAsync, getAsync } = require('./seedHelpers');
const { db } = require('./db');

const DEFAULT_PAGES = {
  dashboard:        { title: 'Console',            description: 'Dashboard overview',                                        roleTitle: 'Console', showStats: true,  buttons: [] },
  profile:          { title: 'My Profile',         description: 'View and update your profile',                              roleTitle: 'Console', showStats: false, buttons: [] },
  settings:         { title: 'Settings',           description: 'Manage your preferences',                                   roleTitle: 'Console', showStats: false, buttons: [] },
  archives:         { title: 'Archives',           description: 'Browse archived records',                                   roleTitle: 'Console', showStats: false, buttons: [] },
  events:           { title: 'Events',             description: 'View event timeline',                                       roleTitle: 'Console', showStats: false, buttons: [] },
  calendarAccounts: { title: 'Calendar Accounts',  description: 'Manage connected calendar accounts and email sources.',     roleTitle: 'Console', showStats: false, buttons: [] },
  bot:              { title: 'Bot Engine Console', description: 'Monitor real-time orchestrator instances and active bots.', roleTitle: 'Console', showStats: false, buttons: [] },
  assets:           { title: 'Media Assets',       description: 'View partitioned audio chunks and raw exports.',            roleTitle: 'Console', showStats: false, buttons: [] },
  audit:            { title: 'Audit Timeline',     description: 'Review system audit logs and compliance tracking.',         roleTitle: 'Console', showStats: false, buttons: [] },
  dataArchitecture: { title: 'Data Architecture',  description: 'Inspect schema models, retention flows, and topology.',    roleTitle: 'Console', showStats: false, buttons: [] },
  addUser:          { title: 'Add User',           description: 'Create new users and assign roles.',                         roleTitle: 'Super Admin', showStats: false, buttons: [] },
  manageUsers:      { title: 'Manage Users',       description: 'View, update, and delete user accounts.',                   roleTitle: 'Super Admin', showStats: false, buttons: [] },
  rolesAccess:      { title: 'Roles & Access',      description: 'Define and manage user roles and permissions.',             roleTitle: 'Super Admin', showStats: false, buttons: [] },
  userSettings:     { title: 'User Settings',      description: 'Configure global user-related settings.',                  roleTitle: 'Super Admin', showStats: false, buttons: [] },
  rubricManagement: { title: 'Rubric Management',   description: 'Create, manage, and assign rubric categories and indicators.', roleTitle: 'Super Admin', showStats: false, buttons: [] },
  sidebarMenuManagement: { title: 'Sidebar Menu Management', description: 'Create, edit, and delete sidebar menu items for all roles.', roleTitle: 'Super Admin', showStats: false, buttons: [] }
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

    for (const role of roles) {
        for (const [pageKey, pageData] of Object.entries(DEFAULT_PAGES)) {
            await runAsync(
                `INSERT IGNORE INTO header_page_configs 
                 (role_id, page_key, title, description, role_title, show_stats, buttons_json)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    role.id,
                    pageKey,
                    pageData.title,
                    pageData.description,
                    pageData.roleTitle,
                    pageData.showStats ? 1 : 0,
                    JSON.stringify(pageData.buttons)
                ]
            );
        }
    }
};

module.exports = { seedHeaderPageConfigs };