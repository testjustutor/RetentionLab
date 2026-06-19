/**
 * root/public/js/sidebar-config.js
*/
/**
 * Sidebar Navigation Configuration
 * Defines menu structure with submenus for each role
 */

const sidebarConfig = {
  version: '1.0',

  roles: {
    super_admin: {
      label: 'Administrator',
      menuItems: [
        {
          id: 'dashboard',
          label: 'Dashboard',
          icon: 'grid',
          href: '/super_admin/index.html',
          submenu: null
        },
        {
          id: 'operations',
          label: 'Operations',
          icon: 'settings',
          href: null,
          submenu: [
            {
              id: 'calendar-accounts',
              label: 'Calendar Accounts',
              href: '/super_admin/calendar-accounts.html'
            },
            {
              id: 'calendar-events',
              label: 'Calendar Events',
              href: '/super_admin/calendar-events.html'
            },
            {
              id: 'data-architecture',
              label: 'Data Architecture',
              href: '/super_admin/data-architecture.html'
            }
          ]
        },
        {
          id: 'content',
          label: 'Content Management',
          icon: 'folder',
          href: null,
          submenu: [
            {
              id: 'archives',
              label: 'Archives',
              href: '/super_admin/archives.html'
            },
            {
              id: 'assets',
              label: 'Assets',
              href: '/super_admin/assets.html'
            },
            {
              id: 'audit',
              label: 'Audit Log',
              href: '/super_admin/audit.html'
            }
          ]
        },
        {
          id: 'system',
          label: 'System',
          icon: 'shield',
          href: null,
          submenu: [
            {
              id: 'bot-management',
              label: 'Bot Management',
              href: '/super_admin/bot.html'
            },
            {
              id: 'settings',
              label: 'Settings',
              href: '/super_admin/settings.html'
            },
            {
              id: 'profile',
              label: 'Profile',
              href: '/super_admin/profile.html'
            }
          ]
        }
      ]
    },

    admin: {
      label: 'Admin',
      menuItems: [
        {
          id: 'dashboard',
          label: 'Dashboard',
          icon: 'grid',
          href: '/admin/index.html',
          submenu: null
        },
        {
          id: 'schedules',
          label: 'Schedules',
          icon: 'calendar',
          href: null,
          submenu: [
            {
              id: 'calendar-accounts',
              label: 'Accounts',
              href: '/admin/calendar-accounts.html'
            },
            {
              id: 'calendar-events',
              label: 'Events',
              href: '/admin/calendar-events.html'
            }
          ]
        },
        {
          id: 'content',
          label: 'Content',
          icon: 'folder',
          href: null,
          submenu: [
            {
              id: 'archives',
              label: 'Archives',
              href: '/admin/archives.html'
            }
          ]
        },
        {
          id: 'user-management',
          label: 'User Management',
          icon: 'user',
          href: null,
          submenu: [
            {
              id: 'add-user',
              label: 'Add Reviewer',
              href: '/admin/add-user.html'
            }
          ]
        },
        {
          id: 'account',
          label: 'Account',
          icon: 'user',
          href: null,
          submenu: [
            {
              id: 'profile',
              label: 'Profile',
              href: '/admin/profile.html'
            },
            {
              id: 'settings',
              label: 'Settings',
              href: '/admin/settings.html'
            }
          ]
        }
      ]
    },

    reviewer: {
      label: 'Reviewer',
      menuItems: [
        {
          id: 'dashboard',
          label: 'Dashboard',
          icon: 'grid',
          href: '/reviewer/index.html',
          submenu: null
        },
        {
          id: 'schedules',
          label: 'Schedules',
          icon: 'calendar',
          href: null,
          submenu: [
            {
              id: 'calendar-accounts',
              label: 'Accounts',
              href: '/reviewer/calendar-accounts.html'
            },
            {
              id: 'calendar-events',
              label: 'Events',
              href: '/reviewer/calendar-events.html'
            }
          ]
        },
        {
          id: 'content',
          label: 'Archives',
          icon: 'folder',
          href: '/reviewer/archives.html',
          submenu: null
        },
        {
          id: 'account',
          label: 'Account',
          icon: 'user',
          href: null,
          submenu: [
            {
              id: 'profile',
              label: 'Profile',
              href: '/reviewer/profile.html'
            },
            {
              id: 'settings',
              label: 'Settings',
              href: '/reviewer/settings.html'
            }
          ]
        }
      ]
    },

    employee: {
      label: 'Employee',
      menuItems: [
        {
          id: 'dashboard',
          label: 'Dashboard',
          icon: 'grid',
          href: '/employee/index.html',
          submenu: null
        },
        {
          id: 'schedules',
          label: 'Schedules',
          icon: 'calendar',
          href: null,
          submenu: [
            {
              id: 'calendar-accounts',
              label: 'My Calendar',
              href: '/employee/calendar-accounts.html'
            },
            {
              id: 'calendar-events',
              label: 'Events',
              href: '/employee/calendar-events.html'
            }
          ]
        },
        {
          id: 'content',
          label: 'Archives',
          icon: 'folder',
          href: '/employee/archives.html',
          submenu: null
        },
        {
          id: 'account',
          label: 'Account',
          icon: 'user',
          href: null,
          submenu: [
            {
              id: 'profile',
              label: 'Profile',
              href: '/employee/profile.html'
            },
            {
              id: 'settings',
              label: 'Settings',
              href: '/employee/settings.html'
            }
          ]
        }
      ]
    }
  }
};

export default sidebarConfig;
