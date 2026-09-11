/**
 * public/js/admin/meetings/calendar.js
 */

var COLORS = {};
var LABELS = {};
// Provider color, keyed by the value actually stored on each connection row
// (its display name, e.g. "Google Calendar") rather than the provider's
// internal short name — COLORS/LABELS above are keyed by the short name and
// don't match row.provider, which is why the Provider column couldn't just
// reuse them directly.
var PROVIDER_COLORS_BY_DISPLAY = {};

// The calendar_providers table has no color column at all, so p.color was
// always undefined and every provider fell back to the same flat 'slate' —
// which is why every badge looked identical/dull. Assign real, distinct
// colors here instead: familiar brand-ish colors for the common providers,
// and a rotating palette for anything else so new providers still get a
// color of their own instead of all collapsing to gray.
var KNOWN_PROVIDER_COLORS = {
  google: 'blue',
  zoom: 'violet',
  teams: 'indigo',
  microsoft: 'indigo',
  outlook: 'cyan',
  office365: 'cyan',
  apple: 'rose',
  icloud: 'rose'
};
var PROVIDER_COLOR_PALETTE = ['blue', 'violet', 'emerald', 'amber', 'rose', 'cyan', 'indigo', 'fuchsia', 'teal', 'orange'];
var allConnections = [];
var connectionsTable = null;
var calendarProviders = [];

function fmtDate(iso) { if(!iso) return '--'; var d = new Date(iso); return d.toLocaleDateString([],{month:'short',day:'numeric'})+' '+d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}); }

