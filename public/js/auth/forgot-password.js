/**
 * public/js/auth/forgot-password.js
 */

import AuthAPI from '../auth.js';

const form = document.getElementById('forgotPasswordForm');
const errorEl = document.getElementById('forgotError');

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  errorEl.textContent = '';

  const email = document.getElementById('forgotEmail').value.trim();
  if (!email) {
    errorEl.textContent = 'Please enter your email address.';
    return;
  }

  try {
    const result = await AuthAPI.forgotPassword(email);
    if (result && result.status === 'success') {
      errorEl.className = 'text-sm text-emerald-400';
      errorEl.textContent = 'If that email exists, a reset link has been sent.';
      return;
    }
    errorEl.textContent = (result && result.error) ? result.error : 'Unable to send reset link.';
  } catch (err) {
    errorEl.textContent = err.message || 'Unable to send reset link.';
  }
});