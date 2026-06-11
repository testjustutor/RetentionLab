/**
 * root/public/js/user-profile-api.js
*/
const API_BASE = '/api';
const CACHE_KEY = 'rl_user';
const INFLIGHT_KEY = '__rl_user_inflight__';

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function getCachedUser() {
  try {
    const raw = localStorage.getItem(CACHE_KEY) || sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function setCachedUser(user) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(user));
  } catch {
    // ignore
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

      return data?.user || data;
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
    const url = `${API_BASE}/auth/me`;
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

