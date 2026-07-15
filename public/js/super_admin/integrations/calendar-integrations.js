// Super Admin - Calendar Integrations (Providers + Credentials)

let allProviders = [];
let allCredentials = [];

function $(id) { return document.getElementById(id); }

async function apiGet(path) {
  const res = await fetch(path, { credentials: 'include' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || data.message || `GET ${path} failed`);
  return data;
}

async function apiPost(path, body, method = 'POST') {
  const res = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || data.message || `${method} ${path} failed`);
  return data;
}

function closeModal() {
  $('modalOverlay').classList.add('hidden');
}

function openProviderModal() {
  $('modalTitle').textContent = 'Add Calendar Provider';
  $('providerModalMode').value = 'create';
  $('provider_id').value = '';
  $('provider_name').value = '';
  $('provider_display_name').value = '';
  $('provider_auth_url').value = '';
  $('provider_token_url').value = '';
  $('provider_scopes').value = '';
  $('provider_is_active').checked = true;
  $('providerForm').classList.remove('hidden');
  $('credentialForm').classList.add('hidden');
  $('modalOverlay').classList.remove('hidden');
}

function openCredentialModal(provider_id) {
  $('credentialProviderId').value = provider_id;
  $('modalTitle').textContent = 'Add Calendar Credentials';
  $('credentialModalMode').value = 'create';

  $('credential_id').value = '';
  $('client_id').value = '';
  $('client_secret').value = '';
  $('tenant_id').value = '';
  $('redirect_uris').value = 'http://localhost:3000/api/calendar/callback';
  $('javascript_origins').value = 'http://localhost:3000';
  $('extra_config').value = '';
  $('cred_is_active').checked = true;

  $('providerForm').classList.add('hidden');
  $('credentialForm').classList.remove('hidden');
  $('modalOverlay').classList.remove('hidden');
}

function renderProviders() {
  const ul = $('providersList');
  ul.innerHTML = '';
  if (!allProviders.length) {
    ul.innerHTML = '<li class="text-xs text-slate-500">No providers</li>';
    return;
  }

  allProviders.forEach(p => {
    const pid = p.provider_id || p.id;
    const li = document.createElement('li');
    li.className = 'flex items-center justify-between gap-3 py-1.5';
    li.innerHTML = `
      <div>
        <div class="text-sm font-semibold">${p.display_name || p.name}</div>
        <div class="text-xs text-slate-500">provider_id: ${pid}</div>
      </div>
      <div class="flex items-center gap-2">
        <button class="px-2 py-1 bg-slate-800 text-xs rounded text-slate-200" onclick="loadCredentials(${pid})">Credentials</button>
        <button class="px-2 py-1 bg-violet-600 text-xs rounded text-white" onclick="openCredentialModal(${pid})">Add Creds</button>
      </div>
    `;
    ul.appendChild(li);
  });
}

function renderCredentials() {
  const body = $('credentialsTableBody');
  body.innerHTML = '';

  if (!allCredentials.length) {
    body.innerHTML = '<tr><td colspan="7" class="py-6 text-center text-slate-500 text-xs">No credentials for this provider</td></tr>';
    return;
  }

  allCredentials.forEach(c => {
    const status = c.is_active === 1 ? 'Active' : 'Inactive';
    body.innerHTML += `
      <tr class="border-t border-slate-800/40">
        <td class="py-2 px-2 text-xs text-slate-300">${c.id}</td>
        <td class="py-2 px-2 text-xs text-slate-300">${c.client_id}</td>
        <td class="py-2 px-2 text-xs text-slate-300">${c.tenant_id || '-'}</td>
        <td class="py-2 px-2 text-xs text-slate-300">${Array.isArray(c.redirect_uris) ? c.redirect_uris.join(', ') : '-'}</td>
        <td class="py-2 px-2 text-xs text-slate-300">${Array.isArray(c.javascript_origins) ? c.javascript_origins.join(', ') : '-'}</td>
        <td class="py-2 px-2 text-xs">${c.is_active === 1 ? '<span class="text-green-400">Active</span>' : '<span class="text-red-400">Inactive</span>'}</td>
        <td class="py-2 px-2 text-xs">
          <div class="flex gap-2">
            <button class="text-indigo-400 hover:text-indigo-300" onclick="editCredential(${c.id})">Edit</button>
            <button class="text-red-400 hover:text-red-300" onclick="deleteCredential(${c.id})">Delete</button>
          </div>
        </td>
      </tr>
    `;
  });
}

async function loadProviders() {
  const res = await apiGet('/api/calendar-integrations/providers');
  allProviders = res.data || [];
  renderProviders();
}

async function loadCredentials(provider_id) {
  $('selectedProviderLabel').textContent = 'Provider ID: ' + provider_id;
  const addBtn = $('addCredentialBtn');
  if (addBtn) {
    addBtn.classList.remove('hidden');
    addBtn.onclick = () => openCredentialModal(provider_id);
  }

  const res = await apiGet(`/api/calendar-integrations/credentials?provider_id=${encodeURIComponent(provider_id)}&includeInactive=1`);
  allCredentials = (res.data?.credentials || []).map(c => ({
    ...c,
    redirect_uris: typeof c.redirect_uris === 'string' ? JSON.parse(c.redirect_uris) : c.redirect_uris,
    javascript_origins: typeof c.javascript_origins === 'string' ? JSON.parse(c.javascript_origins) : c.javascript_origins,
    extra_config: typeof c.extra_config === 'string' ? JSON.parse(c.extra_config) : c.extra_config
  }));

  renderCredentials();
}

