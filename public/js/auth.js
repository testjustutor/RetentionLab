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

  login: (email, password) => API.request('/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  logout: () => API.request('/logout', { method: 'POST' }),
  register: (payload) => API.request('/register', { method: 'POST', body: JSON.stringify(payload) }),
  me: () => API.request('/me', { method: 'GET' })
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
    // ignore
  }
  return false;
}

function getRoleRedirect(role) {
  return '/dashboard';
}

function getRoleFromMeta() {
  const meta = document.querySelector('meta[name="dashboard-role"]');
  return meta ? meta.getAttribute('content') : null;
}

// Automatically run auth guard on load
(async () => {
  const path = window.location.pathname;
  const isPublicPage = path.endsWith('/login.html') || path.endsWith('/login') || path.endsWith('/register.html') || path.endsWith('/register');
  
  const authenticated = await checkAuth();

  // Scenario A: User is not logged in
  if (!authenticated) {
    if (!isPublicPage) {
      window.location.replace('/login');
    }
    return;
  }

  // Scenario B: User is logged in, but hit an open gateway like /login.html
  if (isPublicPage) {
    const role = window.currentUser?.role_name;
    window.location.replace(getRoleRedirect(role));
    return;
  }

  // Scenario C: Dynamic Folder Authorization Protection
  const requiredFolderRole = getRoleFromMeta();
  if (requiredFolderRole && window.currentUser?.role_name !== requiredFolderRole) {
    window.location.replace(getRoleRedirect(window.currentUser?.role_name));
    return;
  }

  // If authenticated and on a valid page, initialize dashboard UI if applicable
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
    setText('userName', name);
    setText('userEmail', email);
    setText('userRole', user.role_name);

    // Populate common header profile dropdown
    setText('profileAvatar', initials);
    setText('profileName', name);
    setText('dropdownName', name);
    setText('profileEmail', email);
    setText('dropdownEmail', email);

    // Setup logout button listener globally if it exists
    const logout = document.getElementById('logoutButton');
    if (logout) {
        logout.addEventListener('click', async () => {
            await API.logout();
            window.location.replace('/login');
        });
    }
}
