/**
 * root/database/headerRoleConfigSeeder.js
 */
const { runAsync, getAsync } = require('./seedHelpers');
const { db } = require('./db');

const DEFAULT_NAV_BY_ROLE = {
  super_admin: {
    home: { label: 'Dashboard', href: '/super_admin/index.html' },
    events: { label: 'Events', href: '/super_admin/calendar-events.html' },
    archives: { label: 'Archives', href: '/super_admin/archives.html' },
    profile: { label: 'Profile', href: '/super_admin/profile.html' },
    settings: { label: 'Settings', href: '/super_admin/settings.html' }
  },
  admin: {
    home: { label: 'Dashboard', href: '/admin/index.html' },
    events: { label: 'Events', href: '/admin/calendar-events.html' },
    archives: { label: 'Archives', href: '/admin/archives.html' },
    profile: { label: 'Profile', href: '/admin/profile.html' },
    settings: { label: 'Settings', href: '/admin/settings.html' }
  },
  reviewer: {
    home: { label: 'Dashboard', href: '/reviewer/index.html' },
    events: { label: 'Events', href: '/reviewer/calendar-events.html' },
    archives: { label: 'Archives', href: '/reviewer/archives.html' },
    profile: { label: 'Profile', href: '/reviewer/profile.html' },
    settings: { label: 'Settings', href: '/reviewer/settings.html' }
  },
  employee: {
    home: { label: 'Dashboard', href: '/employee/index.html' },
    events: { label: 'Events', href: '/employee/calendar-events.html' },
    archives: { label: 'Archives', href: '/employee/archives.html' },
    profile: { label: 'Profile', href: '/employee/profile.html' },
    settings: { label: 'Settings', href: '/employee/settings.html' }
  }
};

const seedHeaderRoleConfigs = async () => {
    const { count } = await getAsync(`SELECT COUNT(*) as count FROM header_role_configs`);
    if (count > 0) return;

    const roles = await new Promise((resolve, reject) => {
        db.all(`SELECT id, role_name FROM roles`, [], (err, rows) => {
            if (err) return reject(err);
            resolve(rows || []);
        });
    });

    for (const role of roles) {
        const nav = DEFAULT_NAV_BY_ROLE[role.role_name] || DEFAULT_NAV_BY_ROLE.employee;

        await runAsync(
            `INSERT OR IGNORE INTO header_role_configs 
             (role_id, home_href, home_label, events_href, events_label, archives_href, archives_label, 
              profile_href, profile_label, settings_href, settings_label)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                role.id,
                nav.home?.href || '/dashboard.html',
                nav.home?.label || 'Home',
                nav.events?.href || '/events.html',
                nav.events?.label || 'Events',
                nav.archives?.href || '/archives.html',
                nav.archives?.label || 'Archives',
                nav.profile?.href || '/profile.html',
                nav.profile?.label || 'Profile',
                nav.settings?.href || '/settings.html',
                nav.settings?.label || 'Settings'
            ]
        );
    }
};

module.exports = { seedHeaderRoleConfigs };