function editCredential(id) {
  const c = allCredentials.find(x => x.id === id);
  if (!c) return;

  $('credentialModalMode').value = 'edit';
  $('modalTitle').textContent = 'Edit Calendar Credentials';

  $('credential_id').value = c.id;
  $('credentialProviderId').value = c.provider_id;
  $('client_id').value = c.client_id || '';
  $('client_secret').value = c.client_secret || '';
  $('tenant_id').value = c.tenant_id || '';
  $('redirect_uris').value = Array.isArray(c.redirect_uris) ? c.redirect_uris.join('\n') : '';
  $('javascript_origins').value = Array.isArray(c.javascript_origins) ? c.javascript_origins.join('\n') : '';
  $('extra_config').value = c.extra_config ? JSON.stringify(c.extra_config, null, 2) : '';
  $('cred_is_active').checked = c.is_active === 1;

  $('providerForm').classList.add('hidden');
  $('credentialForm').classList.remove('hidden');
  $('modalOverlay').classList.remove('hidden');
}

async function deleteCredential(id) {
  if (!confirm('Delete credentials?')) return;
  await fetch(`/api/calendar-integrations/credentials/${id}`, { method: 'DELETE', credentials: 'include' }).then(r => r.json().catch(() => ({}))).catch(() => ({}));
  await loadCredentials($('credentialProviderId').value);
}

// Google OAuth JSON parser - pastes from Google Cloud Console OAuth credentials file
function parseGoogleOauthJson() {
  const raw = $('googleOauthJsonInput').value.trim();
  if (!raw) return alert('Paste the Google OAuth JSON first.');

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return alert('Invalid JSON. Paste the full JSON object from Google Cloud Console.');
  }

  // Handle { web: { ... } } format or direct { client_id: ... }
  const data = parsed.web || parsed;

  if (!data.client_id) return alert('Could not find client_id in the JSON. Make sure you pasted the correct OAuth credentials file.');

  $('client_id').value = data.client_id || '';
  $('client_secret').value = data.client_secret || '';
  $('redirect_uris').value = Array.isArray(data.redirect_uris) ? data.redirect_uris.join('\n') : '';
  $('javascript_origins').value = Array.isArray(data.javascript_origins) ? data.javascript_origins.join('\n') : '';

  // Also optionally fill provider form fields if they're in the JSON
  if (data.auth_uri && $('provider_auth_url')) $('provider_auth_url').value = data.auth_uri;
  if (data.token_uri && $('provider_token_url')) $('provider_token_url').value = data.token_uri;

  // Show success feedback
  const btn = $('parseGoogleJsonBtn');
  const orig = btn.textContent;
  btn.textContent = '✓ Fields Filled!';
  setTimeout(() => { btn.textContent = orig; }, 2000);
}

// Expose to HTML
window.loadProviders = loadProviders;
window.loadCredentials = loadCredentials;
window.openCredentialModal = openCredentialModal;
window.editCredential = editCredential;
window.deleteCredential = deleteCredential;
window.openProviderModal = openProviderModal;
window.closeModal = closeModal;
window.parseGoogleOauthJson = parseGoogleOauthJson;

// Wire modals (if present)
document.addEventListener('DOMContentLoaded', () => {
  try {
    $('provider_add_btn')?.addEventListener('click', openProviderModal);

    $('parseGoogleJsonBtn')?.addEventListener('click', parseGoogleOauthJson);

    $('saveProviderBtn')?.addEventListener('click', async () => {
      const body = {
        provider_id: parseInt($('provider_id').value, 10),
        name: $('provider_name').value.trim(),
        display_name: $('provider_display_name').value.trim(),
        auth_url: $('provider_auth_url').value.trim() || null,
        token_url: $('provider_token_url').value.trim() || null,
        scopes: (() => {
          const raw = $('provider_scopes').value.trim();
          if (!raw) return null;
          try { return JSON.parse(raw); } catch { return raw.split(',').map(s => s.trim()).filter(Boolean); }
        })(),
        is_active: $('provider_is_active').checked ? 1 : 0
      };
      const mode = $('providerModalMode').value;
      if (mode === 'edit') {
        await apiPost(`/api/calendar-integrations/providers/${$('provider_edit_id').value}`, body, 'PUT');
      } else {
        await apiPost('/api/calendar-integrations/providers', body, 'POST');
      }
      closeModal();
      await loadProviders();
    });

    $('credentialForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const provider_id = $('credentialProviderId').value;
      const mode = $('credentialModalMode').value;
      const isActive = $('cred_is_active').checked ? 1 : 0;

      const redirect_uris = $('redirect_uris').value.split('\n').map(s => s.trim()).filter(Boolean);
      const javascript_origins = $('javascript_origins').value.split('\n').map(s => s.trim()).filter(Boolean);

      let extra_config = null;
      const raw = $('extra_config').value.trim();
      if (raw) {
        try { extra_config = JSON.parse(raw); } catch { extra_config = { raw }; }
      }

      const body = {
        provider_id: parseInt(provider_id, 10),
        client_id: $('client_id').value.trim(),
        client_secret: $('client_secret').value.trim(),
        tenant_id: $('tenant_id').value.trim() || null,
        redirect_uris,
        javascript_origins,
        extra_config,
        is_active: isActive
      };

      if (mode === 'edit') {
        await apiPost(`/api/calendar-integrations/credentials/${$('credential_id').value}`, body, 'PUT');
      } else {
        await apiPost('/api/calendar-integrations/credentials', body, 'POST');
      }

      closeModal();
      await loadCredentials(provider_id);
    });
  } catch (e) {
    console.error('calendar-integrations.js init failed', e);
  }

  loadProviders().catch(err => console.error('loadProviders failed', err));
});