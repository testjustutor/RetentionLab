var PLAT = { 'google-meet':'Google Meet','zoom':'Zoom','teams':'Teams' };
var allTranscripts = [];
var transcriptsTable = null;

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

async function fetchTranscripts() {
  try {
    const userId = window.instructorFilter ? window.instructorFilter.getValue() : null;
    const fromDate = document.getElementById('filterFromDate')?.value || '';
    const toDate = document.getElementById('filterToDate')?.value || '';
    
    // Get logged-in user UUID from localStorage
    const currentUser = JSON.parse(localStorage.getItem('rl_user') || '{}');
    const loggedInUser = currentUser?.user_uuid || null;

    var json = await apiFetch('/api/admin/content/transcripts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: userId || undefined,
        startDate: fromDate || undefined,
        endDate: toDate || undefined,
        loggedInUser: loggedInUser || undefined
      })
    });
    allTranscripts = json.transcripts || [];
  } catch(err) {
    console.error('Failed to fetch transcripts:', err);
    allTranscripts = [];
  }
}

function applySearchFilter() {
  const searchTerm = (document.getElementById('searchInput')?.value || '').toLowerCase();
  var filtered = allTranscripts;
  if (searchTerm) {
    filtered = allTranscripts.filter(function(t) {
      return (t.title || '').toLowerCase().includes(searchTerm);
    });
  }

  if (!transcriptsTable) {
    transcriptsTable = createTable({
      containerId: 'transcriptsContainer',
      headers: [
        { label: 'Meeting', key: 'title', render: function(value) {
          return '<p class="font-medium truncate max-w-[150px] text-slate-900">' + escHtml(value || 'Untitled') + '</p>';
        }},
        { label: 'Date & Time', key: 'start_time', render: function(value) {
          return '<span class="text-xs text-slate-500">' + fmtTime(value) + '</span>';
        }},
        { label: 'Platform', key: 'platform', render: function(value) {
          return '<span class="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">' + escHtml(PLAT[value] || value || 'Unknown') + '</span>';
        }},
        { label: 'Transcript', key: 'has_transcript', render: function(value, row) {
          var cls = value ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-slate-100 text-slate-500 border-slate-200';
          var label = value ? 'Available' : (row.asset_status === 'Conversion' ? 'Processing' : 'Not Started');
          return '<span class="inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-medium ' + cls + '">' + label + '</span>';
        }},
        { label: 'Status', key: 'status', render: function(value) {
          var cls = value === 'completed' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-amber-500/10 text-amber-800 border-amber-500/20';
          return '<span class="inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-medium ' + cls + '">' + (value || 'unknown') + '</span>';
        }},
        { label: 'View', key: 'has_transcript', render: function(value, row) {
          return value && row.view_url ? '<button onclick="viewTranscript(\'' + row.meeting_id + '\', \'' + escHtml(row.title || '') + '\', \'' + escHtml(row.instructor_name || '') + '\', \'' + escHtml(row.platform || '') + '\', \'' + escHtml(row.start_time || '') + '\', \'' + row.view_url + '\')" class="text-[10px] text-violet-600 hover:text-violet-700 px-1.5 py-0.5 rounded hover:bg-slate-100 transition-colors">View</button>'
            : '<span class="text-[10px] text-slate-600">--</span>';
          }}
      ],
      data: filtered,
      emptyMessage: 'No transcripts found',
      pagination: { perPage: 10 }
    });
    transcriptsTable.render();
  } else {
    transcriptsTable.setData(filtered);
  }
}

async function loadTranscripts() {
  if (transcriptsTable) transcriptsTable.setLoading(true);
  await fetchTranscripts();
  if (transcriptsTable) transcriptsTable.setLoading(false);
  applySearchFilter();
}

function escHtml(s) {
  if (!s) return '';
  const div = document.createElement('div');
  div.textContent = String(s);
  return div.innerHTML;
}

// View transcript in modal
window.viewTranscript = function(meetingId, title, instructor, platform, startTime, viewUrl) {
  document.getElementById('modal-transcript-title').textContent = 'Transcript - ' + title;
  document.getElementById('modal-transcript-meeting').textContent = title || '--';
  document.getElementById('modal-transcript-instructor').textContent = instructor || '--';
  document.getElementById('modal-transcript-platform').textContent = platform || '--';
  document.getElementById('modal-transcript-date').textContent = startTime ? new Date(startTime).toLocaleString() : '--';
  document.getElementById('transcript-iframe').src = viewUrl;
  document.getElementById('transcript-modal').classList.remove('hidden');
  document.getElementById('transcript-modal').classList.add('flex');
};

// Close transcript modal
document.getElementById('close-transcript-modal')?.addEventListener('click', function() {
  document.getElementById('transcript-modal').classList.add('hidden');
  document.getElementById('transcript-modal').classList.remove('flex');
  document.getElementById('transcript-iframe').src = '';
});

document.getElementById('transcript-modal')?.addEventListener('click', function(e) {
  if (e.target === document.getElementById('transcript-modal')) {
    document.getElementById('transcript-modal').classList.add('hidden');
    document.getElementById('transcript-modal').classList.remove('flex');
    document.getElementById('transcript-iframe').src = '';
  }
});

document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape' && !document.getElementById('transcript-modal').classList.contains('hidden')) {
    document.getElementById('transcript-modal').classList.add('hidden');
    document.getElementById('transcript-modal').classList.remove('flex');
    document.getElementById('transcript-iframe').src = '';
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
setTimeout(function() { loadTranscripts(); }, 500);
