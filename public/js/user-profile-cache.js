/**
 * root/public/js/user-profile-cache.js
 * 
 * Unified session cache management.
 * Provides get/set/clear for the user profile stored in sessionStorage.
 */

const CACHE_KEY = 'cached_user';

// Also clear the old key used by auth.js to prevent stale caches from causing loops
const OLD_AUTH_KEY = 'rl_user_profile';

export function setCachedUser(user) {
  if (!user) return;
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(user));
  } catch (err) {
    console.warn('Failed to cache user profile:', err);
  }
}

export function getCachedUser() {
  try {
    const data = sessionStorage.getItem(CACHE_KEY);
    return data ? JSON.parse(data) : null;
  } catch (err) {
    console.warn('Failed to read cached user profile:', err);
    return null;
  }
}

export function clearCachedUser() {
  try {
    sessionStorage.removeItem(CACHE_KEY);
    sessionStorage.removeItem(OLD_AUTH_KEY);
  } catch (err) {
    console.warn('Failed to clear cached user profile:', err);
  }
}