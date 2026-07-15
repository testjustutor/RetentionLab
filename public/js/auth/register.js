/**
 * root/public/js/auth/register.js
 */
import AuthAPI from '../auth.js';

const form = document.getElementById('registerForm');
const errorEl = document.getElementById('registerError');
const returnUrl = new URLSearchParams(window.location.search).get('returnUrl') || '/instructor/index.html';

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  errorEl.textContent = '';

  const email = document.getElementById('registerEmail').value.trim();
  const password = document.getElementById('registerPassword').value.trim();
  const fullName = document.getElementById('registerName').value.trim();

  const nameParts = fullName.split(' ').filter(Boolean);
  const firstName = nameParts.shift() || '';
  const lastName = nameParts.join(' ') || '';

  if (!email || !password || !firstName) {
    errorEl.textContent = 'Please enter your name, email, and password.';
    return;
  }
  if (password.length < 10) {
    errorEl.textContent = 'Password must be at least 10 characters.';
    return;
  }

  try {
    const result = await AuthAPI.register({
      email,
      password,
      first_name: firstName,
      last_name: lastName,
      role_name: 'solo_instructor'
    });
    if (result && (result.status === 'pending_verification' || result.user)) {
      errorEl.className = 'text-sm text-emerald-400 min-h-[1.25rem]';
      errorEl.textContent = result.message || 'Registration successful. Check your email to verify your account.';
      form.reset();
      return;
    }
    errorEl.className = 'text-sm text-red-400 min-h-[1.25rem]';
    errorEl.textContent = (result && result.error) ? result.error : 'Registration failed';
  } catch (err) {
    errorEl.className = 'text-sm text-red-400 min-h-[1.25rem]';
    errorEl.textContent = err.message || 'Registration failed';
  }
});