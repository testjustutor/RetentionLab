/**
 * root/public/js/login.js
*/
import AuthAPI from './auth.js';

const form = document.getElementById('loginForm');
const errorEl = document.getElementById('loginError');
const returnUrl = new URLSearchParams(window.location.search).get('returnUrl');

function routeByRole(role) {
  return returnUrl || '/dashboard';
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
