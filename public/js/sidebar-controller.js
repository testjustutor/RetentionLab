/**
 * root/public/js/sidebar-controller.js
*/
/**
 * Sidebar Controller (ES module)
 * Responsibilities:
 *  - detect current role
 *  - load sidebar-config.js
 *  - render menu items with submenus
 *  - handle submenu expand/collapse
 *  - manage sidebar collapse/expand state
 *  - highlight active menu item
 *
 * Contract:
 *  - Expects public/sidebar.html to provide stable element ids
 *  - No global variables
 */

import sidebarConfig from './sidebar-config.js';

function $(id) {
  return document.getElementById(id);
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
  // 1) meta tag (preferred)
  const meta = document.querySelector('meta[name="dashboard-role"]');
  const metaRole = meta?.getAttribute('content');
  if (metaRole) return normalizeRole(metaRole);

  // 2) path segment
  const parts = (window.location.pathname || '').split('/').filter(Boolean);
  const maybeRole = parts[0];
  if (maybeRole && sidebarConfig?.roles?.[maybeRole]) return maybeRole;

  return null;
}

function detectCurrentPageId() {
  const path = window.location.pathname || '';
  const parts = path.split('/').filter(Boolean);
  const fileName = parts[parts.length - 1] || '';

  // Root or role-root (e.g. "/", "/admin", "/admin/") → dashboard
  if (!fileName || fileName.includes('index')) return 'dashboard';

  if (fileName.includes('profile')) return 'profile';
  if (fileName.includes('settings')) return 'settings';
  if (fileName.includes('archives')) return 'archives';
  if (fileName.includes('calendar-accounts')) return 'calendar-accounts';
  if (fileName.includes('calendar-events')) return 'calendar-events';
  if (fileName.includes('data-architecture')) return 'data-architecture';
  if (fileName.includes('assets')) return 'assets';
  if (fileName.includes('audit')) return 'audit';
  if (fileName.includes('bot')) return 'bot-management';

  return null;
}

function renderMenuItems(menuItems, currentPageId) {
  const ul = document.createElement('ul');
  ul.className = 'menu-list';

  for (const item of menuItems) {
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
  if (!menuList) return;

  const role = detectRoleFromMetaOrPath();
  const currentPageId = detectCurrentPageId();

  if (!role || !sidebarConfig.roles?.[role]) {
    menuList.innerHTML = '<li class="menu-error">Menu not available</li>';
    return;
  }

  const roleConfig = sidebarConfig.roles[role];
  const menuHtml = renderMenuItems(roleConfig.menuItems, currentPageId);

  menuList.parentNode.replaceChild(menuHtml, menuList);

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

// Auto-init on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    populateSidebar();
  });
} else {
  populateSidebar();
}
