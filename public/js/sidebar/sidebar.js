/**
 * root/public/js/sidebar.js
 * 
 * Merged sidebar utilities:
 *  - Sidebar controller
 *  - Sidebar config
 */

// ========== SIDEBAR CONFIG ==========

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
      label: 'Instructor',
      menuItems: [
        {
          id: 'dashboard',
          label: 'Dashboard',
          icon: 'grid',
          href: '/instructor/index.html',
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
              href: '/instructor/calendar-accounts.html'
            },
            {
              id: 'calendar-events',
              label: 'Events',
              href: '/instructor/calendar-events.html'
            }
          ]
        },
        {
          id: 'content',
          label: 'Archives',
          icon: 'folder',
          href: '/instructor/archives.html',
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
              href: '/instructor/profile.html'
            },
            {
              id: 'settings',
              label: 'Settings',
              href: '/instructor/settings.html'
            }
          ]
        }
      ]
    }
  }
};

export default sidebarConfig;

// ========== SIDEBAR CONTROLLER ==========

function $(id) {
  return document.getElementById(id);
}

const SIDEBAR_CACHE_KEY = 'rl_sidebar_menu';
const SIDEBAR_INFLIGHT_KEY = '__rl_sidebar_menu_inflight__';

function getCachedSidebarMenu() {
  try {
    const raw = sessionStorage.getItem(SIDEBAR_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function setCachedSidebarMenu(menu) {
  try {
    sessionStorage.setItem(SIDEBAR_CACHE_KEY, JSON.stringify(menu));
  } catch {
    // ignore
  }
}

  async function fetchSidebarMenu(forceRefresh = false) {
    // 1) Cache fast-path unless a refresh is explicitly requested
    if (!forceRefresh) {
      const cached = getCachedSidebarMenu();
      if (cached) return cached;
    }

    // 2) In-flight de-dupe
    if (globalThis[SIDEBAR_INFLIGHT_KEY]) return globalThis[SIDEBAR_INFLIGHT_KEY];

    const promise = (async () => {
      try {
        const res = await fetch('/api/sidebar/menu', {
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' }
        });

        if (!res.ok) {
          throw new Error(`Sidebar API returned status ${res.status}`);
        }

        const data = await res.json();
        if (!data?.success || !data.menu) {
          throw new Error('Invalid sidebar API response');
        }

        // Cache the successful response as-is (normalization happens in populateSidebar)
        setCachedSidebarMenu(data.menu);
        return data.menu;
      } catch (err) {
        console.error('Failed to fetch sidebar menu:', err);
        return null;
      }
    })();

    globalThis[SIDEBAR_INFLIGHT_KEY] = promise;

    try {
      return await promise;
    } finally {
      delete globalThis[SIDEBAR_INFLIGHT_KEY];
    }
  }

function getIconSvg(iconName) {
  const icons = {
    grid: '<svg class="menu-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>',
    settings: '<svg class="menu-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M12 1v6m0 6v6M4.22 4.22l4.24 4.24m2.96 2.96l4.24 4.24M1 12h6m6 0h6M4.22 19.78l4.24-4.24m2.96-2.96l4.24-4.24M19.78 19.78l-4.24-4.24m-2.96-2.96l-4.24-4.24"></path></svg>',
    folder: '<svg class="menu-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>',
    shield: '<svg class="menu-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>',
    calendar: '<svg class="menu-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>',
    user: '<svg class="menu-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>',
    users: '<svg class="menu-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>',
    star: '<svg class="menu-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>',
    zap: '<svg class="menu-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>',
    'bar-chart': '<svg class="menu-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="20" x2="12" y2="10"></line><line x1="18" y1="20" x2="18" y2="4"></line><line x1="6" y1="20" x2="6" y2="16"></line></svg>',
    archive: '<svg class="menu-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="21 8 21 21 3 21 3 8"></polyline><rect x="1" y="3" width="22" height="5"></rect><line x1="10" y1="12" x2="14" y2="12"></line></svg>',
    clipboard: '<svg class="menu-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>',
    list: '<svg class="menu-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>',
    chevron: '<svg class="chevron-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>',
    building: '<svg class="menu-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18M5 21V7l8-4 8 4v14M9 21v-6h6v6"/></svg>',
    link: '<svg class="menu-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
    lock: '<svg class="menu-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
    activity: '<svg class="menu-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>',
    database: '<svg class="menu-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34-9-3V5"/></svg>',
    'check-circle': '<svg class="menu-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>',
    menu: '<svg class="menu-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>',
    video: '<svg class="menu-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>',
    'file-text': '<svg class="menu-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>',
    lightbulb: '<svg class="menu-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18h6"></path><path d="M10 22h4"></path><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"></path></svg>',
    bell: '<svg class="menu-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>',
    summary: '<svg class="menu-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>',
    'log-out': '<svg class="menu-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>'
  };
  return icons[iconName] || '';
}

function normalizeRole(role) {
  if (!role) return null;
  return String(role).trim();
}

function detectRoleFromMetaOrPath() {
  const meta = document.querySelector('meta[name="dashboard-role"]');
  const metaRole = meta?.getAttribute('content');
  return metaRole ? normalizeRole(metaRole) : null;
}

/**
 * Detect the current page ID from the URL path.
 * Returns the filename without extension (kebab-case), which directly
 * matches the `menu_id` values stored in the database (header_menu_items).
 * Falls back to 'dashboard' for index/root paths.
 *
 * Examples:
 *   '/super_admin/sidebar-menu-management.html' → 'sidebar-menu-management'
 *   '/super_admin/rubric-management.html'       → 'rubric-management'
 *   '/super_admin/calendar-accounts.html'       → 'calendar-accounts'
 *   '/super_admin/add-user.html'                → 'add-user'
 *   '/super_admin/index.html'                   → 'dashboard'
 *   '/super_admin/' or '/'                      → 'dashboard'
 *
 * This matches the menu_id values in header_menu_items so sidebar
 * active-highlighting works automatically for any new page added.
 */
function detectCurrentPageId() {
  const path = window.location.pathname || '';
  const parts = path.split('/').filter(Boolean);
  
  // Handle /instructor/profile style paths - extract the page name after the role prefix
  if (parts.length >= 2 && ['instructor', 'admin', 'super_admin', 'reviewer'].includes(parts[0])) {
    const fileName = parts[parts.length - 1] || '';
    if (!fileName || fileName === 'index.html' || fileName.includes('index')) return 'dashboard';
    return fileName.replace(/\.\w+$/, '') || 'dashboard';
  }

  // Path is just a role prefix like /instructor or /instructor/ — that's the dashboard
  if (parts.length === 1 && ['instructor', 'admin', 'super_admin', 'reviewer'].includes(parts[0])) {
    return 'dashboard';
  }
  
  const fileName = parts[parts.length - 1] || '';

  // Root or index → dashboard
  if (!fileName || fileName === 'index.html' || fileName.includes('index')) return 'dashboard';

  // Strip .html extension if present, keep kebab-case
  const baseName = fileName.replace(/\.\w+$/, '');

  return baseName || 'dashboard';
}

/**
 * Match the current window pathname against menu items' href values.
 * Returns the menu_id of the matching top-level or submenu item, or null.
 */
function findActiveMenuIdFromPath(menuItems) {
  const currentPath = window.location.pathname;

  for (const item of menuItems) {
    // Skip disabled items
    if (item.isActive === false) continue;

    // Exact match on top-level href
    if (item.href && currentPath === item.href) {
      return item.id;
    }

    // Check submenu items
    if (item.submenu) {
      for (const sub of item.submenu) {
        if (sub.href && currentPath === sub.href) {
          // Return the parent item's id so the parent gets expanded/highlighted
          return item.id;
        }
      }
    }
  }

  return null;
}

function renderMenuItems(menuItems, currentPageId, activeMenuIdFromPath) {
  const ul = document.createElement('ul');
  ul.className = 'menu-list';

  // Group items by section
  const sections = {};
  const sectionOrder = ['main', 'reviews', 'sessions', 'evaluations', 'analytics', 'account', 'people', 'meetings', 'content', 'evaluation', 'insights', 'reports', 'archives', 'settings', 'organization', 'platform', 'monitoring', 'data'];
  const sectionLabels = {
    main: '',
    reviews: 'Review Queue',
    sessions: 'Sessions',
    evaluations: 'Evaluations',
    analytics: 'Review Analytics',
    people: 'People',
    meetings: 'Meetings',
    content: 'Content',
    evaluation: 'Evaluation',
    insights: 'Insights',
    reports: 'Reports',
    archives: 'Archives',
    settings: 'Settings',
    account: 'Account',
    organization: 'Organization Management',
    platform: 'Platform Configuration',
    monitoring: 'Monitoring & Compliance',
    data: 'Data Management'
  };

  for (const item of menuItems) {
    const section = item.section || 'main';
    if (!sections[section]) {
      sections[section] = [];
    }
    sections[section].push(item);
  }

  // Render sections in order
  for (const sectionKey of sectionOrder) {
    const items = sections[sectionKey];
    if (!items || !items.length) continue;

      // Section header
      if (sectionLabels[sectionKey]) {
        const sectionLi = document.createElement('li');
        sectionLi.className = 'pt-4';
        const sectionP = document.createElement('p');
        sectionP.className = 'sidebar-section-label';
        sectionP.textContent = sectionLabels[sectionKey];
        sectionLi.appendChild(sectionP);
        ul.appendChild(sectionLi);
      }

    // Render items in this section
    for (const item of items) {
      if (item.isActive === false) continue;

      const li = document.createElement('li');
      li.className = 'menu-item';

      // Check if this item or any submenu item is active
      // Priority: 1) path-based match (most accurate), 2) legacy ID-based match
      let isActive = false;
      if (activeMenuIdFromPath) {
        // Path-based match found — ONLY use this, skip fallback to avoid
        // false positives (e.g. /admin/settings/meetings should NOT highlight "Meetings")
        isActive = item.id === activeMenuIdFromPath;
      } else {
        // No path match found — use legacy ID-based matching
        isActive = item.id === currentPageId;
        if (item.submenu && !isActive) {
          isActive = item.submenu.some(sub => {
            const subId = sub.id || sub.href?.split('/').pop()?.replace('.html', '');
            return subId === currentPageId;
          });
        }
      }

      if (isActive) {
        li.classList.add('active');
      }

      // Main item link/button
      const itemContent = document.createElement(item.submenu ? 'button' : 'a');
      // Add logout-link class for logout items to style them in red
      const isLogout = item.id === 'logout';
      itemContent.className = 'menu-link' + (isLogout ? ' logout-link' : '');
      
      if (item.submenu) {
        itemContent.type = 'button';
        itemContent.setAttribute('aria-expanded', isActive ? 'true' : 'false');
      } else {
        itemContent.href = item.href;
      }

      // Icon with dynamic color class from centralized CSS
      const iconSvg = getIconSvg(item.icon);
      if (iconSvg) {
        const iconSpan = document.createElement('span');
        // Apply icon name as color class (e.g. icon="grid" -> class="sidebar-icon-color-grid")
        // This maps to the CSS classes in shared.css for colorful, database-driven icons
        const colorClass = 'sidebar-icon-color-' + (item.icon || 'link');
        iconSpan.className = 'sidebar-icon ' + colorClass;
        iconSpan.innerHTML = iconSvg;
        itemContent.appendChild(iconSpan);
      }

      // Label
      const labelSpan = document.createElement('span');
      labelSpan.className = 'sidebar-label';
      labelSpan.textContent = item.label;
      itemContent.appendChild(labelSpan);

      // Chevron for submenu items
      if (item.submenu) {
        const chevronSpan = document.createElement('span');
        chevronSpan.className = 'menu-chevron';
        chevronSpan.innerHTML = getIconSvg('chevron');
        itemContent.appendChild(chevronSpan);

        // Toggle submenu on click (but allow submenu links to navigate normally)
        itemContent.addEventListener('click', (e) => {
          // If clicking a submenu link, let it navigate normally
          const submenuLink = e.target.closest('.submenu a');
          if (submenuLink) return;
          
          e.preventDefault();
          li.classList.toggle('expanded');
          const isExpanded = li.classList.contains('expanded');
          itemContent.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
        });
      }

      li.appendChild(itemContent);

      // Submenu (if exists)
      if (item.submenu) {
        const submenuDiv = document.createElement('div');
        submenuDiv.className = 'submenu' + (isActive ? '' : '');
      if (isActive) li.classList.add('expanded');
        
        const submenuUl = document.createElement('ul');
        submenuUl.className = 'sidebar-submenu-list';

        for (const subItem of item.submenu) {
          const subLi = document.createElement('li');
          const subLink = document.createElement('a');
          subLink.className = 'sidebar-submenu-link';
          subLink.href = subItem.href;
          subLink.textContent = subItem.label;

          // Highlight active submenu item — use path matching first, then id matching
          const currentPath = window.location.pathname;
          let isSubActive = subItem.href && currentPath === subItem.href;
          if (!isSubActive) {
            const subId = subItem.id || subItem.href?.split('/').pop()?.replace('.html', '');
            isSubActive = subId === currentPageId;
          }
          if (isSubActive) {
            subLi.classList.add('active');
          }

          subLi.appendChild(subLink);
          submenuUl.appendChild(subLi);
        }

        submenuDiv.appendChild(submenuUl);
        li.appendChild(submenuDiv);
      }

      ul.appendChild(li);
    }
  }

  return ul;
}

let sidebarInitialized = false;

/**
 * Normalize API menu items to the format expected by renderMenuItems.
 * API returns: { id, menu_key, label, icon, route_path, children: [...] }
 * Frontend expects: { id, label, icon, href, submenu: [{ id, label, href }] }
 */
function normalizeMenuItems(items) {
  return items.map(function(item) {
    var normalized = {
      id: item.menu_key || item.id,
      label: item.label,
      icon: item.icon || 'link',
      href: item.route_path || null,
      isActive: item.is_active !== 0,
      section: item.section || 'main',
      sort_order: item.sort_order
    };

    // Map children to submenu format
    if (item.children && Array.isArray(item.children) && item.children.length > 0) {
      normalized.submenu = item.children.map(function(child) {
        return {
          id: child.menu_key || child.id,
          label: child.label,
          href: child.route_path || null,
          icon: child.icon || null
        };
      });
    }

    return normalized;
  });
}

async function populateSidebar() {
  if (sidebarInitialized) return;

  const menuList = $('sidebarMenuList');
  if (!menuList) {
    console.warn('Sidebar menu list not found');
    return;
  }

  const currentPageId = detectCurrentPageId();
  const menu = await fetchSidebarMenu(true);

  // Update brand text based on role from meta tag
  const roleMeta = document.querySelector('meta[name="dashboard-role"]');
  if (roleMeta) {
    const brandEl = document.querySelector('.sidebar-brand');
    var roleNames = { super_admin: 'Super Admin', admin: 'Admin', reviewer: 'Reviewer', instructor: 'Instructor', solo_instructor: 'Instructor' };
    if (brandEl) brandEl.textContent = roleNames[roleMeta.getAttribute('content')] || 'Navigation';
  }

  if (!menu || !Array.isArray(menu.menuItems) || !menu.menuItems.length) {
    menuList.innerHTML = '<li class="menu-error">Menu not available</li>';
    return;
  }

  // Normalize API response to frontend format
  var normalizedItems = normalizeMenuItems(menu.menuItems);

  // Try path-based matching first, fall back to legacy ID-based matching
  var activeMenuIdFromPath = findActiveMenuIdFromPath(normalizedItems);
  var menuHtml = renderMenuItems(normalizedItems, currentPageId, activeMenuIdFromPath);

  // Clear existing menu and append new menu items
  menuList.innerHTML = '';
  if (menuHtml && menuHtml.children) {
    Array.from(menuHtml.children).forEach(function(child) {
      menuList.appendChild(child);
    });
  }

  // Setup sidebar toggle functionality
  setupSidebarToggle();
  setupSidebarCollapse();

  sidebarInitialized = true;
}

function toggleSidebar() {
  const sidebar = document.getElementById('sidebarNav');
  
  if (!sidebar) return;
  
  const isCollapsed = sidebar.classList.toggle('collapsed');
  document.body.classList.toggle('sidebar-collapsed');
  
  console.log('Toggled sidebar:', isCollapsed ? 'collapsed' : 'expanded');
}

function setupSidebarToggle() {
  const toggleBtn = document.getElementById('sidebarToggle');
  if (!toggleBtn) return;
  toggleBtn.addEventListener('click', (e) => {
    e.preventDefault();
    toggleSidebar();
  });
}

function setupSidebarCollapse() {
  const collapseBtn = document.getElementById('sidebarCollapseBtn');
  if (!collapseBtn) return;
  collapseBtn.addEventListener('click', (e) => {
    e.preventDefault();
    toggleSidebar();
  });
}

export async function init() {
  await populateSidebar();
}

// Expose a compatibility alias for legacy page scripts.
if (typeof window !== 'undefined') {
  window.initSidebar = init;
}

// Global sidebar toggle handler for ALL pages
document.addEventListener('click', function(e) {
  const toggleBtn = e.target.closest('#sidebarToggle, #sidebarCollapseBtn');
  if (!toggleBtn) return;
  e.preventDefault();
  const sidebar = document.getElementById('sidebarNav');
  if (!sidebar) return;
  const isCollapsed = sidebar.classList.toggle('collapsed');
  document.body.classList.toggle('sidebar-collapsed');
  console.log('Sidebar toggled:', isCollapsed ? 'collapsed' : 'expanded');
});