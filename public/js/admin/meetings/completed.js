var COL = ['violet','emerald','amber','rose','sky'];
var PLAT = { 'google-meet':'Google Meet', 'zoom':'Zoom', 'teams':'Teams' };

function fmtTime(iso) { if (!iso) return '--'; var d = new Date(iso); return d.toLocaleDateString([],{month:'short',day:'numeric'}) + ' ' + d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}); }
function fmtDuration(start, end) { if (!start||!end) return '--'; var m = Math.round((new Date(end)-new Date(start))/60000); if (m<60) return m+'m'; var h=Math.floor(m/60); m=m%60; return h+'h'+ (m>0?' '+m+'m':''); }
function fmtDurationFromMinutes(minutes) { if (!minutes && minutes !== 0) return '--'; if (minutes < 60) return minutes+'m'; var h=Math.floor(minutes/60); var m=minutes%60; return h+'h'+(m>0?' '+m+'m':''); }

// ── Filter Helpers ──
function getFilterParams() {
  const fromDate = document.getElementById('filterFromDate')?.value || '';
  const toDate = document.getElementById('filterToDate')?.value || '';
  const instructorId = window.instructorFilter ? window.instructorFilter.getValue() : null;
  const params = new URLSearchParams();
  if (fromDate) params.append('from_date', fromDate);
  if (toDate) params.append('to_date', toDate);
  if (instructorId) params.append('instructor_id', instructorId);
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

  // Store reference globally for getFilterParams
  window.instructorFilter = instructorFilter;
}

