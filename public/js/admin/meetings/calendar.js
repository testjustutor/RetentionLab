/**
 * public/js/admin/meetings/calendar.js
 */

var COLORS = {};
var LABELS = {};
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
    providers.forEach(function(p) {
      COLORS[p.name] = p.color || 'slate';
      LABELS[p.name] = p.display_name || p.name;
    });
  } catch(err) {
    console.error('Failed to load providers:', err);
    // Fallback to defaults
    COLORS = { google: 'blue', zoom: 'emerald', teams: 'violet' };
    LABELS = { google: 'Google Calendar', zoom: 'Zoom', teams: 'Microsoft Teams' };
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
    var active = allConnections.filter(function(x){return x.status==='active';});
    var providers = {};
    allConnections.forEach(function(x){ if(x.provider) providers[x.provider]=true; });

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
        { label: 'Provider', key: 'provider', render: function(value) {
          return '<span class="text-xs text-slate-700">' + escHtml(LABELS[value] || value || 'Calendar') + '</span>';
        }},
        { label: 'Status', key: 'Userstatus', render: function(value) {
          var text = value === 1 ? 'Active' : 'InActive';
          var cls = value === 1 ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-amber-500/10 text-amber-800 border-amber-500/20';
          return '<span class="inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-medium ' + cls + '">' + (text || 'unknown') + '</span>';
        }},
        { label: 'Calendar Connected', key: 'Calendarstatus', render: function(value, row) {
          if (value === 'active') {
            return '<span class="text-xs font-medium text-emerald-600">Connected</span>';
          }
          return '<a href="#" class="text-xs text-blue-600 hover:text-blue-800 connect-link" data-email="' + escHtml(row.email) + '">Connect</a>';
        }},
        { label: 'Token Expiry', key: 'token_expire_at', render: function(value) { return '<span class="text-xs text-slate-500">' + fmtDate(value) + '</span>'; }},
        { label: 'Last Resync', key: 'last_synced_at', render: function(value) { return '<span class="text-xs text-slate-500">' + fmtDate(value) + '</span>'; }},
        { label: 'Sync', key: 'user_id', render: function(value, row) {
          return '<button class="sync-btn inline-flex items-center gap-1 px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-medium rounded transition-colors" data-user-id="' + value + '" data-email="' + escHtml(row.email) + '">' +
            '<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>' +
            'Sync' +
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


// Connect link click handler - sends verification email to instructor
document.addEventListener('click', async function(e) {
  if (e.target.classList.contains('connect-link')) {
    e.preventDefault();
    var email = e.target.getAttribute('data-email');
    try {
      var res = await apiFetch('/api/admin/meetings/calendar/send-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email })
      });
      showToast('Verification email sent to ' + email);
    } catch(err) {
      showToast('Failed to send email: ' + (err.message || 'Unknown error'), true);
    }
  }
});


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