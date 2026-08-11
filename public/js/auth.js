/**
 * root/public/js/auth.js
 * 
 * Merged auth utilities:
 *  - Auth API wrapper
 *  - User profile cache (sessionStorage)
 *  - Auth guard functions
 *  - User profile API with retry logic
 */

// ========== USER PROFILE CACHE ==========

const USER_CACHE_KEY = 'rl_user_profile';

export function getCachedUser() {
  try {
    const raw = sessionStorage.getItem(USER_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setCachedUser(user) {
  try {
    const profile = {
      id: user.id,
      name: user.name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email,
      email: user.email,
      role: user.role_name || user.role,
      company_id: user.company_id,
      profile_image: user.profile_image || null,
      first_name: user.first_name,
      last_name: user.last_name
    };
    sessionStorage.setItem(USER_CACHE_KEY, JSON.stringify(profile));
  } catch (e) {
    console.error('Failed to cache user profile:', e);
  }
}

export function clearCachedUser() {
  try {
    sessionStorage.removeItem(USER_CACHE_KEY);
    // Also clear the user-profile-cache key to prevent stale data
    sessionStorage.removeItem('cached_user');
  } catch {
    // ignore
  }
}

export function isAuthenticated() {
  return getCachedUser() !== null;
}

export function getDisplayName() {
  const user = getCachedUser();
  return user?.name || user?.email || 'User';
}

export function getUserInitials() {
  const user = getCachedUser();
  const name = user?.name || '';
  return name
    .split(' ')
    .filter(Boolean)
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'U';
}

// ========== AUTH GUARD ==========

export function requireAuth(returnUrl = null) {
  if (!isAuthenticated()) {
    const loginUrl = returnUrl 
      ? `/login?returnUrl=${encodeURIComponent(returnUrl)}`
      : '/login';
    window.location.href = loginUrl;
    return false;
  }
  return true;
}

export function getCurrentUser() {
  return getCachedUser();
}

export function hasRole(roles) {
  const user = getCachedUser();
  if (!user) return false;
  
  const userRole = (user.role || '').toLowerCase();
  const allowedRoles = Array.isArray(roles) 
    ? roles.map(r => r.toLowerCase())
    : [roles.toLowerCase()];
  
  return allowedRoles.includes(userRole);
}

export function requireRole(roles, fallbackUrl = '/') {
  if (!hasRole(roles)) {
    window.location.href = fallbackUrl;
    return false;
  }
  return true;
}

// ========== AUTH API ==========

const API_BASE = '/api/auth';
const INFLIGHT_KEY = '__rl_user_inflight__';

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function requestJsonWithRetry(url, options, { retries = 2, backoffMs = 150 } = {}) {
  let lastErr;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, options);
      const text = await res.text();
      const data = safeJson(text);

      if (!res.ok) {
        const err = data?.error || data?.message || `HTTP ${res.status}`;
        throw new Error(err);
      }

      // Return user object if present, null if explicitly null, or fallback to data
      return data?.user !== undefined && data?.user !== null ? data.user : null;
    } catch (err) {
      lastErr = err;
      if (attempt === retries) break;
      const delay = backoffMs * (attempt + 1);
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  throw lastErr;
}

export async function fetchCurrentUser() {
  // 1) Cache fast-path
  const cached = getCachedUser();
  if (cached) return cached;

  // 2) In-flight de-dupe (module-level)
  if (globalThis[INFLIGHT_KEY]) return globalThis[INFLIGHT_KEY];

  const promise = (async () => {
    const url = `${API_BASE}/me`;
    const options = {
      method: 'GET',
      credentials: 'include'
    };

    const user = await requestJsonWithRetry(url, options, { retries: 2, backoffMs: 200 });

    if (user) setCachedUser(user);
    return user;
  })();

  globalThis[INFLIGHT_KEY] = promise;

  try {
    return await promise;
  } finally {
    // clear inflight no matter what
    delete globalThis[INFLIGHT_KEY];
  }
}

export function userToDisplayName(user) {
  const first = (user?.first_name || '').trim();
  const last = (user?.last_name || '').trim();
  const full = `${first} ${last}`.trim();
  return full || user?.email || 'User';
}

export function userToInitials(user) {
  const name = userToDisplayName(user);
  return name
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

// ========== AUTH API WRAPPER ==========

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
  logout:           ()                => API.request('/logout',           { method: 'POST', credentials: 'include' }),
  register:         (payload)         => API.request('/register',         { method: 'POST', body: JSON.stringify(payload) }),
  forgotPassword:   (email)           => API.request('/forgot-password',   { method: 'POST', body: JSON.stringify({ email }) }),
  resetPassword:    (token, password) => API.request('/reset-password',    { method: 'POST', body: JSON.stringify({ token, password }) }),
  verifyEmail:      (token)           => API.request('/verify-email',      { method: 'POST', body: JSON.stringify({ token }) }),
  me:               ()                => API.request('/me',               { method: 'GET' })
};

export default API;

// ========== AUTH CHECK ==========

export async function checkAuth() {
  // Try to get user from cache first (no API call)
  const cachedUser = getCachedUser();
  if (cachedUser) {
    window.currentUser = cachedUser;
    return true;
  }
  
  // If not in cache, fetch from API (only when explicitly called)
  try {
    const response = await API.me();
    if (response && response.user) {
      window.currentUser = response.user;
      // Cache the user for future use
      setCachedUser(response.user);
      return true;
    }
  } catch (err) {
    // not logged in or network error
  }
  return false;
}

// ========== DASHBOARD UI LOGIC ==========

export function initDashboard(user) {
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
      clearCachedUser();
      window.location.replace('/login');
    });
  }
}