async function loadCompleted() {
  var c = document.getElementById('completedContainer');
  c.innerHTML = '<div class="flex items-center justify-center py-20"><div class="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin"></div><span class="ml-3 text-sm text-slate-500">Loading completed sessions...</span></div>';
  try {
    const params = getFilterParams();
    var json = await apiFetch('/api/admin/meeting-schedule/completed?' + params, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hours: 168 })
    });
    var users = json.users || [];
    var total = json.totalEvents || 0;
    var totalDur = 0;
    var completedCount = 0;
    users.forEach(function(u){ u.events.forEach(function(e){ if(e.start&&e.end) totalDur += Math.round((new Date(e.end)-new Date(e.start))/60000); }); });
    document.getElementById('statConnected').textContent = json.connectedUsers || 0;
    document.getElementById('statMeetings').textContent = total;
    document.getElementById('statCompleted').textContent = total;
    document.getElementById('statDuration').textContent = totalDur >= 60 ? Math.floor(totalDur/60)+'h '+totalDur%60+'m' : totalDur+'m';

    if (!total) { 
      c.innerHTML = '<div class="bg-gradient-to-br from-slate-50 to-gray-100 border-2 border-slate-200 rounded-lg shadow-md overflow-hidden">' +
        '<div class="px-4 py-3 border-b-2 border-slate-200 bg-slate-200">' +
          '<h3 class="text-[13px] font-bold text-slate-900 uppercase tracking-wide">Completed Sessions</h3>' +
        '</div>' +
        '<div class="overflow-x-auto overflow-y-auto max-h-96 custom-scrollbar">' +
          '<table class="w-full">' +
            '<thead class="sticky top-0">' +
              '<tr class="text-[10px] font-bold text-slate-950 uppercase border-b-2 border-slate-300 bg-slate-200">' +
                '<th class="py-2 px-3 text-left font-bold tracking-wide">Instructor</th>' +
                '<th class="py-2 px-3 text-left font-bold tracking-wide">Meeting</th>' +
                '<th class="py-2 px-3 text-left font-bold tracking-wide">Date & Time</th>' +
                '<th class="py-2 px-3 text-left font-bold tracking-wide">Duration</th>' +
                '<th class="py-2 px-3 text-left font-bold tracking-wide">Platform</th>' +
                '<th class="py-2 px-3 text-left font-bold tracking-wide">Status</th>' +
              '</tr>' +
            '</thead>' +
            '<tbody>' +
              '<tr>' +
                '<td colspan="6" class="px-4 py-12">' +
                  '<div class="flex flex-col items-center justify-center">' +
                    '<div class="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-3">' +
                      '<svg class="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">' +
                        '<path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>' +
                      '</svg>' +
                    '</div>' +
                    '<p class="text-sm font-bold text-slate-800 mb-1">No Completed Sessions</p>' +
                    '<p class="text-xs text-slate-600 text-center max-w-sm">There are no completed sessions in the selected date range. Try adjusting your filters.</p>' +
                  '</div>' +
                '</td>' +
              '</tr>' +
            '</tbody>' +
          '</table>' +
        '</div>' +
      '</div>'; 
      return; 
    }

    // Initialize pagination
    const ITEMS_PER_PAGE = 10;
    let currentPage = 1;
    let allEvents = [];
    
    // Flatten all events from all users
    users.forEach(function(u) {
      (u.events || []).forEach(function(e) {
        allEvents.push({ ...e, user: u });
      });
    });
    
    const totalPages = Math.ceil(allEvents.length / ITEMS_PER_PAGE) || 1;
    
    console.log('Pagination debug:', { totalEvents: allEvents.length, totalPages, itemsPerPage: ITEMS_PER_PAGE });
    
    // Only show pagination if there are multiple pages
    if (totalPages > 1) {
      const pagination = createPagination({
        containerId: 'completedPagination',
        currentPage: 1,
        totalPages: totalPages,
        onPageChange: (page) => {
          currentPage = page;
          renderCompletedEvents(allEvents, currentPage);
        }
      });
      
      // Render pagination
      pagination.render();
      console.log('Pagination rendered with', totalPages, 'pages');
    } else {
      // Hide pagination container if only one page
      const pagContainer = document.getElementById('completedPagination');
      if (pagContainer) pagContainer.innerHTML = '';
      console.log('Pagination hidden - only', totalPages, 'page(s)');
    }
    
    function renderCompletedEvents(events, page) {
      const start = (page - 1) * ITEMS_PER_PAGE;
      const end = start + ITEMS_PER_PAGE;
      const pageEvents = events.slice(start, end);
      
      // Group by user
      const grouped = {};
      pageEvents.forEach(e => {
        const email = e.user.email || 'Unknown';
        if (!grouped[email]) {
          grouped[email] = { user: e.user, events: [] };
        }
        grouped[email].events.push(e);
      });
      
      var html = '';
      var userIndex = 0;
      for (const email in grouped) {
        const group = grouped[email];
        const u = group.user;
        const events = group.events;
        const color = COL[userIndex % COL.length];
        
        html += '<div class="bg-white border border-slate-200 rounded-lg overflow-hidden animate-fade-up" style="animation-delay:'+(userIndex*80)+'ms">';
        html += '<div class="p-3 border-b border-slate-200 flex items-center gap-2 bg-'+color+'-500/5">';
        html += '<div class="w-8 h-8 rounded-md bg-'+color+'-500/10 border border-'+color+'-500/20 flex items-center justify-center text-'+color+'-800 font-bold text-[10px]">'+(u.email||'?').charAt(0).toUpperCase()+'</div>';
        html += '<div class="flex-1 min-w-0"><p class="text-xs font-semibold truncate">'+escHtml(u.email)+'</p><p class="text-[10px] text-slate-500">'+escHtml(u.role_name||'instructor')+' &middot; '+events.length+' completed</p></div>';
        html += '<span class="inline-block px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-'+color+'-500/10 text-'+color+'-800 border border-'+color+'-500/20">'+events.length+'</span></div>';
        html += '<div class="overflow-x-auto"><table class="w-full text-left text-xs"><thead class="sticky top-0"><tr class="border-b-2 border-slate-300 bg-slate-200 text-[10px] font-bold text-slate-950 uppercase tracking-wider"><th class="py-2 px-3">Meeting</th><th class="py-2 px-3">Date & Time</th><th class="py-2 px-3">Duration</th><th class="py-2 px-3">Platform</th><th class="py-2 px-3 text-right">Status</th></tr></thead><tbody class="divide-y divide-slate-200">';

        events.forEach(function(e) {
          var dur = e.duration !== null && e.duration !== undefined ? fmtDurationFromMinutes(e.duration) : fmtDuration(e.start_time, e.end_time);
          var status = e.status || 'completed';
          var statusCls = status==='completed'?'bg-emerald-500/10 text-emerald-600 border-emerald-500/20':status==='failed'?'bg-red-500/10 text-red-400 border-red-500/20':'bg-amber-500/10 text-amber-800 border-amber-500/20';
          var platName = PLAT[e.platform] || (e.platform||'Unknown');
          html += '<tr class="hover:bg-slate-100 transition-colors">';
          html += '<td class="py-2 px-3"><p class="font-medium truncate max-w-[150px]">'+escHtml(e.title||'Untitled')+'</p></td>';
          html += '<td class="py-2 px-3 text-slate-500">'+fmtTime(e.start_time)+'</td>';
          html += '<td class="py-2 px-3 text-slate-500">'+dur+'</td>';
          html += '<td class="py-2 px-3"><span class="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">'+escHtml(platName)+'</span></td>';
          html += '<td class="py-2 px-3 text-right"><span class="inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-medium '+statusCls+'">'+status+'</span></td>';
          html += '</tr>';
        });
        
        html += '</tbody></table></div></div>';
        userIndex++;
      }
      
      c.innerHTML = html;
    }
    
    renderCompletedEvents(allEvents, currentPage);
  } catch(err) { c.innerHTML = '<div class="flex flex-col items-center justify-center py-20 text-red-600"><p>Failed to load</p><p class="text-xs mt-1 text-slate-500">'+escHtml(err.message)+'</p></div>'; }
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
loadCompleted();