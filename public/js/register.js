/**
 * root/public/js/register.js
*/
import AuthAPI from './auth.js';

const form = document.getElementById('registerForm');
const errorEl = document.getElementById('registerError');
const returnUrl = new URLSearchParams(window.location.search).get('returnUrl') || '/employee/index.html';

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  errorEl.textContent = '';

  const email = document.getElementById('registerEmail').value.trim();
  const password = document.getElementById('registerPassword').value.trim();
  const name = document.getElementById('registerName').value.trim();

  if (!email || !password) {
    errorEl.textContent = 'Please enter both email and password.';
    return;
  }

  try {
    const result = await AuthAPI.register({ email, password, first_name: name, role_name: 'employee' });
    if (result && result.user) {
      window.location.href = returnUrl;
      return;
    }
    errorEl.textContent = (result && result.error) ? result.error : 'Registration failed';
  } catch (err) {
    errorEl.textContent = err.message || 'Registration failed';
  }
});
