/**
 * public/js/student/dashboard.js
 */

function setField(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value || '—';
}

async function loadDashboard() {
  try {
    const res = await fetch('/api/auth/me', { credentials: 'include' });
    const data = await res.json();
    if (data && data.success && data.user) {
      const user = data.user;
      const name = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email || '—';
      setField('userName', name);
      setField('userEmail', user.email);
      setField('userRole', user.role_name || user.role || '—');
    }
  } catch (err) {
    console.error('Dashboard load error:', err);
  }
}

document.addEventListener('DOMContentLoaded', loadDashboard);
