let allAudits = [];
let stats = {};
let passChart = null, catChart = null;

(async () => {
  ['auditTypeFilter','daysFilter'].forEach(id => {
    document.getElementById(id).addEventListener('change', loadAudits);
  });
  await loadAudits();
})();

async function loadAudits() {
  document.getElementById('auditBody').innerHTML = '<tr><td class="py-8 px-4 text-slate-500 text-center" colspan="8">Loading...</td></tr>';
  try {
    const days = document.getElementById('daysFilter').value;
    const data = await apiFetch(`/api/audit-reports/summary?days=${days}`);
    allAudits = data.audits || [];
    stats = data.stats || {};
    render();
  } catch(e) {
    console.error('Failed to load audit reports:', e);
    document.getElementById('auditBody').innerHTML = `<tr><td class="py-8 px-4 text-red-400 text-center" colspan="8">Error: ${e.message}</td></tr>`;
  }
}

// Listen for filter changes
document.addEventListener('change', (e) => {
  if (e.target.id === 'auditTypeFilter' || e.target.id === 'daysFilter') {
    loadAudits();
  }
});

function render() {
  updateStats();
  renderTable();
  renderCharts();
}

function updateStats() {
  document.getElementById('totalAudits').textContent = stats.total || 0;
  document.getElementById('passedCount').textContent = stats.passed || 0;
  document.getElementById('failedCount').textContent = stats.failed || 0;
  document.getElementById('passRate').textContent = stats.passRate ? stats.passRate + '%' : '0%';
}

function renderTable() {
  const tbody = document.getElementById('auditBody');
  const filterType = document.getElementById('auditTypeFilter').value;
  const filtered = filterType ? allAudits.filter(a => a.type === filterType) : allAudits;

  if (!filtered.length) {
    tbody.innerHTML = '<tr><td class="py-8 px-4 text-slate-500 text-center" colspan="8">No audit entries found for this period</td></tr>';
    return;
  }

  let html = '';
  filtered.forEach(a => {
    const typeColor = a.type === 'accuracy' ? 'bg-amber-500/10 text-amber-800' :
                      a.type === 'quality' ? 'bg-violet-500/10 text-violet-400' :
                      'bg-blue-500/10 text-blue-400';
    const statusColor = a.status === 'pass' ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' :
                        'bg-red-500/10 text-red-400 border border-red-500/20';
    const scoreColor = +a.score >= 4 ? 'text-emerald-600' : +a.score >= 3 ? 'text-blue-400' : 'text-amber-800';

    html += `<tr class="hover:bg-slate-800/30">
      <td class="py-2 px-3"><span class="text-[10px] px-1.5 py-0.5 rounded ${typeColor} font-medium">${a.type}</span></td>
      <td class="py-2 px-3 text-[10px] text-slate-300">${escapeHtml(a.category || '-')}</td>
      <td class="py-2 px-3 text-xs max-w-[150px] truncate">${escapeHtml(a.description || '-')}</td>
      <td class="py-2 px-3 text-[10px] text-slate-400 max-w-[200px] truncate">${escapeHtml(a.findings || '-')}</td>
      <td class="py-2 px-3 text-xs font-bold ${scoreColor}">${a.score || '-'}</td>
      <td class="py-2 px-3 text-[10px] text-slate-500">${a.maxScore || '-'}</td>
      <td class="py-2 px-3"><span class="text-[10px] px-1.5 py-0.5 rounded ${statusColor}">${a.status === 'pass' ? 'Pass' : 'Fail'}</span></td>
      <td class="py-2 px-3 text-[10px] text-slate-500">${formatDate(a.date)}</td>
    </tr>`;
  });
  tbody.innerHTML = html;
}

function renderCharts() {
  // Destroy existing charts
  if (passChart) { passChart.destroy(); passChart = null; }
  if (catChart) { catChart.destroy(); catChart = null; }

  const filterType = document.getElementById('auditTypeFilter').value;
  const filtered = filterType ? allAudits.filter(a => a.type === filterType) : allAudits;

  // Pass Rate Doughnut
  const passed = filtered.filter(a => a.status === 'pass').length;
  const failed = filtered.filter(a => a.status === 'fail').length;
  
  if (document.getElementById('passRateChart')) {
    passChart = new Chart(document.getElementById('passRateChart').getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: ['Passed', 'Failed'],
        datasets: [{
          data: [passed, failed],
          backgroundColor: ['rgba(34, 197, 94, 0.6)', 'rgba(239, 68, 68, 0.6)'],
          borderColor: ['rgba(34, 197, 94, 1)', 'rgba(239, 68, 68, 1)'],
          borderWidth: 2
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { color: '#e2e8f0' } } }
      }
    });
  }

  // Categories Bar
  const catCounts = {};
  filtered.forEach(a => { catCounts[a.type] = (catCounts[a.type] || 0) + 1; });
  const catLabels = Object.keys(catCounts);
  const catData = Object.values(catCounts);
  const catColors = {
    accuracy: { bg: 'rgba(245, 158, 11, 0.3)', border: 'rgba(245, 158, 11, 1)' },
    quality: { bg: 'rgba(139, 92, 246, 0.3)', border: 'rgba(139, 92, 246, 1)' },
    compliance: { bg: 'rgba(59, 130, 246, 0.3)', border: 'rgba(59, 130, 246, 1)' }
  };

  if (document.getElementById('categoriesChart')) {
    catChart = new Chart(document.getElementById('categoriesChart').getContext('2d'), {
      type: 'bar',
      data: {
        labels: catLabels,
        datasets: [{
          label: 'Count',
          data: catData,
          backgroundColor: catLabels.map(l => (catColors[l] || catColors.accuracy).bg),
          borderColor: catLabels.map(l => (catColors[l] || catColors.accuracy).border),
          borderWidth: 1
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#94a3b8' }, grid: { color: '#334155' } },
          y: { beginAtZero: true, ticks: { color: '#94a3b8' }, grid: { color: '#334155' } }
        }
      }
    });
  }
}

function exportCsv() {
  const filterType = document.getElementById('auditTypeFilter').value;
  const filtered = filterType ? allAudits.filter(a => a.type === filterType) : allAudits;
  if (!filtered.length) { showToast('No data to export', true); return; }

  const headers = ['Type','Category','Description','Findings','Score','Max Score','Status','Date'];
  const csv = [headers.join(',')].concat(filtered.map(a => [
    a.type, `"${(a.category||'').replace(/"/g,'""')}"`, `"${(a.description||'').replace(/"/g,'""')}"`,
    `"${(a.findings||'').replace(/"/g,'""')}"`, a.score||'', a.maxScore||'', a.status, formatDate(a.date)
  ].join(','))).join('\n');

  const blob = new Blob([csv], { type:'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `audit-report-${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  showToast('Exported');
}

function formatDate(d) { if (!d) return 'N/A'; return new Date(d).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' }); }
function escapeHtml(s) { if (!s) return ''; const div = document.createElement('div'); div.textContent = String(s); return div.innerHTML; }