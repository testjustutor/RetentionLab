/**
 * root/public/js/auth.js
 */

// Lightweight auth helpers for frontend
const API = {
  base: '/api/auth',
  async request(path, options = {}) {
    const res = await fetch(API.base + path, Object.assign({
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include'
    }, options));
    const text = await res.text();
    try { return JSON.parse(text); } catch (e) { return text; }
  },

  login:            (email, password) => API.request('/login',            { method: 'POST', body: JSON.stringify({ email, password }) }),
  logout:           ()                => API.request('/logout',           { method: 'POST' }),
  register:         (payload)         => API.request('/register',         { method: 'POST', body: JSON.stringify(payload) }),
  forgotPassword:   (email)           => API.request('/forgot-password',   { method: 'POST', body: JSON.stringify({ email }) }),
  resetPassword:    (token, password) => API.request('/reset-password',    { method: 'POST', body: JSON.stringify({ token, password }) }),
  verifyEmail:      (token)           => API.request('/verify-email',      { method: 'POST', body: JSON.stringify({ token }) }),
  me:               ()                => API.request('/me',               { method: 'GET' })
};

export default API;

// --- AUTH GUARD LOGIC ---

async function checkAuth() {
  try {
    const response = await API.me();
    if (response && response.user) {
      window.currentUser = response.user;
      return true;
    }
  } catch (err) {
    // not logged in or network error
  }
  return false;
}

/**
 * Returns the correct landing URL for a given role.
 * Used after login and when redirecting away from public pages.
 */
function getRoleRedirect(role) {
  switch (role) {
    case 'super_admin': return '/super_admin';
    case 'admin':       return '/admin';
    case 'reviewer':    return '/reviewer';
    case 'instructor':    return '/instructor';
    default:            return '/dashboard';
  }
}

function getRoleFromMeta() {
  const meta = document.querySelector('meta[name="dashboard-role"]');
  return meta ? meta.getAttribute('content') : null;
}

/**
 * Pages whose auth is already enforced server-side by pageAuth middleware
 * in pages.js. The client should NOT redirect away from these on a failed
 * checkAuth — the server will redirect to /login itself if needed.
 * This prevents the double-redirect loop that caused every URL to land on /login.
 */
const SERVER_PROTECTED_PREFIXES = [
  '/dashboard',
  '/admin',
  '/super_admin',
  '/reviewer',
  '/instructor',
  // root-level safeRootPages from pages.js
  '/schedule-intelligence',
  '/meeting-overview',
  '/archives',
  '/assets',
  '/audit',
  '/bot',
  '/calendar-accounts',
  '/calendar-events',
  '/calendar-integrations',
  '/data-architecture'
];

const PUBLIC_PAGE_SUFFIXES = [
  '/login',
  '/login.html',
  '/register',
  '/register.html'
];

// Automatically run auth guard on load
(async () => {
  const currentPath = window.location.pathname;

  const isPublicPage = PUBLIC_PAGE_SUFFIXES.some(p => currentPath.endsWith(p));

  // Pages already protected server-side — don't interfere with their auth flow
  const isServerProtected = SERVER_PROTECTED_PREFIXES.some(p => currentPath.startsWith(p));

  const authenticated = await checkAuth();

  // Scenario A: User is NOT logged in
  if (!authenticated) {
    // Server-protected pages: let the server handle the redirect to /login.
    // Public pages (login/register): stay put, nothing to do.
    // Any other client-side-only page: redirect to login.
    if (!isPublicPage && !isServerProtected) {
      window.location.replace('/login');
    }
    return;
  }

  // Scenario B: User IS logged in but landed on a public page (login / register)
  if (isPublicPage) {
    const role = window.currentUser?.role_name;
    window.location.replace(getRoleRedirect(role));
    return;
  }

  // Scenario C: Role-based folder protection via <meta name="dashboard-role">
  // e.g. super_admin pages have <meta name="dashboard-role" content="super_admin">
  const requiredFolderRole = getRoleFromMeta();
  if (requiredFolderRole && window.currentUser?.role_name !== requiredFolderRole) {
    // Wrong role for this folder — send them to their own dashboard
    window.location.replace(getRoleRedirect(window.currentUser?.role_name));
    return;
  }

  // Scenario D: Authenticated and on the right page — boot the UI
  initDashboard(window.currentUser);
})();


// --- DASHBOARD UI LOGIC ---

function initDashboard(user) {
  const titleEl = document.getElementById('pageTitle');
  if (titleEl && !titleEl.textContent) titleEl.textContent = document.title;

  const name = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email;
  const email = user.email;
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  const setText = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };

  // Populate dashboard-specific user info
  setText('userName',   name);
  setText('userEmail',  email);
  setText('userRole',   user.role_name);

  // Populate common header profile dropdown
  setText('profileAvatar', initials);
  setText('profileName',   name);
  setText('dropdownName',  name);
  setText('profileEmail',  email);
  setText('dropdownEmail', email);

  // Setup logout button
  const logout = document.getElementById('logoutButton');
  if (logout) {
    logout.addEventListener('click', async () => {
      await API.logout();
      window.location.replace('/login');
    });
  }
}