/**
 * Admin Dashboard
 * Loads dashboard statistics and renders charts
 */

let dashboardData = null;

(async () => {
  await loadDashboardData();
  renderDashboard();
})();

async function loadDashboardData() {
  try {
    const data = await apiFetch('/api/admin/dashboard/overview');
    dashboardData = data;
  } catch (e) {
    console.error('Failed to load dashboard:', e);
    showToast('Failed to load dashboard data', true);
  }
}

function renderDashboard() {
  if (!dashboardData) return;

  // Update KPI cards
  if (dashboardData.kpis) {
    document.getElementById('todayMeetings').textContent = dashboardData.kpis.todayMeetings || 0;
    document.getElementById('pendingReviews').textContent = dashboardData.kpis.pendingReviews || 0;
    document.getElementById('avgScore').textContent = dashboardData.kpis.avgScore ? dashboardData.kpis.avgScore + '%' : '0%';
    document.getElementById('activeUsers').textContent = dashboardData.kpis.activeUsers || 0;
    document.getElementById('weekMeetings').textContent = dashboardData.kpis.weekMeetings || 0;
    document.getElementById('completionRate').textContent = dashboardData.kpis.completionRate ? dashboardData.kpis.completionRate + '%' : '0%';
  }

  // Update last updated timestamp
  const lastUpdatedEl = document.getElementById('lastUpdated');
  if (lastUpdatedEl) {
    lastUpdatedEl.textContent = 'Updated: ' + new Date().toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  }

  // Render charts
  if (dashboardData.trends) {
    renderTrendsChart(dashboardData.trends);
  }
  if (dashboardData.scoreDistribution) {
    renderScoreChart(dashboardData.scoreDistribution);
  }
  if (dashboardData.statusDistribution) {
    renderStatusChart(dashboardData.statusDistribution);
  }
  if (dashboardData.platformUsage) {
    renderPlatformChart(dashboardData.platformUsage);
  }

  // Render recent activity
  if (dashboardData.recentActivity) {
    renderActivityTable(dashboardData.recentActivity);
  }

  // Render quick stats
  renderQuickStats(dashboardData);
}

function renderTrendsChart(trends) {
  const chart = new ApexCharts(document.querySelector('#trendsChart'), {
    series: [{ name: 'Meetings', data: trends.scores || [] }],
    chart: { type: 'area', height: 160, toolbar: { show: false } },
    xaxis: { categories: trends.dates || [], labels: { style: { colors: '#64748b', fontSize: '10px' } } },
    yaxis: { labels: { style: { colors: '#64748b', fontSize: '10px' } } },
    colors: ['#8b5cf6'],
    stroke: { curve: 'smooth', width: 2 },
    fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0.1 } }
  });
  chart.render();
}

function renderScoreChart(scores) {
  const chart = new ApexCharts(document.querySelector('#scoreChart'), {
    series: scores.data || [],
    chart: { type: 'donut', height: 160 },
    labels: scores.labels || [],
    colors: ['#10b981', '#3b82f6', '#f59e0b', '#ef4444'],
    legend: { position: 'bottom', labels: { colors: '#e2e8f0', fontSize: '10px' } }
  });
  chart.render();
}

function renderStatusChart(status) {
  const chart = new ApexCharts(document.querySelector('#statusChart'), {
    series: status.data || [],
    chart: { type: 'pie', height: 128 },
    labels: status.labels || [],
    colors: ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#64748b'],
    legend: { position: 'bottom', labels: { colors: '#e2e8f0', fontSize: '9px' } }
  });
  chart.render();
}

function renderPlatformChart(platform) {
  const chart = new ApexCharts(document.querySelector('#platformChart'), {
    series: platform.data || [],
    chart: { type: 'bar', height: 128 },
    xaxis: { categories: platform.labels || [], labels: { style: { colors: '#64748b', fontSize: '10px' } } },
    colors: ['#8b5cf6'],
    plotOptions: { bar: { borderRadius: 4, columnWidth: '60%' } }
  });
  chart.render();
}

function renderActivityTable(activities) {
  const tbody = document.getElementById('activityTable');
  if (!activities || activities.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="py-3 text-center text-slate-500">No recent activity</td></tr>';
    return;
  }

  tbody.innerHTML = activities.map(a => `
    <tr class="border-b border-slate-200">
      <td class="py-1.5 px-2 text-[11px] text-slate-600">${formatDate(a.time)}</td>
      <td class="py-1.5 px-2 text-[11px] font-medium text-slate-900">${escapeHtml(a.meeting)}</td>
      <td class="py-1.5 px-2 text-[11px] text-slate-600">${a.platform}</td>
      <td class="py-1.5 px-2"><span class="px-2 py-0.5 rounded-full text-[10px] font-medium ${getStatusClass(a.status)}">${a.status}</span></td>
    </tr>
  `).join('');
}

function renderQuickStats(data) {
  const container = document.getElementById('quickStats');
  if (!container) return;

  const stats = [
    { label: 'Total Meetings', value: data.kpis?.weekMeetings || 0 },
    { label: 'Total Reviews', value: data.kpis?.pendingReviews || 0 },
    { label: 'Active Users', value: data.kpis?.activeUsers || 0 },
    { label: 'Avg Quality Score', value: (data.kpis?.avgScore || 0) + '%' },
    { label: 'Completion Rate', value: (data.kpis?.completionRate || 0) + '%' }
  ];

  container.innerHTML = stats.map(stat => `
    <div class="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0">
      <span class="text-[11px] text-slate-600">${stat.label}</span>
      <span class="text-[11px] font-semibold text-slate-900">${stat.value}</span>
    </div>
  `).join('');
}

function getStatusClass(status) {
  const classes = {
    'completed': 'bg-emerald-100 text-emerald-700',
    'active': 'bg-blue-100 text-blue-700',
    'scheduled': 'bg-amber-100 text-amber-700',
    'cancelled': 'bg-red-100 text-red-700'
  };
  return classes[status] || 'bg-slate-100 text-slate-700';
}

function formatDate(dateStr) {
  if (!dateStr) return '--';
  return new Date(dateStr).toLocaleString('en-US', { 
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
  });
}

function escapeHtml(s) {
  if (!s) return '';
  const div = document.createElement('div');
  div.textContent = String(s);
  return div.innerHTML;
}

function showToast(msg, isError) {
  console.log(isError ? 'Error: ' + msg : msg);
}