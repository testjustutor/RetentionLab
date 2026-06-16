/**
 * root/database/headerMenuItemsSeeder.js
 */
const { runAsync, getAsync } = require('./seedHelpers');
const { db } = require('./db');

const DEFAULT_MENU_BY_ROLE = {
  super_admin: [
    { id: 'dashboard', label: 'Dashboard', icon: 'grid', href: '/super_admin/index.html', submenu: null },
    { id: 'rubric-management', label: 'Rubric Management', icon: 'clipboard', href: '/super_admin/rubric-management.html', submenu: null },
    { id: 'sidebar-menu-management', label: 'Sidebar Menu', icon: 'list', href: '/super_admin/sidebar-menu-management.html', submenu: null },
    { id: 'operations', label: 'Operations', icon: 'settings', href: null, submenu: [
      { id: 'calendar-accounts', label: 'Calendar Accounts', href: '/super_admin/calendar-accounts.html' },
      { id: 'calendar-events', label: 'Calendar Events', href: '/super_admin/calendar-events.html' },
      { id: 'data-architecture', label: 'Data Architecture', href: '/super_admin/data-architecture.html' }
    ]},
    { id: 'content', label: 'Content Management', icon: 'folder', href: null, submenu: [
      { id: 'archives', label: 'Archives', href: '/super_admin/archives.html' },
      { id: 'assets', label: 'Assets', href: '/super_admin/assets.html' },
      { id: 'audit', label: 'Audit Log', href: '/super_admin/audit.html' }
    ]},
    { id: 'user-management', label: 'User Management', icon: 'user', href: null, submenu: [
      { id: 'add-user', label: 'Add User', href: '/super_admin/add-user.html' },
      { id: 'manage-users', label: 'Manage Users', href: '/super_admin/manage-users.html' },
      { id: 'roles-access', label: 'Roles & Access', href: '/super_admin/roles-access.html' }
    ]},
    { id: 'system', label: 'System', icon: 'shield', href: null, submenu: [
      { id: 'bot-management', label: 'Bot Management', href: '/super_admin/bot.html' },
      { id: 'settings', label: 'Settings', href: '/super_admin/settings.html' },
      { id: 'profile', label: 'Profile', href: '/super_admin/profile.html' },
      { id: 'user-settings', label: 'User Settings', href: '/super_admin/user-settings.html' }
    ]}
  ],
  admin: [
    { id: 'dashboard', label: 'Dashboard', icon: 'grid', href: '/admin/index.html', submenu: null },
    { id: 'schedules', label: 'Schedules', icon: 'calendar', href: null, submenu: [
      { id: 'calendar-accounts', label: 'Accounts', href: '/admin/calendar-accounts.html' },
      { id: 'calendar-events', label: 'Events', href: '/admin/calendar-events.html' }
    ]},
    { id: 'content', label: 'Content', icon: 'folder', href: null, submenu: [
      { id: 'archives', label: 'Archives', href: '/admin/archives.html' }
    ]},
    { id: 'user-management', label: 'User Management', icon: 'user', href: null, submenu: [
      { id: 'add-user', label: 'Add Reviewer', href: '/admin/add-user.html' }
    ]},
    { id: 'account', label: 'Account', icon: 'user', href: null, submenu: [
      { id: 'profile', label: 'Profile', href: '/admin/profile.html' },
      { id: 'settings', label: 'Settings', href: '/admin/settings.html' }
    ]}
  ],
  reviewer: [
    { id: 'dashboard', label: 'Dashboard', icon: 'grid', href: '/reviewer/index.html', submenu: null },
    { id: 'schedules', label: 'Schedules', icon: 'calendar', href: null, submenu: [
      { id: 'calendar-accounts', label: 'Accounts', href: '/reviewer/calendar-accounts.html' },
      { id: 'calendar-events', label: 'Events', href: '/reviewer/calendar-events.html' }
    ]},
    { id: 'content', label: 'Archives', icon: 'folder', href: '/reviewer/archives.html', submenu: null },
    { id: 'account', label: 'Account', icon: 'user', href: null, submenu: [
      { id: 'profile', label: 'Profile', href: '/reviewer/profile.html' },
      { id: 'settings', label: 'Settings', href: '/reviewer/settings.html' }
    ]}
  ],
  employee: [
    { id: 'dashboard', label: 'Dashboard', icon: 'grid', href: '/employee/index.html', submenu: null },
    { id: 'schedules', label: 'Schedules', icon: 'calendar', href: null, submenu: [
      { id: 'calendar-accounts', label: 'My Calendar', href: '/employee/calendar-accounts.html' },
      { id: 'calendar-events', label: 'Events', href: '/employee/calendar-events.html' }
    ]},
    { id: 'content', label: 'Archives', icon: 'folder', href: '/employee/archives.html', submenu: null },
    { id: 'account', label: 'Account', icon: 'user', href: null, submenu: [
      { id: 'profile', label: 'Profile', href: '/employee/profile.html' },
      { id: 'settings', label: 'Settings', href: '/employee/settings.html' }
    ]}
  ]
};

const seedHeaderMenuItems = async () => {
    const { count } = await getAsync(`SELECT COUNT(*) as count FROM header_menu_items`);
    if (count > 0) return;

    const roles = await new Promise((resolve, reject) => {
        db.all(`SELECT id, role_name FROM roles`, [], (err, rows) => {
            if (err) return reject(err);
            resolve(rows || []);
        });
    });

    for (const role of roles) {
        const menuItems = DEFAULT_MENU_BY_ROLE[role.role_name] || [];

        let displayOrder = 0;
        for (const item of menuItems) {
            await runAsync(
                `INSERT OR IGNORE INTO header_menu_items 
                 (role_id, menu_id, parent_id, label, icon, href, display_order, is_active)
                 VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
                [
                    role.id,
                    item.id,
                    null,
                    item.label,
                    item.icon || null,
                    item.href || null,
                    displayOrder++
                ]
            );

            // Insert submenu items
            if (item.submenu && Array.isArray(item.submenu)) {
                let subOrder = 0;
                for (const subItem of item.submenu) {
                    await runAsync(
                        `INSERT OR IGNORE INTO header_menu_items 
                         (role_id, menu_id, parent_id, label, icon, href, display_order, is_active)
                         VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
                        [
                            role.id,
                            subItem.id,
                            item.id,
                            subItem.label,
                            null,
                            subItem.href || null,
                            subOrder++
                        ]
                    );
                }
            }
        }
    }
};

module.exports = { seedHeaderMenuItems };
