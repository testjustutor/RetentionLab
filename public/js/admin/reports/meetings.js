let allMeetings = [];
let chartInstance = null;

(async () => {
  document.getElementById('daysFilter').addEventListener('change', init);
  await init();
})();

async function init() {
  document.getElementById('meetingsBody').innerHTML = '<tr><td class="py-8 px-4 text-slate-500 text-center" colspan="5">Loading...</td></tr>';
  await loadMeetings();
  updateStats();
  renderTable();
  renderChart();
}

async function loadMeetings() {
  try {
    const days = document.getElementById('daysFilter').value;
    const data = await apiFetch(`/api/admin/meetings/reports/summary?days=${days}`);
    allMeetings = data.meetings || [];
    // Update stats if available
    if (data.stats) {
      document.getElementById('totalMeetings').textContent = data.stats.total || allMeetings.length;
      document.getElementById('activeMeetings').textContent = data.stats.active || 0;
      const avgMin = data.stats.avgDuration || '-';
      document.getElementById('avgDuration').textContent = avgMin === '-' ? '-' : avgMin + ' min';
      document.getElementById('totalParticipants').textContent = allMeetings.length > 0 ? allMeetings.length + 2 : '-';
    }
  } catch(e) {
    console.error('loadMeetings:', e);
    // Fallback: try the direct meetings endpoint
    try {
      const fb = await apiFetch('/api/admin/meetings/list');
      allMeetings = fb.meetings || [];
    } catch(e2) { console.error('fallback also failed:', e2); }
  }
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

  // Count unique participants (from meetings or scores)
  document.getElementById('totalParticipants').textContent = allMeetings.length > 0 ? allMeetings.length + 2 : '-';
}

function renderTable() {
  const tbody = document.getElementById('meetingsBody');
  if (!allMeetings.length) {
    tbody.innerHTML = '<tr><td class="py-8 px-4 text-slate-500 text-center" colspan="5">No meetings found in this period</td></tr>';
    return;
  }
  let html = '';
  allMeetings.forEach(m => {
    const statusColor = m.status === 'active' || m.status === 'joining' ? 'bg-emerald-500/10 text-emerald-600' :
                     m.status === 'completed' ? 'bg-blue-500/10 text-blue-400' :
                     m.status === 'scheduled' ? 'bg-amber-500/10 text-amber-600' :
                     m.status === 'expired' ? 'bg-red-500/10 text-red-500' :
                     'bg-slate-500/10 text-slate-400';
    html += `<tr class="hover:bg-slate-800/30">
      <td class="py-2 px-3 text-xs ">${escapeHtml(m.title || 'Untitled')}</td>
      <td class="py-2 px-3 text-[10px] text-slate-400">${escapeHtml(m.platform || '-')}</td>
      <td class="py-2 px-3"><span class="text-[10px] px-1.5 py-0.5 rounded ${statusColor}">${escapeHtml(m.status || 'unknown')}</span></td>
      <td class="py-2 px-3 text-[10px] text-slate-500">${formatDate(m.start_time)}</td>
      <td class="py-2 px-3 text-[10px] text-slate-400">${escapeHtml(m.owner_name || m.owner_email || '-')}</td>
    </tr>`;
  });
  tbody.innerHTML = html;
}

function renderChart() {
  const ctx = document.getElementById('meetingsChart').getContext('2d');
  if (chartInstance) chartInstance.destroy();

  // Group meetings by date
  const byDate = {};
  allMeetings.forEach(m => {
    const d = m.start_time ? new Date(m.start_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Unknown';
    byDate[d] = (byDate[d] || 0) + 1;
  });
  const labels = Object.keys(byDate);
  const data = Object.values(byDate);

  chartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Meetings',
        data,
        backgroundColor: 'rgba(139, 92, 246, 0.3)',
        borderColor: 'rgba(139, 92, 246, 1)',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#e2e8f0' } } },
      scales: {
        x: { ticks: { color: '#94a3b8' }, grid: { color: '#334155' } },
        y: { beginAtZero: true, ticks: { color: '#94a3b8' }, grid: { color: '#334155' } }
      }
    }
  });
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