/**
 * public/js/admin/settings/notifications.js
 */

const ROLES = [
  { key: 'admin', label: 'Admin' },
  { key: 'instructor', label: 'Instructor' },
  { key: 'reviewer', label: 'Reviewer' }
];
const CHANNELS = [
  { key: 'email', label: 'Email' },
  { key: 'push', label: 'Push' },
  { key: 'sms', label: 'SMS' }
];

(async () => {
  await loadNotifications();
  bindSave();
})();

async function loadNotifications() {
  try {
    const data = await apiFetch('/api/admin/settings/notifications');
    const counts = data.roleCounts || {};
    setText('rolAdmins', counts.admin);
    setText('rolInstructors', counts.instructor);
    setText('rolReviewers', counts.reviewer);
    renderNotifBody(data.settings || {});
  } catch (e) {
    console.error('loadNotifications:', e);
    showToast('Failed to load notification settings: ' + e.message, true);
  }
}

function renderNotifBody(settings) {
  const tbody = document.getElementById('notifBody');
  if (!tbody) return;
  let html = '';
  ROLES.forEach((role) => {
    html += `<tr class='border-b border-blue-200 hover:bg-blue-50/70 transition-colors'>`;
    html += `<td class='py-2 px-2 font-semibold text-blue-950'>${role.label}</td>`;
    CHANNELS.forEach((ch) => {
      const id = 'notif-' + ch.key + '-' + role.key;
      const on = (settings[ch.key] && settings[ch.key][role.key]) ? 1 : 0;
      const trackCls = on ? 'bg-emerald-600' : 'bg-slate-400';
      const thumbTransform = on ? 'translateX(16px)' : 'translateX(0)';
      html += `<td class='py-2 px-2'>
        <label class='relative inline-flex items-center cursor-pointer' aria-label='${ch.label} notifications for ${role.label}'>
          <input type='checkbox' id='${id}' class='sr-only js-notif-toggle'${on ? ' checked' : ''}>
          <span class='js-toggle-track w-9 h-5 rounded-full relative transition-colors duration-200 ${trackCls}'>
            <span class='js-toggle-thumb absolute top-0.5 left-0.5 h-4 w-4 bg-white rounded-full shadow transition-transform duration-200' style='transform:${thumbTransform}'></span>
          </span>
        </label>
      </td>`;
    });
    html += '</tr>';
  });
  tbody.innerHTML = html;

  // Drive toggle visuals explicitly (independent of Tailwind peer-checked)
  // ON = emerald track + thumb slides right; OFF = slate-400 + thumb left.
  tbody.querySelectorAll('.js-notif-toggle').forEach((cb) => {
    cb.addEventListener('change', () => {
      const track = cb.nextElementSibling;
      if (!track) return;
      const thumb = track.querySelector('.js-toggle-thumb');
      if (cb.checked) {
        track.classList.remove('bg-slate-400');
        track.classList.add('bg-emerald-600');
        if (thumb) thumb.style.transform = 'translateX(16px)';
      } else {
        track.classList.add('bg-slate-400');
        track.classList.remove('bg-emerald-600');
        if (thumb) thumb.style.transform = 'translateX(0)';
      }
    });
  });
}

function bindSave() {
  const btn = document.getElementById('saveNotifBtn');
  if (!btn) return;
  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    await saveNotifications();
  });
}

function collectSettings() {
  const s = {};
  CHANNELS.forEach((ch) => {
    s[ch.key] = {};
    ROLES.forEach((role) => {
      const el = document.getElementById('notif-' + ch.key + '-' + role.key);
      s[ch.key][role.key] = el && el.checked ? 1 : 0;
    });
  });
  return s;
}

async function saveNotifications() {
  const msg = document.getElementById('saveMsg');
  try {
    const result = await apiFetch('/api/admin/settings/notifications', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: collectSettings() })
    });
    showToast('Notification settings saved successfully');
    if (msg) msg.textContent = 'Saved';
  } catch (e) {
    console.error('saveNotifications:', e);
    showToast('Failed to save: ' + e.message, true);
    if (msg) msg.textContent = 'Save failed';
  }
}

function setText(id, v) { const el = document.getElementById(id); if (el) el.textContent = (v == null ? '-' : v); }

