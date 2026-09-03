// ── Filter Helpers ──
function getDateFilterParams() {
  // For Get Data: From Date, To Date, Instructor
  const fromDate = document.getElementById('filterFromDate')?.value || '';
  const toDate = document.getElementById('filterToDate')?.value || '';
  const instructorId = window.instructorFilter ? window.instructorFilter.getValue() : null;
  const params = new URLSearchParams();
  if (fromDate) params.append('from_date', fromDate);
  if (toDate) params.append('to_date', toDate);
  if (instructorId) params.append('instructor_id', instructorId);
  return params.toString();
}

function getSyncFilterParams() {
  // For Sync: Range (hours) only
  const hours = document.getElementById('hoursSelect')?.value || '24';
  const params = new URLSearchParams();
  params.append('hours', hours);
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
  // Use searchable select component for instructor filter
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
      } catch {
        return [];
      }
    },
    displayField: 'name',
    valueField: 'uuid',
    onSelect: (selectedId) => {
      // Store selected instructor ID for filtering
      window.selectedInstructorId = selectedId || null;
    }
  });

  // Store reference globally for getDateFilterParams
  window.instructorFilter = instructorFilter;
}

// ── Initial load from DB only (no sync) ──
async function loadFromDB() {
  const container = document.getElementById('scheduleContainer');
  container.innerHTML = '<div class="flex items-center justify-center py-20"><div class="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin"></div><span class="ml-3 text-sm text-slate-500">Loading...</span></div>';
  try {
    const fromDate = document.getElementById('filterFromDate')?.value || '';
    const toDate = document.getElementById('filterToDate')?.value || '';
    const instructorId = window.instructorFilter ? window.instructorFilter.getValue() : null;
    
    const json = await apiFetch('/api/admin/meeting-schedule/all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
        instructor_id: instructorId || undefined
      })
    });
    renderSchedule(json);
  } catch (err) {
    container.innerHTML = '<div class="flex flex-col items-center justify-center py-20 text-red-600"><p class="text-sm">Failed to load</p><p class="text-xs mt-1 text-slate-500">' + escHtml(err.message) + '</p></div>';
  }
}

// ── Sync: fetch from Google → store in DB → display ──
async function doSync() {
  const container = document.getElementById('scheduleContainer');
  container.innerHTML = '<div class="flex flex-col items-center justify-center py-20"><div class="w-8 h-8 border-3 border-violet-500 border-t-transparent rounded-full animate-spin"></div><p class="mt-3 text-sm text-slate-600">Syncing meetings from Google Calendar...</p></div>';
  try {
    const hours = document.getElementById('hoursSelect')?.value || '24';
    const json = await apiFetch('/api/admin/meeting-schedule/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hours: parseInt(hours) })
    });
    if (json.synced !== undefined) showToast(json.synced + ' meetings synced successfully');
    renderSchedule(json);
  } catch (err) {
    container.innerHTML = '<div class="flex flex-col items-center justify-center py-20 text-red-600"><svg class="w-12 h-12 mb-3" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"/></svg><p class="text-sm font-medium">Sync failed</p><p class="text-xs mt-1 text-slate-500">' + escHtml(err.message) + '</p></div>';
  }
}

function renderSchedule(json) {
  const container = document.getElementById('scheduleContainer');
  const users = json.users || [];
  const totalEvents = json.totalEvents || 0;

  document.getElementById('statUsers').textContent =  json.totalUsers || json.connectedUsers || 0;
  document.getElementById('statMeetings').textContent = totalEvents;

  if (!users.length) {
    container.innerHTML = '<div class="flex flex-col items-center justify-center py-16 text-slate-500"><svg class="w-16 h-16 mb-4 text-slate-300" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg><p class="text-sm font-medium text-slate-700">No meetings found</p><p class="text-xs mt-1 text-slate-500">Try adjusting your date range or filters</p></div>';
    return;
  }

  const platformColors = {
    'zoom': { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', badge: 'bg-blue-100 text-blue-700' },
    'teams': { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', badge: 'bg-purple-100 text-purple-700' },
    'google-meet': { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-700' },
    'unknown': { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-700', badge: 'bg-slate-100 text-slate-700' }
  };

  container.innerHTML = '<div class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">' +
    users.map((u, idx) => {
      const events = (u.events || []).sort((a,b) => new Date(a.start_time || 0) - new Date(b.start_time || 0));

      const eventItems = events.map((e, eventIdx) => {
        const start = e.start_time ? new Date(e.start_time) : null;
        const end = e.end_time ? new Date(e.end_time) : null;

        const dateStr = start && !Number.isNaN(start.getTime())
          ? start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          : '—';

        const timeStr = start && !Number.isNaN(start.getTime())
          ? start.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
          : '';

        const endStr = (end && start && !Number.isNaN(end.getTime()) && !Number.isNaN(start.getTime()))
          ? ' - ' + end.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
          : '';

        const platform = e.platform || 'unknown';
        const platformLabel = platform.replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase());
        const platformColor = platformColors[platform] || platformColors['unknown'];

        return '<div class="flex items-start gap-3 p-0 bg-blue-50/40 rounded-lg hover:bg-blue-50 transition-colors">' +
          '<div class="flex-shrink-0 w-16 text-center"><p class="text-[11px] font-bold text-blue-950">' + dateStr + '</p><p class="text-[10px] font-semibold text-blue-700">' + timeStr + endStr + '</p></div>' +
          '<div class="flex-1 min-w-0">' +
            '<p class="text-[12px] font-bold text-slate-900 truncate">' + escHtml(e.title || 'Untitled Meeting') + '</p>' +
            '<div class="text-[10px] text-blue-700 mt-0.5">' +
              '<span class="inline-block px-2 py-0.5 rounded text-[10px] font-semibold ' + platformColor.badge + '">' + platformLabel + '</span>' +
              (e.link ? '<a href="' + e.link + '" target="_blank" class="text-[10px] text-blue-700 hover:text-blue-800 font-semibold ml-2">Join Meeting →</a>' : '') +
            '</div>' +
          '</div>' +
        '</div>' +
        (eventIdx < events.length - 1 ? '<div class="border-t border-blue-200 my-2"></div>' : '');
      }).join('');

      return '<div class="bg-gradient-to-br from-blue-50 to-cyan-100 border-2 border-blue-200 rounded-lg p-3 shadow-md hover:shadow-lg transition-shadow">' +
        '<div class="flex items-center gap-3 mb-2 pb-2 border-b-2 border-blue-200">' +
          '<div class="w-10 h-10 rounded-full bg-white border border-blue-200 flex items-center justify-center text-blue-700 font-bold text-sm">' + (u.email || '?').charAt(0).toUpperCase() + '</div>' +
          '<div class="flex-1 min-w-0">' +
            '<p class="text-[12px] font-bold text-blue-950 truncate">' + escHtml(u.email) + '</p>' +
            '<p class="text-[11px] font-semibold text-blue-800">' + events.length + ' meeting' + (events.length !== 1 ? 's' : '') + ' scheduled</p>' +
          '</div>' +
        '</div>' +
        '<div class="flex-1 overflow-y-auto p-3 max-h-64 custom-scrollbar">' + eventItems + '</div>' +
      '</div>';
    }).join('') + '</div>';
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
loadFromDB();