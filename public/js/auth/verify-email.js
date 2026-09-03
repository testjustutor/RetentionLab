/**
 * public/js/auth/verify-email.js
 */

import AuthAPI from '../auth.js';

const statusEl = document.getElementById('verifyMessage');
const token = new URLSearchParams(window.location.search).get('token');

async function showMessage(text, isError = false) {
  statusEl.textContent = text;
  statusEl.className = `text-sm ${isError ? 'text-red-400' : 'text-emerald-400'}`;
}

(async () => {
  if (!token) {
    await showMessage('Verification token missing. Please use the link sent to your email.', true);
    return;
  }

  try {
    const result = await AuthAPI.verifyEmail(token);
    if (result && result.status === 'success') {
      await showMessage('Email successfully verified. Redirecting to login...');
      setTimeout(() => {
        window.location.href = '/login?verified=success';
      }, 2000);
      return;
    }
    await showMessage(result.error || 'Verification failed.', true);
  } catch (err) {
    await showMessage(err.message || 'Verification failed.', true);
  }
})();