var COLORS = {};
var LABELS = {};
var allConnections = [];
var connectionsTable = null;
var calendarProviders = [];

function fmtDate(iso) { if(!iso) return '--'; var d = new Date(iso); return d.toLocaleDateString([],{month:'short',day:'numeric'})+' '+d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}); }

async function loadProviders() {
  try {
    var json = await apiFetch('/api/instructor-calendar/providers', {
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

    var json = await apiFetch('/api/instructor-calendar/connections', {
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
  } catch(err) {
    if (connectionsTable) {
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
        { label: 'Provider', key: 'provider', render: function(value) {
          return '<span class="text-xs text-slate-700">' + escHtml(LABELS[value] || value || 'Calendar') + '</span>';
        }},
        { label: 'Status', key: 'status', render: function(value) {
          var cls = value === 'active' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-amber-500/10 text-amber-800 border-amber-500/20';
          return '<span class="inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-medium ' + cls + '">' + (value || 'unknown') + '</span>';
        }},
        { label: 'Calendar Connected', key: 'created_at', render: function(value) { return '<span class="text-xs text-slate-500">' + fmtDate(value) + '</span>'; }},
        { label: 'Last Resync', key: 'last_synced_at', render: function(value) { return '<span class="text-xs text-slate-500">' + fmtDate(value) + '</span>'; }},
        { label: 'Role', key: 'role_name', render: function(value) { return '<span class="text-xs text-slate-500">' + escHtml(value || '--') + '</span>'; }}
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

loadProviders();
loadConnections();
