/**
 * root/public/js/login.js
*/
import AuthAPI from './auth.js';

const form = document.getElementById('loginForm');
const errorEl = document.getElementById('loginError');
const returnUrl = new URLSearchParams(window.location.search).get('returnUrl');

function routeByRole(role) {
  if (returnUrl) return returnUrl;
  switch ((role || '').toLowerCase()) {
    case 'super_admin': return '/super_admin/';
    case 'admin': return '/admin/';
    case 'reviewer': return '/reviewer/dashboard';
    case 'solo_instructor': return '/dashboard';
    default: return '/dashboard';
  }
}

(async () => {
  try {
    const existing = await AuthAPI.me();
    if (existing && existing.user) {
      window.location.href = routeByRole(existing.user.role_name);
    }
  } catch (err) {
    // not logged in
  }

  const params = new URLSearchParams(window.location.search);
  if (params.get('reset') === 'success') {
    errorEl.className = 'text-sm text-emerald-400';
    errorEl.textContent = 'Password reset successful. Please sign in.';
  }
  if (params.get('verified') === 'success') {
    errorEl.className = 'text-sm text-emerald-400';
    errorEl.textContent = 'Email verified. You can now log in.';
  }
})();

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  errorEl.textContent = '';

  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value.trim();

  if (!email || !password) {
    errorEl.textContent = 'Please enter email and password.';
    return;
  }

  try {
    const result = await AuthAPI.login(email, password);
    if (result && result.user) {
      window.location.href = routeByRole(result.user.role_name);
      return;
    }
    errorEl.textContent = (result && result.error) ? result.error : 'Login failed';
  } catch (err) {
    errorEl.textContent = err.message || 'Login failed';
  }
});