async function loadProviders() {
  try {
    var json = await apiFetch('/api/admin/meetings/calendar/calendar-providers', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    var providers = json.providers || [];
    calendarProviders = providers;
    COLORS = {};
    LABELS = {};
    PROVIDER_COLORS_BY_DISPLAY = {};
    providers.forEach(function(p, idx) {
      var key = (p.name || '').toLowerCase();
      var color = KNOWN_PROVIDER_COLORS[key] || PROVIDER_COLOR_PALETTE[idx % PROVIDER_COLOR_PALETTE.length];
      COLORS[p.name] = color;
      LABELS[p.name] = p.display_name || p.name;
      PROVIDER_COLORS_BY_DISPLAY[p.display_name || p.name] = color;
    });
  } catch(err) {
    console.error('Failed to load providers:', err);
    // Fallback to defaults
    COLORS = { google: 'blue', zoom: 'violet', teams: 'indigo' };
    LABELS = { google: 'Google Calendar', zoom: 'Zoom', teams: 'Microsoft Teams' };
    PROVIDER_COLORS_BY_DISPLAY = { 'Google Calendar': 'blue', 'Zoom': 'violet', 'Microsoft Teams': 'indigo' };
  }
}

async function loadConnections() {
  try {
    // Show loading state
    if (connectionsTable) {
      connectionsTable.setLoading(true);
    }

    var json = await apiFetch('/api/admin/meetings/calendar/calendar-connections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    allConnections = json.data || [];
    // Compute stats from the SAME field the table itself uses to decide
    // Connected vs Not Connected (Calendarstatus) — not a separate 'status'
    // field that isn't even present on this data, which is why the count
    // used to always show 0 regardless of how many rows the table marked
    // Connected. Providers are only counted for rows that are actually
    // connected, since a disconnected row has no real provider yet.
    var active = allConnections.filter(function(x){ return x.Calendarstatus === 'active'; });
    var providers = {};
    active.forEach(function(x){ if(x.provider) providers[x.provider]=true; });

    document.getElementById('statActive').textContent = active.length;
    document.getElementById('statTotal').textContent = allConnections.length;
    document.getElementById('statProviders').textContent = Object.keys(providers).length;

    // Apply client-side search filter
    applySearchFilter();
    
    // Hide loading state
    if (connectionsTable) {
      connectionsTable.setLoading(false);
    }
  } catch(err) {
    // Hide loading state on error
    if (connectionsTable) {
      connectionsTable.setLoading(false);
      connectionsTable.setData([]);
    }
    document.getElementById('connectionsContainer').innerHTML = '<div class="bg-white border border-slate-200 rounded-lg p-4 text-center text-red-600"><p class="text-sm font-medium">Failed to load</p><p class="text-xs mt-1 text-slate-500">' + escHtml(err.message) + '</p></div>';
  }
}

function applySearchFilter() {
  var searchTerm = (document.getElementById('searchInput')?.value || '').toLowerCase();
  var filtered = allConnections;
  if (searchTerm) {
    filtered = allConnections.filter(function(x) {
      return (x.email || '').toLowerCase().includes(searchTerm) ||
             (x.provider || '').toLowerCase().includes(searchTerm) ||
             (x.role_name || '').toLowerCase().includes(searchTerm);
    });
  }

  // Initialize or update table
  if (!connectionsTable) {
    connectionsTable = createTable({
      containerId: 'connectionsContainer',
      headers: [
        { label: 'Instructor', key: 'email', render: function(value, row) {
          var color = COLORS[row.provider] || 'slate';
          return '<div class="flex items-center gap-2">' +
            '<div class="w-7 h-7 rounded-full bg-' + color + '-100 flex items-center justify-center text-' + color + '-700 font-bold text-[10px] flex-shrink-0">' + (value || '?').charAt(0).toUpperCase() + '</div>' +
            '<span class="text-xs font-medium text-slate-900">' + escHtml(value) + '</span></div>';
        }},
        { label: 'Name', key: 'name', render: function(value) { return '<span class="text-xs text-slate-900">' + escHtml(value || '--') + '</span>'; }},
        { label: 'Provider', key: 'provider', render: function(value, row) {
          // Blank until actually connected — a disconnected row has no real
          // provider yet, so showing a name (or the "Calendar" fallback) was
          // misleading. Same condition the Calendar Connected column uses.
          if (row.Calendarstatus !== 'active') return '<span class="text-xs text-slate-400">--</span>';
          var color = PROVIDER_COLORS_BY_DISPLAY[value] || COLORS[value] || 'slate';
          var label = LABELS[value] || value || 'Calendar';
          // Solid pastel background (not a faint 10% tint) so each provider's
          // color actually reads as different at a glance.
          return '<span class="inline-flex items-center whitespace-nowrap px-2 py-0.5 rounded-full text-[10px] font-semibold bg-' + color + '-100 text-' + color + '-800 border border-' + color + '-300">' + escHtml(label) + '</span>';
        }},
        { label: 'Status', key: 'Userstatus', render: function(value) {
          var text = value === 1 ? 'Active' : 'InActive';
          var cls = value === 1 ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-amber-500/10 text-amber-800 border-amber-500/20';
          return '<span class="inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-medium ' + cls + '">' + (text || 'unknown') + '</span>';
        }},
        { label: 'Calendar Connected', key: 'Calendarstatus', render: function(value) {
          if (value === 'active') {
            return '<span class="text-xs font-semibold text-emerald-600">Connected</span>';
          }
          return '<span class="text-xs font-semibold text-red-600">Not Connected</span>';
        }},
        { label: 'Token Expiry', key: 'token_expire_at', render: function(value) { return '<span class="text-xs text-slate-500">' + fmtDate(value) + '</span>'; }},
        { label: 'Last Resync', key: 'last_synced_at', render: function(value) { return '<span class="text-xs text-slate-500">' + fmtDate(value) + '</span>'; }},
        { label: 'Calendar Sync', key: 'user_id', render: function(value, row) {
          return '<button class="sync-btn inline-flex items-center gap-1 px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-medium rounded transition-colors" data-user-id="' + value + '" data-email="' + escHtml(row.email) + '">' +
            '<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>' +
            'Calendar Sync' +
          '</button>';
        }}
      ],
      data: filtered,
      emptyMessage: 'No calendar accounts connected',
      pagination: {
        perPage: 10,
        onPageChange: function(page) {
          console.log('Page changed to:', page);
        }
      }
    });
    connectionsTable.render();
  } else {
    connectionsTable.setData(filtered);
  }
}

// Search on input (client-side filter)
document.addEventListener('DOMContentLoaded', function() {
  var searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('input', function() {
      applySearchFilter();
    });
  }
});


// NOTE: the "Connect" action was removed from this page's Calendar Connected
// column (it now only shows a plain Connected/Not Connected status). Sending
// the calendar verification email is done from Admin > People > Users instead
// (see public/js/admin/people/users.js -> .connect-calendar-btn handler),
// which hits the same /api/admin/meetings/calendar/send-verification endpoint.

// Sync button click handler
document.addEventListener('click', async function(e) {
  if (e.target.closest('.sync-btn')) {
    e.preventDefault();
    var btn = e.target.closest('.sync-btn');
    var userId = btn.getAttribute('data-user-id');
    var email = btn.getAttribute('data-email');
    
    // Show info toast
    showToast('Starting sync for ' + email + '...');

    // Show loading state
    var originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<svg class="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Syncing...';

    try {
      var res = await apiFetch('/api/admin/meetings/calendar/sync-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: parseInt(userId) })
      });
      
      showToast(res.message || 'Sync completed successfully');
      
      // Reload connections to update last_synced_at
      await loadConnections();
    } catch(err) {
      showToast('Sync failed: ' + (err.message || 'Unknown error'), true);
    } finally {
      // Restore button state
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  }
});


loadProviders();
loadConnections();