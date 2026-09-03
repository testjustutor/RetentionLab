/**
 * root/public/js/auth/reset-password.js
 */
import AuthAPI from '../auth.js';

const form = document.getElementById('resetPasswordForm');
const errorEl = document.getElementById('resetError');
const token = new URLSearchParams(window.location.search).get('token');

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  errorEl.textContent = '';

  const password = document.getElementById('resetPassword').value.trim();
  const confirm = document.getElementById('resetPasswordConfirm').value.trim();

  if (!password || !confirm) {
    errorEl.textContent = 'Please provide and confirm your password.';
    return;
  }
  if (password !== confirm) {
    errorEl.textContent = 'Passwords do not match.';
    return;
  }
  if (password.length < 10) {
    errorEl.textContent = 'Password should be at least 10 characters.';
    return;
  }

  if (!token) {
    errorEl.textContent = 'Reset token missing. Use the link we emailed you.';
    return;
  }

  try {
    const result = await AuthAPI.resetPassword(token, password);
    if (result && result.user) {
      window.location.href = '/login?reset=success';
      return;
    }
    errorEl.textContent = (result && result.error) ? result.error : 'Unable to reset password.';
  } catch (err) {
    errorEl.textContent = err.message || 'Unable to reset password.';
  }
});