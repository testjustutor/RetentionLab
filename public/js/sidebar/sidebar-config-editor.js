/**
 * public/js/sidebar/sidebar-config-editor.js
 */

async function api(path, opts = {}) {
  const res = await fetch(path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    ...opts
  });

  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = null; }
  if (!res.ok || !data?.success) {
    throw new Error(data?.error || `Request failed: ${res.status}`);
  }
  return data;
}

function $(id) {
  return document.getElementById(id);
}

function setStatus(message, isError = false) {
  const status = $('sidebarConfigStatus');
  if (!status) return;
  status.textContent = message;
  status.className = isError ? 'text-xs text-red-400 self-center' : 'text-xs text-emerald-400 self-center';
}

async function fetchSidebarConfig(roleName) {
  const data = await api(`/api/header-config/nav/role/name/${encodeURIComponent(roleName)}`);
  return data?.navConfig?.nav || null;
}

async function fetchRoles() {
  const data = await api('/api/header-config/roles');
  return data?.roles || [];
}

async function upsertSidebarConfig(roleId, nav) {
  await api(`/api/header-config/nav/role/${roleId}/upsert`, {
    method: 'PUT',
    body: JSON.stringify({ nav })
  });
}

async function loadRoleOptions() {
  const roleSelect = $('sidebarConfigRole');
  if (!roleSelect) return;

  try {
    const roles = await fetchRoles();
    roleSelect.innerHTML = roles.map(role => `<option value="${role.role_name}">${role.role_name}</option>`).join('');
  } catch (err) {
    setStatus('Failed to load role list: ' + err.message, true);
  }
}

async function loadConfig() {
  const roleSelect = $('sidebarConfigRole');
  const roleName = roleSelect?.value;
  if (!roleName) return;

  setStatus('Loading...', false);
  try {
    const nav = await fetchSidebarConfig(roleName);
    const textArea = $('sidebarConfigJson');
    if (nav && textArea) {
      textArea.value = JSON.stringify(nav, null, 2);
      setStatus('Loaded sidebar JSON. Edit and save when ready.');
    } else if (textArea) {
      textArea.value = '';
      setStatus('No sidebar config found for this role.', true);
    }
  } catch (err) {
    setStatus(err.message || 'Failed to load config', true);
  }
}

async function saveConfig() {
  const roleSelect = $('sidebarConfigRole');
  const roleName = roleSelect?.value;
  const textArea = $('sidebarConfigJson');
  if (!roleName || !textArea) return;

  let nav;
  try {
    nav = JSON.parse(textArea.value);
  } catch (err) {
    setStatus('Invalid JSON: ' + err.message, true);
    return;
  }

  try {
    const roles = await fetchRoles();
    const role = roles.find(r => r.role_name === roleName);
    if (!role) throw new Error('Unknown role name: ' + roleName);

    await upsertSidebarConfig(role.id, nav);
    setStatus('Saved sidebar config successfully.');
  } catch (err) {
    setStatus(err.message || 'Save failed', true);
  }
}

let availableRoles = [];

window.addEventListener('load', async () => {
  const loadBtn = $('sidebarConfigLoad');
  const saveBtn = $('sidebarConfigSave');
  const roleSelect = $('sidebarConfigRole');

  if (loadBtn) loadBtn.addEventListener('click', loadConfig);
  if (saveBtn) saveBtn.addEventListener('click', saveConfig);
  if (roleSelect) roleSelect.addEventListener('change', loadConfig);

  await loadRoleOptions();
  await loadConfig();
});