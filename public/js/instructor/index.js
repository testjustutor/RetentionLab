/**
 * public/js/instructor/index.js
 *
 * Extracted from an inline <script type="module"> block that used to live
 * directly in public/instructor/index.html, to match this codebase's
 * convention of one external, same-named JS file per HTML page (see e.g.
 * public/js/instructor/dashboard.js, public/js/instructor/meetings.js).
 * Behavior is unchanged - only the auth.js import path was adjusted for
 * this file's new location (was '../js/auth.js' relative to the HTML page
 * under public/instructor/; is '../auth.js' relative to this file under
 * public/js/instructor/ - both resolve to public/js/auth.js).
 */
import { getCachedUser } from '../auth.js';

// ── Calendar provider flags (super-admin Settings > Calendar Integrations
// toggle) — single shared fetch, consulted by both the Google and Microsoft
// blocks below before they show their banner or run their connect flow.
// Fails open for Google (has been the long-working default) and closed for
// Microsoft (not something a network hiccup should suddenly surface).
let _providerFlagsPromise = null;
function getCalendarProviderFlags() {
  if (!_providerFlagsPromise) {
    _providerFlagsPromise = fetch('/api/calendar-integrations/provider-flags', { credentials: 'include' })
      .then(res => res.json())
      .then(json => (json.success && json.data) ? json.data : { google: true, microsoft: false })
      .catch(() => ({ google: true, microsoft: false }));
  }
  return _providerFlagsPromise;
}

// Calendar integration — inline actions like admin/people/users page
// Uses logged-in user's email from session; no redirect to calendar.html
(function() {
  // ── DOM refs ──
  const connectBtn    = document.getElementById('connectCalendarBtn');
  const disconnectBtn = document.getElementById('disconnectCalendarBtn');
  const statusBadge   = document.getElementById('calendarStatusBadge');
  const toast         = document.getElementById('calendarToast');
  const banner        = document.getElementById('calendarBanner');
  const calendarIcon  = document.getElementById('calendarIcon');
  const calendarTitle = document.getElementById('calendarTitle');
  const calendarDesc  = document.getElementById('calendarDesc');

  if (!connectBtn || !disconnectBtn) return;

  function showToast(msg, isError) {
    toast.textContent = msg;
    toast.className = 'text-xs ' + (isError ? 'text-red-400' : 'text-emerald-400');
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 4000);
  }

  function setState(state) {
    // state: 'connected' | 'not_connected' | 'loading'
    connectBtn.classList.add('hidden');
    disconnectBtn.classList.add('hidden');
    statusBadge.classList.add('hidden');

    if (state === 'connected') {
      calendarTitle.textContent = 'Calendar Connected';
      calendarDesc.textContent = 'Your Google Calendar is synced. Meetings are automatically imported.';
      statusBadge.textContent = 'Connected';
      statusBadge.className = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[12px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
      disconnectBtn.classList.remove('hidden');
    } else if (state === 'not_connected') {
      calendarTitle.textContent = 'Sync your Google Calendar';
      calendarDesc.textContent = 'Connect your calendar to automatically import meetings for evaluation.';
      statusBadge.textContent = 'Not Connected';
      statusBadge.className = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[12px] font-medium bg-slate-800 text-slate-400 border border-slate-700';
      connectBtn.classList.remove('hidden');
    } else {
      // loading
      calendarTitle.textContent = 'Checking calendar status...';
      calendarDesc.textContent = '';
    }
  }

  // ── Check status on load (like admin's loadCalendarConnections) ──
  async function checkStatus() {
    // Get user from cache instead of window.currentUser
    const user = getCachedUser();
    if (!user || !user.email) return;

    setState('loading');
    try {
      const res = await fetch('/api/instructor/calendar/connections', {
        credentials: 'include'
      });
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        const conn = json.data.find(c => c.email.toLowerCase() === user.email.toLowerCase());
        if (conn && conn.status === 'active') {
          setState('connected');
          return;
        }
      }
    } catch { /* ignore — fall through to not_connected */ }
    setState('not_connected');
  }

  // ── Connect (self-service, redirects to Google OAuth) ──
  connectBtn.addEventListener('click', async function() {
    const user = getCachedUser();
    if (!user || !user.email) {
      showToast('Session not loaded. Please refresh.', true);
      return;
    }
    const email = user.email;
    connectBtn.disabled = true;
    connectBtn.textContent = 'Connecting...';

    try {
      const res = await fetch('/api/instructor/calendar/self-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast(data.error || 'Failed to connect calendar.', true);
        connectBtn.disabled = false;
        connectBtn.textContent = 'Connect';
        return;
      }
      // Redirect directly to Google OAuth
      window.location.href = data.redirectUrl;
    } catch (err) {
      showToast(err.message || 'Network error', true);
      connectBtn.disabled = false;
      connectBtn.textContent = 'Connect';
    }
  });

  // ── Disconnect ──
  disconnectBtn.addEventListener('click', async function() {
    const user = getCachedUser();
    if (!user || !user.email) return;
    if (!confirm('Disconnect Google Calendar for ' + user.email + '?')) return;

    try {
      const res = await fetch('/api/instructor/calendar/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email })
      });
      const data = await res.json();
      if (!data.success) {
        showToast(data.error || 'Failed to disconnect.', true);
        return;
      }
      showToast('Calendar disconnected');
      setState('not_connected');
    } catch (err) {
      showToast(err.message || 'Network error', true);
    }
  });

  // ── Init on user ready, gated by the super-admin enable/disable toggle ──
  getCalendarProviderFlags().then(flags => {
    if (!flags.google) {
      if (banner) banner.classList.add('hidden');
      return;
    }
    if (banner) banner.classList.remove('hidden');
    checkStatus();
  });

  // Add sync calendar button listener
  const syncBtn = document.getElementById('syncCalendarBtn');
  if (syncBtn) {
    syncBtn.addEventListener('click', async function() {
      try {
        const res = await fetch('/api/instructor/calendar/sync', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ daysBack: 30, daysForward: 90 })
        });
        const result = await res.json();

        if (!res.ok || !result.success) {
          throw new Error(result.error || 'Sync failed');
        }

        // Use local showToast
        showToast(result.message || 'Calendar synced successfully');

        // Reload dashboard to show new meetings
        setTimeout(() => loadDashboard(), 1000);
      } catch (err) {
        // Use local showToast
        showToast(err.message || 'Failed to sync calendar', true);
      }
    });
  }
})();

