var PLAT = { 'google-meet':'Google Meet','zoom':'Zoom','teams':'Teams' };
var allRecordings = [];
var recordingsTable = null;

function fmtTime(iso){if(!iso)return'--';var d=new Date(iso);return d.toLocaleDateString([],{month:'short',day:'numeric'})+' '+d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});}
function fmtDuration(s,e){if(!s||!e)return'--';var m=Math.round((new Date(e)-new Date(s))/60000);if(m<60)return m+'m';var h=Math.floor(m/60);m=m%60;return h+'h'+(m>0?' '+m+'m':'');}

function getFilterParams() {
  const fromDate = document.getElementById('filterFromDate')?.value || '';
  const toDate = document.getElementById('filterToDate')?.value || '';
  const userId = window.instructorFilter ? window.instructorFilter.getValue() : null;
  const params = new URLSearchParams();
  if (fromDate) params.append('from_date', fromDate);
  if (toDate) params.append('to_date', toDate);
  if (userId) params.append('user_id', userId);
  return params.toString();
}

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

async function loadRecordings() {
  if (recordingsTable) {
    recordingsTable.setLoading(true);
  }
  try {
    const userId = window.instructorFilter ? window.instructorFilter.getValue() : null;
    const fromDate = document.getElementById('filterFromDate')?.value || '';
    const toDate = document.getElementById('filterToDate')?.value || '';
    const searchTerm = (document.getElementById('searchInput')?.value || '').toLowerCase();
    
    // Get logged-in user UUID from localStorage
    const currentUser = JSON.parse(localStorage.getItem('rl_user') || '{}');
    const loggedInUser = currentUser?.user_uuid || null;
    
    var json = await apiFetch('/api/admin/content/audio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: userId || undefined,
        startDate: fromDate || undefined,
        endDate: toDate || undefined,
        loggedInUser: loggedInUser || undefined
      })
    });
    allRecordings = json.recordings || [];
    
    // Apply search filter
    var filtered = allRecordings;
    if (searchTerm) {
      filtered = allRecordings.filter(function(r) {
        return (r.title || '').toLowerCase().includes(searchTerm);
      });
    }
    
    if (!recordingsTable) {
      recordingsTable = createTable({
        containerId: 'recordingsContainer',
        headers: [
          { label: 'Meeting', key: 'title', render: function(value) {
            return '<p class="font-medium truncate max-w-[150px] text-slate-900">' + escHtml(value || 'Untitled') + '</p>';
          }},
          { label: 'Date & Time', key: 'start_time', render: function(value) {
            return '<span class="text-xs text-slate-500">' + fmtTime(value) + '</span>';
          }},
          { label: 'Duration', key: 'start_time', render: function(value, row) {
            return '<span class="text-xs text-slate-500">' + fmtDuration(value, row.end_time) + '</span>';
          }},
          { label: 'Platform', key: 'platform', render: function(value) {
            return '<span class="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">' + escHtml(PLAT[value] || value || 'Unknown') + '</span>';
          }},
          { label: 'Recording', key: 'has_recording', render: function(value, row) {
            var cls = value ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-slate-100 text-slate-500 border-slate-200';
            var label = value ? 'Available' : (row.asset_status === 'Conversion' ? 'Processing' : 'Not Started');
            return '<span class="inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-medium ' + cls + '">' + label + '</span>';
          }},
          { label: 'Status', key: 'status', render: function(value) {
            var cls = value === 'completed' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-amber-500/10 text-amber-800 border-amber-500/20';
            return '<span class="inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-medium ' + cls + '">' + (value || 'unknown') + '</span>';
          }},
          { label: 'Play', key: 'has_recording', render: function(value, row) {
            return value && row.play_url 
              ? '<audio controls preload="none" class="h-6 w-32"><source src="' + row.play_url + '" type="audio/wav"></audio>'
              : '<span class="text-[10px] text-slate-600">--</span>';
          }}
        ],
        data: filtered,
        emptyMessage: 'No recordings found',
        pagination: { perPage: 10 }
      });
      recordingsTable.render();
    } else {
      recordingsTable.setData(filtered);
    }
  } catch(err) {
    if (recordingsTable) {
      recordingsTable.setData([]);
    }
    document.getElementById('recordingsContainer').innerHTML = '<div class="bg-white border border-slate-200 rounded-lg p-4 text-center text-red-600"><p class="text-sm font-medium">Failed to load</p><p class="text-xs mt-1 text-slate-500">' + escHtml(err.message) + '</p></div>';
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
setTimeout(function() { loadRecordings(); }, 500);
