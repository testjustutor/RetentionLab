/**
 * public/js/reviewer/profile.js
 */

const stateEl = {
  loading: document.getElementById('profileLoading'),
  empty: document.getElementById('profileEmpty'),
  content: document.getElementById('profileContent')
};

const fieldIds = {
  name: 'profileName',
  email: 'profileEmail',
  role: 'profileRole',
  status: 'profileStatus',
  userId: 'profileUserId',
  phone: 'profilePhone',
  createdAt: 'profileCreatedAt',
  lastLogin: 'profileLastLogin',
  emailVerified: 'profileEmailVerified',
  emailVerifiedAt: 'profileEmailVerifiedAt'
};

const fmtDate = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

const fmtDateTime = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

function setField(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value || '—';
}

function showLoading() {
  if (stateEl.loading) stateEl.loading.classList.remove('hidden');
  if (stateEl.empty) stateEl.empty.classList.add('hidden');
  if (stateEl.content) stateEl.content.classList.add('hidden');
}

function showEmpty() {
  if (stateEl.loading) stateEl.loading.classList.add('hidden');
  if (stateEl.empty) stateEl.empty.classList.remove('hidden');
  if (stateEl.content) stateEl.content.classList.add('hidden');
}

function showContent(user) {
  if (stateEl.loading) stateEl.loading.classList.add('hidden');
  if (stateEl.empty) stateEl.empty.classList.add('hidden');
  if (stateEl.content) stateEl.content.classList.remove('hidden');

  const name = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email || '—';
  setField(fieldIds.name, name);
  setField(fieldIds.email, user.email);
  setField(fieldIds.role, user.role_name || user.role || '—');
  setField(fieldIds.status, user.status || 'active');
  setField(fieldIds.userId, user.id != null ? `#${user.id}` : '—');
  setField(fieldIds.phone, user.phone || null);
  setField(fieldIds.createdAt, fmtDate(user.created_at));
  setField(fieldIds.lastLogin, fmtDateTime(user.last_login_at));
  setField(fieldIds.emailVerified, user.email_verified ? 'Yes' : 'No');
  setField(fieldIds.emailVerifiedAt, fmtDateTime(user.email_verified_at));

  // The shared /api/auth/me response only returns identity fields; hide the
  // rows/cards for fields the API does not provide so the page stays clean.
  const rowLastLogin = document.getElementById('rowLastLogin');
  if (rowLastLogin && user.last_login_at == null) rowLastLogin.classList.add('hidden');

  const emailCard = document.getElementById('profileEmailCard');
  if (emailCard && user.email_verified == null) emailCard.classList.add('hidden');
}

async function loadProfile() {
  showLoading();
  try {
    const res = await fetch('/api/auth/me', { credentials: 'include' });
    const data = await res.json();
    if (data && data.success && data.user) {
      showContent(data.user);
    } else {
      showEmpty();
    }
  } catch (err) {
    console.error('Profile load error:', err);
    showEmpty();
  }
}

document.addEventListener('DOMContentLoaded', loadProfile);