// Microsoft Calendar integration — same pattern as the Google block above,
// wired to its own banner (msCalendarBanner/msConnectCalendarBtn/etc.) and
// its own API namespace (/api/instructor/microsoft-calendar/*), since the
// two providers are independent connections a user can hold at once.
(function() {
  // ── DOM refs ──
  const connectBtn    = document.getElementById('msConnectCalendarBtn');
  const disconnectBtn = document.getElementById('msDisconnectCalendarBtn');
  const statusBadge   = document.getElementById('msCalendarStatusBadge');
  const toast         = document.getElementById('msCalendarToast');
  const calendarTitle = document.getElementById('msCalendarTitle');
  const calendarDesc  = document.getElementById('msCalendarDesc');
  const banner        = document.getElementById('msCalendarBanner');

  if (!connectBtn || !disconnectBtn) return;

  function showToast(msg, isError) {
    toast.textContent = msg;
    toast.className = 'text-xs ' + (isError ? 'text-red-400' : 'text-emerald-400');
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 4000);
  }

  function setState(state) {
    // state: 'connected' | 'not_connected' | 'loading'
    connectBtn.classList.add('hidden');
    disconnectBtn.classList.add('hidden');
    statusBadge.classList.add('hidden');

    if (state === 'connected') {
      calendarTitle.textContent = 'Calendar Connected';
      calendarDesc.textContent = 'Your Microsoft Calendar is synced. Meetings are automatically imported.';
      statusBadge.textContent = 'Connected';
      statusBadge.className = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[12px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
      disconnectBtn.classList.remove('hidden');
    } else if (state === 'not_connected') {
      calendarTitle.textContent = 'Sync your Microsoft Calendar';
      calendarDesc.textContent = 'Connect your Outlook/Teams calendar to automatically import meetings for evaluation.';
      statusBadge.textContent = 'Not Connected';
      statusBadge.className = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[12px] font-medium bg-slate-800 text-slate-400 border border-slate-700';
      connectBtn.classList.remove('hidden');
    } else {
      // loading
      calendarTitle.textContent = 'Checking calendar status...';
      calendarDesc.textContent = '';
    }
  }

  // ── Check status on load ──
  async function checkStatus() {
    const user = getCachedUser();
    if (!user || !user.email) return;

    setState('loading');
    try {
      const res = await fetch('/api/instructor/microsoft-calendar/connections', {
        credentials: 'include'
      });
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        const conn = json.data.find(c => c.email.toLowerCase() === user.email.toLowerCase());
        if (conn && conn.status === 'active') {
          setState('connected');
          return;
        }
      }
    } catch { /* ignore — fall through to not_connected */ }
    setState('not_connected');
  }

  // ── Connect (self-service, redirects to Microsoft OAuth) ──
  connectBtn.addEventListener('click', async function() {
    const user = getCachedUser();
    if (!user || !user.email) {
      showToast('Session not loaded. Please refresh.', true);
      return;
    }
    const email = user.email;
    connectBtn.disabled = true;
    connectBtn.textContent = 'Connecting...';

    try {
      const res = await fetch('/api/instructor/microsoft-calendar/self-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast(data.error || 'Failed to connect calendar.', true);
        connectBtn.disabled = false;
        connectBtn.textContent = 'Connect';
        return;
      }
      // Redirect directly to Microsoft OAuth
      window.location.href = data.redirectUrl;
    } catch (err) {
      showToast(err.message || 'Network error', true);
      connectBtn.disabled = false;
      connectBtn.textContent = 'Connect';
    }
  });

  // ── Disconnect ──
  disconnectBtn.addEventListener('click', async function() {
    const user = getCachedUser();
    if (!user || !user.email) return;
    if (!confirm('Disconnect Microsoft Calendar for ' + user.email + '?')) return;

    try {
      const res = await fetch('/api/instructor/microsoft-calendar/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email })
      });
      const data = await res.json();
      if (!data.success) {
        showToast(data.error || 'Failed to disconnect.', true);
        return;
      }
      showToast('Calendar disconnected');
      setState('not_connected');
    } catch (err) {
      showToast(err.message || 'Network error', true);
    }
  });

  // ── Init on user ready, gated by the super-admin enable/disable toggle.
  // Starts hidden by default until this resolves, so a disabled provider
  // (the common state right now — no Azure app registered yet) never
  // flashes a "Connect" button that would redirect nowhere. ──
  if (banner) banner.classList.add('hidden');
  getCalendarProviderFlags().then(flags => {
    if (!flags.microsoft) {
      if (banner) banner.classList.add('hidden');
      return;
    }
    if (banner) banner.classList.remove('hidden');
    checkStatus();
  });
})();
