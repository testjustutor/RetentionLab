/**
 * root/public/js/sidebar-controller.js
*/
/**
 * Sidebar Controller (ES module)
 * Responsibilities:
 *  - fetch dynamic menu from backend DB
 *  - render menu items with submenus
 *  - handle submenu expand/collapse
 *  - manage sidebar collapse/expand state
 *  - highlight active menu item
 *
 * Contract:
 *  - Expects public/sidebar.html to provide stable element ids
 *  - No global variables
 */

function $(id) {
  return document.getElementById(id);
}

async function fetchSidebarMenu() {
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

    return data.menu;
  } catch (err) {
    console.error('Failed to fetch sidebar menu:', err);
    return null;
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
    chevron: '<svg class="chevron-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>'
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
  const fileName = parts[parts.length - 1] || '';

  // Root or index → dashboard
  if (!fileName || fileName === 'index.html' || fileName.includes('index')) return 'dashboard';

  // Strip .html extension (or any extension), keep kebab-case
  const baseName = fileName.replace(/\.\w+$/, '');

  return baseName || 'dashboard';
}

function renderMenuItems(menuItems, currentPageId) {
  const ul = document.createElement('ul');
  ul.className = 'menu-list';

  for (const item of menuItems) {
    if (item.isActive === false) {
      continue;
    }
    const li = document.createElement('li');
    li.className = 'menu-item';

    // Check if this item or any submenu item is active
    let isActive = item.id === currentPageId;
    if (item.submenu && !isActive) {
      isActive = item.submenu.some(sub => {
        const subId = sub.id || sub.href?.split('/').pop()?.replace('.html', '');
        return subId === currentPageId;
      });
    }

    if (isActive) {
      li.classList.add('active');
    }

    // Main item link/button
    const itemContent = document.createElement(item.submenu ? 'button' : 'a');
    itemContent.className = 'menu-link';
    
    if (item.submenu) {
      itemContent.type = 'button';
      itemContent.setAttribute('aria-expanded', isActive ? 'true' : 'false');
    } else {
      itemContent.href = item.href;
    }

    // Icon + Label
    const iconSpan = document.createElement('span');
    iconSpan.className = 'menu-icon-wrapper';
    iconSpan.innerHTML = getIconSvg(item.icon);
    itemContent.appendChild(iconSpan);

    const labelSpan = document.createElement('span');
    labelSpan.className = 'menu-label';
    labelSpan.textContent = item.label;
    itemContent.appendChild(labelSpan);

    // Chevron for submenu items
    if (item.submenu) {
      const chevronSpan = document.createElement('span');
      chevronSpan.className = 'menu-chevron';
      chevronSpan.innerHTML = getIconSvg('chevron');
      itemContent.appendChild(chevronSpan);

      // Toggle submenu on click
      itemContent.addEventListener('click', (e) => {
        e.preventDefault();
        const submenuEl = li.querySelector('.submenu');
        const isExpanded = submenuEl.classList.toggle('expanded');
        itemContent.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
      });
    }

    li.appendChild(itemContent);

    // Submenu (if exists)
    if (item.submenu) {
      const submenuDiv = document.createElement('div');
      submenuDiv.className = 'submenu' + (isActive ? ' expanded' : '');
      
      const submenuUl = document.createElement('ul');
      submenuUl.className = 'submenu-list';

      for (const subItem of item.submenu) {
        const subLi = document.createElement('li');
        subLi.className = 'submenu-item';

        const subLink = document.createElement('a');
        subLink.className = 'submenu-link';
        subLink.href = subItem.href;
        subLink.textContent = subItem.label;

        // Highlight active submenu item
        const subId = subItem.id || subItem.href?.split('/').pop()?.replace('.html', '');
        if (subId === currentPageId) {
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

  return ul;
}

let sidebarInitialized = false;

async function populateSidebar() {
  if (sidebarInitialized) return;

  const menuList = $('sidebarMenuList');
  if (!menuList) {
    console.warn('Sidebar menu list not found');
    return;
  }

  const currentPageId = detectCurrentPageId();
  const menu = await fetchSidebarMenu();

  if (!menu || !Array.isArray(menu.menuItems) || !menu.menuItems.length) {
    menuList.innerHTML = '<li class="menu-error">Menu not available</li>';
    return;
  }

  const menuHtml = renderMenuItems(menu.menuItems, currentPageId);

  // Clear existing menu and append new menu items
  menuList.innerHTML = '';
  if (menuHtml && menuHtml.children) {
    Array.from(menuHtml.children).forEach(child => {
      menuList.appendChild(child);
    });
  }

  // Setup sidebar toggle functionality
  setupSidebarToggle();
  setupSidebarCollapse();

  sidebarInitialized = true;
}

function setupSidebarToggle() {
  const toggleBtn = $('sidebarToggle');
  const sidebar = $('sidebarNav');

  if (!toggleBtn || !sidebar) return;

  toggleBtn.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
  });
}

function setupSidebarCollapse() {
  const collapseBtn = $('sidebarCollapseBtn');
  const sidebar = $('sidebarNav');

  if (!collapseBtn || !sidebar) return;

  collapseBtn.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
  });
}

export async function init() {
  await populateSidebar();
}

// Expose a compatibility alias for legacy page scripts.
if (typeof window !== 'undefined') {
  window.initSidebar = init;
}

// Auto-init on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    populateSidebar();
  });
} else {
  populateSidebar();
}
