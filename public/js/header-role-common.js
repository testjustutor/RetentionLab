/**
 * root/public/js/header-role-common.js
*/
/**
 * header-role-common.js
 *
 * Refactored to ONLY handle:
 *  - profile menu toggle + dropdown behavior
 *  - profile rendering (avatar/name/email) from user-profile-api.js
 *  - logout behavior
 *
 * Navigation/page/role logic is intentionally removed.
 *
 * Compatibility:
 *  - header-controller.js may import this module OR call the legacy init function.
 *  - Keeps a legacy global entrypoint: window.initProfileRoleHeaderCommon(opts)
 *    (works if header-controller.js injects/executes as classic script).
 */

let initialized = false;

const $ = (id) => document.getElementById(id);

function safeInitialsFromName(name) {
  const n = (name || '').trim();
  if (!n) return '';
  return n
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function setText(id, text) {
  const el = $(id);
  if (el) el.textContent = text ?? '';
}

function initProfileFromStorage() {
  try {
    const raw = localStorage.getItem('rl_user') || sessionStorage.getItem('rl_user');
    const user = raw ? JSON.parse(raw) : null;
    if (!user) return null;

    const name = user.name || user.email?.split('@')[0] || 'User';
    const email = user.email || '';
    setText('profileAvatar', safeInitialsFromName(name));
    setText('profileName', name);
    setText('dropdownName', name);
    setText('profileEmail', email);
    setText('dropdownEmail', email);
    setText('userRole', user.role_name || '');

    return { user };
  } catch {
    return null;
  }
}

async function fetchAndRenderProfile() {
  try {
    const mod = await import('./user-profile-api.js');
    const user = await mod.fetchCurrentUser();

    const displayName = (user.first_name || user.last_name)
      ? `${(user.first_name || '').trim()} ${(user.last_name || '').trim()}`.trim()
      : (user.name || user.email || 'User');

    const email = user.email || '';
    const initials = safeInitialsFromName(displayName);
    
    setText('userRole', user.role_name || '');
    setText('profileAvatar', initials);
    setText('profileName', displayName);
    setText('dropdownName', displayName);
    setText('profileEmail', email);
    setText('dropdownEmail', email);

    // Optional session widgets (defensive)
    setText('userName', displayName);
    setText('userEmail', email);

    // Cache for other legacy scripts
    try {
      localStorage.setItem('rl_user', JSON.stringify(user));
    } catch {
      // ignore
    }

    return { user };
  } catch {
    return initProfileFromStorage();
  }
}

function initDropdownBehavior() {
  const wrap = $('profileMenuWrap');
  const btn = $('profileBtn');
  const menu = $('profileMenu');
  if (!wrap || !btn || !menu) return false;

  const chevron = $('profileChevron');

  const setOpen = (open) => {
    menu.classList.toggle('hidden', !open);
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (chevron) chevron.style.transform = open ? 'rotate(180deg)' : '';
  };

  // Toggle on click
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    const isOpen = !menu.classList.contains('hidden');
    setOpen(!isOpen);
  });

  // Outside click
  document.addEventListener('click', (e) => {
    if (!wrap.contains(e.target)) setOpen(false);
  });

  // Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') setOpen(false);
  });

  return true;
}

function initLogout() {
  const logoutBtn = $('navLogoutBtn') || $('logoutButton');
  if (!logoutBtn) return false;

  const doLogout = async (e) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();

    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch {
      // ignore
    }

    try {
      localStorage.removeItem('rl_user');
      localStorage.removeItem('rl_token');
      sessionStorage.clear();
    } catch {
      // ignore
    }

    window.location.href = '/login.html';
  };

  logoutBtn.addEventListener('click', doLogout);
  window.handleLogout = doLogout;

  return true;
}

function initLegacyGlobals() {
  window.toggleProfileMenu = () => {
    const wrap = $('profileMenuWrap');
    const menu = $('profileMenu');
    const chevron = $('profileChevron');
    if (!wrap || !menu) return;

    const isOpen = !menu.classList.contains('hidden');
    menu.classList.toggle('hidden', isOpen);
    if (chevron) chevron.style.transform = isOpen ? '' : 'rotate(180deg)';
  };

  if (!window.handleLogout) {
    window.handleLogout = async (e) => {
      if (e && typeof e.preventDefault === 'function') e.preventDefault();
      try {
        await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
      } catch {
        // ignore
      }
      try {
        localStorage.removeItem('rl_user');
        localStorage.removeItem('rl_token');
        sessionStorage.clear();
      } catch {
        // ignore
      }
      window.location.href = '/login.html';
    };
  }
}

async function initProfileRoleHeaderCommon(_opts = {}) {
  if (initialized) return;

  const hasMarkup = $('profileMenuWrap') && $('profileBtn') && $('profileMenu');
  if (!hasMarkup) return;

  // REMOVED: initDropdownBehavior(); — handled by header-controller.js
  // REMOVED: initLogout();           — handled by header-controller.js

  await fetchAndRenderProfile();

  initialized = true;
}

// Legacy compatibility (classic script style callers)
(function attachLegacy(global) {
  try {
    global.initProfileRoleHeaderCommon = initProfileRoleHeaderCommon;
  } catch {
    // ignore
  }

  // Backward compat name used by older code (if present)
  try {
    global.initRoleHeaderCommon = initProfileRoleHeaderCommon;
  } catch {
    // ignore
  }
})(typeof window !== 'undefined' ? window : {});

export { initProfileRoleHeaderCommon, initDropdownBehavior, initLogout };

