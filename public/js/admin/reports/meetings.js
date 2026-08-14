let allMeetings = [];
let dateFilter = null;
let instructorFilter = null;

(async () => {
  // Initialize date filter (default range = 1 month / 30 days).
  // autoLoad: false => data loads on page load and when Get Data is clicked,
  // but NOT automatically on every date change.
  dateFilter = createDateFilter({
    days: 30,
    autoLoad: false,
    onFilter: () => loadMeetings()
  });

  // Active + calendar-connected instructor filter (optional, non-dependent).
  loadInstructors();

  // Load data on page load using the default date range.
  await loadMeetings();
})();

async function loadInstructors() {
  try {
    instructorFilter = createSearchableSelect({
      containerId: 'instructorFilterContainer',
      placeholder: 'All instructors',
      dataSource: async () => {
        const data = await apiFetch('/api/meetings/reports/instructors');
        return data.instructors || [];
      },
      displayField: 'name',
      valueField: 'id'
      // No onSelect: instructor change does NOT auto-load; use Get Data button.
    });
  } catch (e) {
    console.error('Failed to load instructors:', e);
  }
}

async function loadMeetings() {
  document.getElementById('meetingsBody').innerHTML = '<tr><td class="py-6 px-2 text-blue-800 text-center" colspan="5">Loading meetings...</td></tr>';
  try {
    const { fromDate, toDate } = dateFilter.getDates();
    const instructorId = instructorFilter ? instructorFilter.getValue() : null;

    const params = new URLSearchParams();
    if (fromDate) params.append('from_date', fromDate);
    if (toDate) params.append('to_date', toDate);
    if (instructorId) params.append('instructor_id', instructorId);

    const data = await apiFetch(`/api/meetings/reports/summary?${params.toString()}`);
    allMeetings = data.meetings || [];
  } catch (e) {
    console.error('loadMeetings:', e);
    allMeetings = [];
    showToast('Failed to load meetings: ' + e.message, true);
  }
  updateStats();
  renderTable();
  renderTrendTable();
}

function updateStats() {
  document.getElementById('totalMeetings').textContent = allMeetings.length;
  const active = allMeetings.filter(m => m.status === 'active' || m.status === 'joining').length;
  document.getElementById('activeMeetings').textContent = active;

  // Calculate average duration from start/end time
  let totalMinutes = 0;
  let countWithDuration = 0;
  allMeetings.forEach(m => {
    if (m.start_time && m.end_time) {
      const diff = new Date(m.end_time) - new Date(m.start_time);
      if (diff > 0) { totalMinutes += diff / 60000; countWithDuration++; }
    }
  });
  const avgMin = countWithDuration ? Math.round(totalMinutes / countWithDuration) : '-';
  document.getElementById('avgDuration').textContent = avgMin === '-' ? '-' : avgMin + ' min';

  document.getElementById('totalParticipants').textContent = allMeetings.length > 0 ? allMeetings.length + 2 : '-';
}

function renderTable() {
  const tbody = document.getElementById('meetingsBody');
  if (!allMeetings.length) {
    tbody.innerHTML = '<tr><td class="py-6 px-2 text-blue-800 text-center" colspan="5">No meetings found in this period</td></tr>';
    return;
  }
  let html = '';
  allMeetings.forEach(m => {
    const statusColor = m.status === 'active' || m.status === 'joining' ? 'bg-emerald-100 text-emerald-700' :
                     m.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                     m.status === 'scheduled' ? 'bg-amber-100 text-amber-700' :
                     m.status === 'expired' ? 'bg-red-100 text-red-700' :
                     'bg-slate-100 text-slate-600';
    html += `<tr class="border-b border-blue-200 hover:bg-blue-100/70 transition-colors">
      <td class="py-2 px-2 text-[11px] font-semibold text-blue-950">${escapeHtml(m.title || 'Untitled')}</td>
      <td class="py-2 px-2 text-[11px] text-blue-800">${escapeHtml(m.platform || '-')}</td>
      <td class="py-2 px-2 text-[11px]"><span class="text-[10px] px-1.5 py-0.5 rounded font-bold ${statusColor}">${escapeHtml(m.status || 'unknown')}</span></td>
      <td class="py-2 px-2 text-[11px] text-blue-800 whitespace-nowrap">${formatDate(m.start_time)}</td>
      <td class="py-2 px-2 text-[11px] text-blue-800">${escapeHtml(m.owner_name || m.owner_email || '-')}</td>
    </tr>`;
  });
  tbody.innerHTML = html;
}

function renderTrendTable() {
  const tbody = document.getElementById('meetingsTrendTable');
  if (!tbody) return;

  if (!allMeetings.length) {
    tbody.innerHTML = '<tr><td colspan="3" class="py-2 text-center text-indigo-800 font-medium">No meeting trend data available</td></tr>';
    return;
  }

  // Group meetings by calendar date (ascending), unknown at the end.
  const byDate = {};
  allMeetings.forEach(m => {
    const key = m.start_time ? m.start_time.slice(0, 10) : 'unknown';
    const label = m.start_time ? new Date(m.start_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Unknown';
    if (!byDate[key]) byDate[key] = { label, count: 0 };
    byDate[key].count++;
  });
  const entries = Object.entries(byDate).sort((a, b) => {
    if (a[0] === 'unknown') return 1;
    if (b[0] === 'unknown') return -1;
    return a[0].localeCompare(b[0]);
  });

  const total = allMeetings.length;
  tbody.innerHTML = entries.map(([, item]) => {
    const pct = total > 0 ? ((item.count / total) * 100).toFixed(1) : 0;
    return `
      <tr class="border-b border-indigo-200 hover:bg-indigo-100/70 transition-colors">
        <td class="py-2 px-2 text-[11px] font-bold text-indigo-950">${escapeHtml(item.label)}</td>
        <td class="py-2 px-2 text-[11px] font-bold text-indigo-900 text-right">${item.count}</td>
        <td class="py-2 px-2 text-[11px] font-semibold text-indigo-700 text-right">${pct}%</td>
      </tr>`;
  }).join('');
}

function exportCsv() {
  if (!allMeetings.length) { showToast('No data to export', true); return; }
  const headers = ['Title', 'Platform', 'Status', 'Date', 'Owner'];
  const csv = [headers.join(',')].concat(allMeetings.map(m => [
    `"${(m.title||'').replace(/"/g,'""')}"`,
    `"${(m.platform||'').replace(/"/g,'""')}"`,
    `"${(m.status||'').replace(/"/g,'""')}"`,
    formatDate(m.start_time),
    `"${(m.owner_name||m.owner_email||'').replace(/"/g,'""')}"`
  ].join(','))).join('\n');
  const blob = new Blob([csv], { type:'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `meetings-report-${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  showToast('Exported');
}

function formatDate(d) { if (!d) return 'N/A'; return new Date(d).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' }); }
function escapeHtml(s) { if (!s) return ''; const div = document.createElement('div'); div.textContent = String(s); return div.innerHTML; }
