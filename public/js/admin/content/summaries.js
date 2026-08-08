var PLAT = { 'google-meet':'Google Meet','zoom':'Zoom','teams':'Teams' };
var allSummaries = [];
var summariesTable = null;

function fmtTime(iso){if(!iso)return'--';var d=new Date(iso);return d.toLocaleDateString([],{month:'short',day:'numeric'})+' '+d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});}

function setDefaultDateRange() {
  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const fromEl = document.getElementById('filterFromDate');
  const toEl = document.getElementById('filterToDate');
  if (fromEl && !fromEl.value) fromEl.value = weekAgo.toISOString().split('T')[0];
  if (toEl && !toEl.value) toEl.value = now.toISOString().split('T')[0];
}

async function loadInstructors() {
  const instructorFilter = createSearchableSelect({
    containerId: 'instructorFilterContainer',
    placeholder: 'Select instructor...',
    dataSource: async (searchTerm) => {
      try {
        const json = await apiFetch('/api/admin/content/instructors');
        let instructors = json.instructors || [];
        if (searchTerm) {
          const term = searchTerm.toLowerCase();
          instructors = instructors.filter(inst => 
            (inst.name || '').toLowerCase().includes(term) ||
            (inst.email || '').toLowerCase().includes(term)
          );
        }
        return instructors;
      } catch { return []; }
    },
    displayField: 'name',
    valueField: 'uuid',
    onSelect: (selectedId) => {
      window.selectedInstructorId = selectedId || null;
    }
  });
  window.instructorFilter = instructorFilter;
}

async function loadSummaries() {
  if (summariesTable) summariesTable.setLoading(true);
  try {
    const userId = window.instructorFilter ? window.instructorFilter.getValue() : null;
    const fromDate = document.getElementById('filterFromDate')?.value || '';
    const toDate = document.getElementById('filterToDate')?.value || '';
    const searchTerm = (document.getElementById('searchInput')?.value || '').toLowerCase();
    
    // Get logged-in user UUID from localStorage
    const currentUser = JSON.parse(localStorage.getItem('rl_user') || '{}');
    const loggedInUser = currentUser?.user_uuid || null;

    var json = await apiFetch('/api/admin/content/summaries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: userId || undefined,
        startDate: fromDate || undefined,
        endDate: toDate || undefined,
        loggedInUser: loggedInUser || undefined
      })
    });
    allSummaries = json.summaries || [];

    var filtered = allSummaries;
    if (searchTerm) {
      filtered = allSummaries.filter(function(s) {
        return (s.title || '').toLowerCase().includes(searchTerm);
      });
    }

    if (!summariesTable) {
      summariesTable = createTable({
        containerId: 'summariesContainer',
        headers: [
          { label: 'Meeting', key: 'title', render: function(value, row) {
            return '<p class="font-medium truncate max-w-[150px] text-slate-900">' + escHtml(value || 'Untitled') + '</p>' +
              (row.evidence_quote ? '<p class="text-[10px] text-slate-500 italic mt-0.5 truncate max-w-[150px]">"' + escHtml(row.evidence_quote.slice(0, 80)) + '..."</p>' : '');
          }},
          { label: 'Date & Time', key: 'start_time', render: function(value) {
            return '<span class="text-xs text-slate-500">' + fmtTime(value) + '</span>';
          }},
          { label: 'Platform', key: 'platform', render: function(value) {
            return '<span class="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">' + escHtml(PLAT[value] || value || 'Unknown') + '</span>';
          }},
          { label: 'OQI Score', key: 'oqi_score', render: function(value) {
            if (!value) return '<span class="text-slate-600">--</span>';
            var od = Number(value).toFixed(1) + '/10';
            var oc = value >= 8 ? 'text-emerald-600' : value >= 6 ? 'text-amber-800' : 'text-red-400';
            return '<span class="font-mono font-bold ' + oc + '">' + od + '</span>';
          }},
          { label: 'Artifacts', key: 'summary_url', render: function(value, row) {
            var ab = [];
            if (row.summary_url) ab.push('<a href="' + row.summary_url + '" target="_blank" class="text-violet-600 hover:text-violet-700">Summary</a>');
            if (row.action_items_url) ab.push('<a href="' + row.action_items_url + '" target="_blank" class="text-amber-800 hover:text-amber-700">Actions</a>');
            if (row.topic_clusters_url) ab.push('<a href="' + row.topic_clusters_url + '" target="_blank" class="text-emerald-600 hover:text-emerald-700">Topics</a>');
            return ab.length ? '<div class="flex gap-1.5">' + ab.join('<span class="text-slate-300">|</span>') + '</div>' : '<span class="text-[10px] text-slate-600">--</span>';
          }},
          { label: 'Status', key: 'status', render: function(value) {
            var cls = value === 'completed' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-amber-500/10 text-amber-800 border-amber-500/20';
            return '<span class="inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-medium ' + cls + '">' + (value || 'unknown') + '</span>';
          }},
          { label: 'View', key: 'has_summary', render: function(value, row) {
            if (value && row.summary_url) {
              return '<a href="' + row.summary_url + '" target="_blank" class="text-xs text-violet-600 hover:text-violet-700 px-2 py-1 rounded hover:bg-slate-100 transition-colors">View</a>';
            }
            var cls = value ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-slate-100 text-slate-500 border-slate-200';
            var label = value ? 'Available' : (row.asset_status === 'Conversion' ? 'Processing' : 'Not Started');
            return '<span class="inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ' + cls + '">' + label + '</span>';
          }}
        ],
        data: filtered,
        emptyMessage: 'No summaries found',
        pagination: { perPage: 10 }
      });
      summariesTable.render();
    } else {
      summariesTable.setData(filtered);
    }
  } catch(err) {
    if (summariesTable) summariesTable.setData([]);
    document.getElementById('summariesContainer').innerHTML = '<div class="bg-white border border-slate-200 rounded-lg p-4 text-center text-red-600"><p class="text-sm font-medium">Failed to load</p><p class="text-xs mt-1 text-slate-500">' + escHtml(err.message) + '</p></div>';
  }
}

function escHtml(s) {
  if (!s) return '';
  const div = document.createElement('div');
  div.textContent = String(s);
  return div.innerHTML;
}

// Initialize
setDefaultDateRange();
loadInstructors();

// Auto-load data on page load
setTimeout(function() { loadSummaries(); }, 500);
