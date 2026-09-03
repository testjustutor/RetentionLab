/**
 * public/js/admin/content/summaries.js
 */

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

async function fetchSummaries() {
  try {
    const userId = window.instructorFilter ? window.instructorFilter.getValue() : null;
    const fromDate = document.getElementById('filterFromDate')?.value || '';
    const toDate = document.getElementById('filterToDate')?.value || '';
    
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
  } catch(err) {
    console.error('Failed to fetch summaries:', err);
    allSummaries = [];
  }
}

function applySearchFilter() {
  const searchTerm = (document.getElementById('searchInput')?.value || '').toLowerCase();
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
          return ab.length ? '<div class="flex gap-1.5">' + ab.join('<span class="text-slate-300">|</span>') + '</div>' : '<span class="text-[10px] text-slate-600">--</span>';
        }},
        { label: 'Status', key: 'status', render: function(value) {
          var cls = value === 'completed' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-amber-500/10 text-amber-800 border-amber-500/20';
          return '<span class="inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-medium ' + cls + '">' + (value || 'unknown') + '</span>';
        }},
        { label: 'View', key: 'has_summary', render: function(value, row) {
          if (value && row.summary_url) {
            return '<button onclick="viewSummary(\'' + row.meeting_id + '\', \'' + escHtml(row.title || '') + '\', \'' + escHtml(row.instructor_name || '') + '\', \'' + escHtml(row.platform || '') + '\', \'' + escHtml(row.start_time || '') + '\', \'' + row.summary_url + '\')" class="text-xs text-violet-600 hover:text-violet-700 px-2 py-1 rounded hover:bg-slate-100 transition-colors">View</button>';
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
}

async function loadSummaries() {
  if (summariesTable) summariesTable.setLoading(true);
  await fetchSummaries();
  if (summariesTable) summariesTable.setLoading(false);
  applySearchFilter();
}

function escHtml(s) {
  if (!s) return '';
  const div = document.createElement('div');
  div.textContent = String(s);
  return div.innerHTML;
}

// View summary in modal
window.viewSummary = function(meetingId, title, instructor, platform, startTime, summaryUrl) {
  document.getElementById('modal-summary-title').textContent = 'Summary - ' + title;
  document.getElementById('modal-summary-meeting').textContent = title || '--';
  document.getElementById('modal-summary-instructor').textContent = instructor || '--';
  document.getElementById('modal-summary-platform').textContent = platform || '--';
  document.getElementById('modal-summary-date').textContent = startTime ? new Date(startTime).toLocaleString() : '--';
  document.getElementById('summary-iframe').src = summaryUrl;
  document.getElementById('summary-modal').classList.remove('hidden');
  document.getElementById('summary-modal').classList.add('flex');
};

// Close summary modal
document.getElementById('close-summary-modal')?.addEventListener('click', function() {
  document.getElementById('summary-modal').classList.add('hidden');
  document.getElementById('summary-modal').classList.remove('flex');
  document.getElementById('summary-iframe').src = '';
});

document.getElementById('summary-modal')?.addEventListener('click', function(e) {
  if (e.target === document.getElementById('summary-modal')) {
    document.getElementById('summary-modal').classList.add('hidden');
    document.getElementById('summary-modal').classList.remove('flex');
    document.getElementById('summary-iframe').src = '';
  }
});

document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape' && !document.getElementById('summary-modal').classList.contains('hidden')) {
    document.getElementById('summary-modal').classList.add('hidden');
    document.getElementById('summary-modal').classList.remove('flex');
    document.getElementById('summary-iframe').src = '';
  }
});

// Search on input - filter directly from loaded data
document.addEventListener('DOMContentLoaded', function() {
  var searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('input', function() {
      applySearchFilter();
    });
  }
});

// Initialize
setDefaultDateRange();
loadInstructors();

// Auto-load data on page load
setTimeout(function() { loadSummaries(); }, 500);