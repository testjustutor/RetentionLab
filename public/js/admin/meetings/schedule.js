// ── Initial load from DB only (no sync) ──
async function loadFromDB() {
  try {
    const hours = document.getElementById('hoursSelect').value;
    const json = await apiFetch('/api/meeting-schedule/all?hours=' + hours);
    renderSchedule(json);
  } catch (err) { console.error(err); }
}

// ── Sync: fetch from Google → store in DB → display ──
async function doSync() {
  const hours = document.getElementById('hoursSelect').value;
  const container = document.getElementById('scheduleContainer');
  container.innerHTML = '<div class="flex flex-col items-center justify-center py-20"><div class="w-8 h-8 border-3 border-violet-500 border-t-transparent rounded-full animate-spin"></div><p class="mt-3 text-sm text-slate-600">Syncing meetings from Google Calendar...</p></div>';
  try {
    const json = await apiFetch('/api/meeting-schedule/sync?hours=' + hours, { method: 'POST' });
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

  document.getElementById('statUsers').textContent = json.connectedUsers || 0;
  document.getElementById('statMeetings').textContent = totalEvents;

  if (!users.length) {
    container.innerHTML = '<div class="flex flex-col items-center justify-center py-16 text-slate-500"><svg class="w-16 h-16 mb-4 text-slate-300" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg><p class="text-sm font-medium text-slate-700">No meetings found</p><p class="text-xs mt-1 text-slate-500">Connect instructor calendars from the Users page, then sync to see meetings</p></div>';
    return;
  }

  const platformColors = {
    'zoom': { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', badge: 'bg-blue-100 text-blue-700' },
    'teams': { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', badge: 'bg-purple-100 text-purple-700' },
    'google-meet': { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-700' },
    'unknown': { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-700', badge: 'bg-slate-100 text-slate-700' }
  };

  // Grid redesign: many users visible; each user has its own scrollable meeting list.
  container.innerHTML = '<div class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">' +
    users.map((u, idx) => {
      const events = (u.events || []).sort((a,b) => new Date(a.start_time || 0) - new Date(b.start_time || 0));

      const eventItems = events.map(e => {
        const start = e.start_time ? new Date(e.start_time) : null;
        const end = e.end_time ? new Date(e.end_time) : null;

        // Avoid “Invalid Date” rendering
        const dateStr = start && !Number.isNaN(start.getTime())
          ? start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          : '—';

        const timeStr = start && !Number.isNaN(start.getTime())
          ? start.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
          : '';

        const endStr = (end && start && !Number.isNaN(end.getTime()) && !Number.isNaN(start.getTime()))
          ? ' - ' + end.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
          : '';

        const durationMin = (end && start && !Number.isNaN(end.getTime()) && !Number.isNaN(start.getTime()))
          ? Math.round((end - start) / 60000)
          : null;

        const durationStr = durationMin ? durationMin + ' min' : '';

        const platform = e.platform || 'unknown';
        const platformLabel = platform.replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase());
        const platformColor = platformColors[platform] || platformColors['unknown'];

        return '<div class="flex items-start gap-3 p-3 mb-2 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">' +
          '<div class="flex-shrink-0 w-16 text-center"><p class="text-xs font-semibold text-slate-900">' + dateStr + '</p><p class="text-[10px] text-slate-900">' + timeStr + endStr + '</p></div>' +
          '<div class="flex-1 min-w-0">' +
            '<p class="text-sm font-medium text-slate-900 truncate">' + escHtml(e.title || 'Untitled Meeting') + '</p>' +
            '<div class="text-[10px] text-slate-900 mt-0.5">' +
              '<span class="inline-block px-2 py-0.5 rounded text-[10px] font-medium ' + platformColor.badge + '">' + platformLabel + '</span>' +
              (e.link ? '<a href="' + e.link + '" target="_blank" class="text-[10px] text-violet-600 hover:text-violet-700 font-medium">Join Meeting →</a>' : '') +
            '</div>' +
          '</div>' +
        '</div>';
      }).join('');

      return '<div class="bg-white border border-slate-200 rounded-lg p-2 shadow-sm hover:shadow-md transition-shadow">' +
        '<div class="flex items-center gap-3 mb-2 pb-2 border-b border-slate-200">' +
          '<div class="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center text-violet-700 font-bold text-sm">' + (u.email || '?').charAt(0).toUpperCase() + '</div>' +
          '<div class="flex-1 min-w-0">' +
            '<p class="text-sm font-semibold text-slate-900 truncate">' + escHtml(u.email) + '</p>' +
            '<p class="text-xs text-slate-500">' + events.length + ' meeting' + (events.length !== 1 ? 's' : '') + ' scheduled</p>' +
          '</div>' +
        '</div>' +
        '<div class="flex-1 overflow-y-auto p-3 max-h-64">' + eventItems + '</div>' +
      '</div>';
    }).join('') + '</div>';
}

document.getElementById('hoursSelect').addEventListener('change', loadFromDB);
loadFromDB();