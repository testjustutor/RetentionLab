/**
 * root/database/seeders/008_header_role_configs.js
 * Seeds header role configurations
 */
const { db, runAsync, getAsync } = require('../seedHelpers');

const DEFAULT_NAV_BY_ROLE = {
  super_admin: {
    home: { label: 'Dashboard', href: '/super_admin' },
    events: { label: 'Events', href: '/super_admin/integrations/bot' },
    archives: { label: 'Archives', href: '/super_admin/storage/archives' },
    profile: { label: 'Profile', href: '/super_admin/people/profile' },
    settings: { label: 'Settings', href: '/super_admin/settings/settings' }
  },
  admin: {
    home: { label: 'Dashboard', href: '/admin/index.html' },
    events: { label: 'Events', href: '/admin/calendar-events.html' },
    archives: { label: 'Archives', href: '/admin/archives.html' },
    profile: { label: 'Profile', href: '/admin/profile.html' },
    settings: { label: 'Settings', href: '/admin/settings.html' }
  },
  reviewer: {
    home: { label: 'Dashboard', href: '/reviewer/dashboard' },
    events: { label: 'Reviews', href: '/reviewer/reviews' },
    archives: { label: 'Sessions', href: '/reviewer/sessions' },
    profile: { label: 'Profile', href: '/reviewer/profile' },
    settings: { label: 'Settings', href: '/reviewer/settings' }
  },
  instructor: {
    home: { label: 'Dashboard', href: '/instructor/index.html' },
    events: { label: 'Events', href: '/instructor/calendar-events.html' },
    archives: { label: 'Archives', href: '/instructor/archives.html' },
    profile: { label: 'Profile', href: '/instructor/profile.html' },
    settings: { label: 'Settings', href: '/instructor/settings.html' }
  },
  solo_instructor: {
    home: { label: 'Dashboard', href: '/instructor/index.html' },
    events: { label: 'Meetings', href: '/meetings' },
    archives: { label: 'Content', href: '/content/recordings' },
    profile: { label: 'Profile', href: '/profile' },
    settings: { label: 'Settings', href: '/settings' }
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
        const nav = DEFAULT_NAV_BY_ROLE[role.role_name] || DEFAULT_NAV_BY_ROLE.instructor;
        if (!DEFAULT_NAV_BY_ROLE[role.role_name]) {
            console.warn(`[Seed] headerRoleConfigSeeder: no nav config for role "${role.role_name}", falling back to instructor defaults.`);
        }

        await runAsync(
            `INSERT IGNORE INTO header_role_configs 
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

module.exports = { seedHeaderRoleConfigs, DEFAULT_NAV_BY_ROLE };