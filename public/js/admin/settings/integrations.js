/**
 * Admin Settings - Integrations Page
 * Loads dynamic calendar provider status + per-provider connected accounts
 * via /api/calendar-integrations/* (route > controller > model > db).
 * Uses shared common-ui.js helpers (escHtml, showToast) + createTable.
 */
(function () {
  'use strict';

  // Local API helper (loaded last, so it wins; sends bearer token too).
  async function apiFetch(url, options = {}) {
    const token = localStorage.getItem('auth_token') || document.cookie.match(/auth_token=([^;]+)/)?.[1];
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': 'Bearer ' + token } : {}),
      ...(options.headers || {})
    };
    const response = await fetch(url, { ...options, headers, credentials: 'include' });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || ('HTTP ' + response.status));
    }
    return response.json();
  }

  // ── State ──
  let providers = [];
  let activeProviderId = null;
  let accountsTable = null;

  // ── Helpers ──

  function setText(id, v) { const el = document.getElementById(id); if (el) el.textContent = (v == null ? '-' : v); }

  function fmtDate(v) {
    if (!v) return '<span class="text-xs text-slate-400">--</span>';
    const d = new Date(v);
    if (isNaN(d.getTime())) return escHtml(v);
    return '<span class="text-xs text-slate-600">' + d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + '</span>';
  }

  function statusBadge(value, activeCls) {
    const val = (value || '').toLowerCase();
    const map = {
      active: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30',
      verified: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30',
      connected: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30',
      pending: 'bg-amber-500/10 text-amber-800 border-amber-500/30',
      expired: 'bg-rose-500/10 text-rose-700 border-rose-500/30',
      invalid: 'bg-rose-500/10 text-rose-700 border-rose-500/30',
      disconnected: 'bg-slate-200 text-slate-600 border-slate-300',
      disabled: 'bg-slate-200 text-slate-600 border-slate-300'
    };
    const cls = map[val] || (activeCls || 'bg-slate-100 text-slate-600 border-slate-200');
    return '<span class="inline-flex px-1.5 py-0.5 rounded-full text-sm font-medium border ' + cls + '">' + escHtml(value || 'unknown') + '</span>';
  }

  // ── Render summary stat cards ──
  function renderStats() {
    const activeProviders = providers.filter(p => p.is_active === 1).length;
    const connectedCount = providers.reduce(function (s, p) { return s + (p.connected_count || 0); }, 0);
    const verifiedCount = providers.reduce(function (s, p) { return s + (p.verified_connections || 0); }, 0);
    const activeConnections = providers.reduce(function (s, p) { return s + (p.active_connections || 0); }, 0);
    setText('statActiveProviders', activeProviders);
    setText('statConnected', connectedCount);
    setText('statVerified', verifiedCount);
    setText('statActiveConnections', activeConnections);
  }

  // ── Render provider cards ──
  function renderProviderCards() {
    const container = document.getElementById('provider-cards');
    if (!container) return;

    if (!providers || providers.length === 0) {
      container.innerHTML = '<div class="col-span-full bg-white border border-slate-200 rounded-lg p-8 text-center text-sm text-slate-500">No calendar providers configured.</div>';
      return;
    }

    // Per-provider theme so the grid is colorful, readable and user friendly.
    const themes = {
      zoom:          { bg: 'bg-gradient-to-br from-cyan-50 to-blue-100', border: 'border-cyan-300', text: 'text-cyan-950', accent: 'text-cyan-800', chip: 'bg-white/80 border-cyan-200', badge: 'bg-cyan-600' },
      'google-meet': { bg: 'bg-gradient-to-br from-emerald-50 to-teal-100', border: 'border-emerald-300', text: 'text-emerald-950', accent: 'text-emerald-800', chip: 'bg-white/80 border-emerald-200', badge: 'bg-emerald-600' },
      teams:         { bg: 'bg-gradient-to-br from-indigo-50 to-violet-100', border: 'border-indigo-300', text: 'text-indigo-950', accent: 'text-indigo-800', chip: 'bg-white/80 border-indigo-200', badge: 'bg-indigo-600' }
    };

    container.innerHTML = providers.map(function (p) {
      const isActive = p.is_active === 1;
      const selected = activeProviderId === p.id;
      const scopes = Array.isArray(p.scopes) ? p.scopes.length : 0;
      const t = themes[(p.name || '').toLowerCase()] || themes.zoom;
      const accent = isActive ? t.accent : 'text-slate-600';

      let cardCls = t.bg + ' ' + t.border + ' rounded-lg p-4 shadow-sm cursor-pointer transition-all text-left border-2';
      cardCls += selected ? ' ring-2 ring-offset-2 ring-slate-900 scale-[1.01]' : ' hover:ring-2 hover:ring-offset-1 hover:ring-slate-300';

      return (
        '<div class="' + cardCls + '" data-provider-id="' + p.id + '" title="Click to view connected accounts">' +
          '<div class="flex items-start justify-between mb-3">' +
            '<div>' +
              '<p class="text-sm font-medium ' + t.text + '">' + escHtml(p.display_name || p.name) + '</p>' +
              '<p class="text-sm font-semibold ' + accent + '">' + (isActive ? 'Enabled' : 'Disabled') + '</p>' +
            '</div>' +
            (isActive
              ? '<span class="px-3 py-1 rounded-full text-sm font-bold text-white ' + t.badge + '">Active</span>'
              : '<span class="px-2 py-0.5 rounded-full text-sm font-bold bg-slate-200 text-slate-700 border border-slate-300">Inactive</span>') +
          '</div>' +
          '<div class="grid grid-cols-3 gap-2">' +
            '<div class="rounded-md ' + t.chip + ' border px-2 py-2 text-center"><p class="text-sm font-medium ' + accent + '">' + (p.connected_count || 0) + '</p><p class="text-xs font-bold-400 ' + t.text + '/80 uppercase">Connected</p></div>' +
            '<div class="rounded-md ' + t.chip + ' border px-2 py-2 text-center"><p class="text-sm font-medium ' + accent + '">' + (p.active_connections || 0) + '</p><p class="text-xs font-bold-400 ' + t.text + '/80 uppercase">Active</p></div>' +
            '<div class="rounded-md ' + t.chip + ' border px-2 py-2 text-center"><p class="text-sm font-medium ' + accent + '">' + (p.verified_connections || 0) + '</p><p class="text-xs font-bold-400 ' + t.text + '/80 uppercase">Verified</p></div>' +
          '</div>' +
          '<div class="mt-3 space-y-1.5 ' + t.text + '">' +
            '<p class="flex justify-between"><span class="text-[10px] font-bold-600 uppercase">Join</span><span class="text-[12px] font-semibold">' + escHtml(p.join_strategy || 'webclient') + '</span></p>' +
            '<p class="flex justify-between"><span class="text-[10px] font-bold-600 uppercase">Passcode</span><span class="text-[12px] font-semibold">' + (p.requires_passcode ? 'Yes' : 'No') + '</span></p>' +
            '<p class="flex justify-between"><span class="text-[10px] font-bold-600 uppercase">Scopes</span><span class="text-[12px] font-semibold">' + scopes + '</span></p>' +
          '</div>' +
        '</div>'
      );
    }).join('');
  }

  // ── Connected accounts table ──
  function initAccountsTable() {
    if (accountsTable) return;
    accountsTable = createTable({
      containerId: 'connectedAccountsContainer',
      headers: [
        { label: 'Name', key: 'name', render: function (value) { return '<p class="font-medium truncate max-w-[160px] text-slate-900">' + escHtml(value || 'Unknown') + '</p>'; } },
        { label: 'Email', key: 'email', render: function (value) { return '<span class="text-xs text-slate-600">' + escHtml(value || '') + '</span>'; } },
        { label: 'Role', key: 'role_name', render: function (value) { return '<span class="text-xs text-slate-600">' + escHtml(value || '-') + '</span>'; } },
        { label: 'Status', key: 'connection_status', render: function (value) { return statusBadge(value); } },
        { label: 'Verification', key: 'verification_status', render: function (value) { return statusBadge(value); } },
        { label: 'Connected At', key: 'connected_at', render: function (value) { return fmtDate(value); } },
        { label: 'Actions', key: 'connection_id', render: function (value, row) {
          if ((row.connection_status || '').toLowerCase() === 'active') {
            return '<button class="disconnect-btn px-2.5 py-1 rounded-md bg-rose-500 hover:bg-rose-600 text-white text-sm font-semibold transition-colors" data-connection-id="' + value + '">Disconnect</button>';
          }
          return '<span class="text-sm text-slate-400">-</span>';
        } }
      ],
      data: [],
      emptyMessage: 'No connected accounts',
      pagination: { perPage: 10 },
      searchable: true,
      exportable: false
    });
  }

  async function loadConnectedAccounts() {
    initAccountsTable();
    if (!activeProviderId) {
      setText('accounts-subtitle', 'Select a provider to view its connected accounts');
      accountsTable.setData([]);
      return;
    }

    const status = document.getElementById('accountStatusFilter')?.value || 'all';
    const provider = providers.find(function (p) { return p.id === activeProviderId; });
    setText('accounts-subtitle', (provider ? escHtml(provider.display_name) : 'Provider') + ' connected accounts');

    try {
      const res = await apiFetch('/api/calendar-integrations/connections?provider_id=' + activeProviderId + '&status=' + encodeURIComponent(status));
      const rows = (res.data && res.data.accounts) || [];
      const mapped = rows.map(function (r) {
        return {
          connection_id: r.connection_id,
          name: (r.first_name || '') + ' ' + (r.last_name || ''),
          email: r.email,
          role_name: r.role_name,
          connection_status: r.connection_status,
          verification_status: r.verification_status,
          connected_at: r.connected_at,
          user_status: r.user_status
        };
      });
      accountsTable.setData(mapped);
    } catch (err) {
      console.error('loadConnectedAccounts:', err);
      showToast('Failed to load connected accounts: ' + err.message, true);
      accountsTable.setData([]);
    }
  }

  // Delegate disconnect clicks (createTable re-renders innerHTML)
  function bindDisconnect() {
    const container = document.getElementById('connectedAccountsContainer');
    if (!container) return;
    container.onclick = async function (e) {
      const btn = e.target.closest('.disconnect-btn');
      if (!btn) return;
      const connId = btn.getAttribute('data-connection-id');
      if (!window.confirm('Disconnect this account? The instructor will need to reconnect.')) return;
      try {
        await apiFetch('/api/calendar-integrations/disconnect', {
          method: 'POST',
          body: JSON.stringify({ connection_id: Number(connId) })
        });
        showToast('Connection disconnected');
        await refreshPage();
      } catch (err) {
        console.error('disconnect:', err);
        showToast('Failed to disconnect: ' + err.message, true);
      }
    };
  }

  async function refreshPage() {
    renderStats();
    renderProviderCards();
    await loadConnectedAccounts();
  }

  // ── Load integration/status data ──
  async function loadIntegrations() {
    const container = document.getElementById('provider-cards');
    if (!container) return;

    try {
      const res = await apiFetch('/api/calendar-integrations/integration-status');
      providers = (res.data && Array.isArray(res.data)) ? res.data : [];

      // Auto-select first provider that has connections (else first provider)
      if (!activeProviderId && providers.length) {
        const fallback = providers.find(function (p) { return (p.connected_count || 0) > 0; }) || providers[0];
        activeProviderId = fallback.id;
      }

      renderStats();
      renderProviderCards();

      const st = document.getElementById('accountStatusFilter');
      if (st && !st.dataset.bound) {
        st.addEventListener('change', loadConnectedAccounts);
        st.dataset.bound = '1';
      }
      bindDisconnect();
      await loadConnectedAccounts();
    } catch (err) {
      console.error('loadIntegrations:', err);
      container.innerHTML =
        '<div class="col-span-full bg-white border border-red-200 rounded-lg p-6 text-center">' +
          '<p class="text-sm text-red-600">Failed to load integrations</p>' +
          '<p class="text-xs text-slate-500 mt-1">' + escHtml(err.message) + '</p>' +
          '<button onclick="window._reloadIntegrations && window._reloadIntegrations()" class="mt-3 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs rounded-lg transition-colors">Retry</button>' +
        '</div>';
    }
  }

  // Expose reload for the retry button
  window._reloadIntegrations = loadIntegrations;

  // Provider card click delegation
  document.addEventListener('click', function (e) {
    const card = e.target.closest('[data-provider-id]');
    if (!card) return;
    const id = Number(card.getAttribute('data-provider-id'));
    if (id) {
      activeProviderId = id;
      renderProviderCards();
      loadConnectedAccounts();
    }
  });

  // ── Init ──
  document.addEventListener('DOMContentLoaded', function () {
    const refreshBtn = document.getElementById('refresh-integrations-btn');
    if (refreshBtn) refreshBtn.addEventListener('click', loadIntegrations);
    loadIntegrations();
  });
})();



