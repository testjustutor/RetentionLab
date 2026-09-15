/**
 * public/js/super_admin/dashboard/index.js
 */

let meetingTrendsChartInstance = null;
let userTrendsChartInstance = null;

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  return parts.join(' ') || '<1m';
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return dateStr; }
}

function formatDateTime(dateStr) {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  } catch { return dateStr; }
}

function statusBadge(status) {
  const colors = {
    active: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    inactive: 'bg-slate-100 text-slate-700 border border-slate-300',
    suspended: 'bg-red-100 text-red-700 border border-red-200',
    completed: 'bg-blue-100 text-blue-700 border border-blue-200',
    in_progress: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    scheduled: 'bg-amber-100 text-amber-700 border border-amber-200',
    pending: 'bg-amber-100 text-amber-700 border border-amber-200',
    joining: 'bg-indigo-100 text-indigo-700 border border-indigo-200',
    deleted: 'bg-red-100 text-red-700 border border-red-200'
  };
  const cls = colors[status] || 'bg-slate-100 text-slate-700 border border-slate-300';
  return `<span class="text-[10px] px-1.5 py-0.5 rounded ${cls}">${status || 'unknown'}</span>`;
}

async function refreshDashboard() {
  const errorEl = document.getElementById('dashboardError');
  errorEl.classList.add('hidden');

  const days = document.getElementById('timeRange')?.value || 7;

  try {
    const data = await apiFetch(`/api/super-admin/dashboard/stats?days=${days}`);
    if (!data.success || !data.stats) {
      throw new Error('Invalid response from server');
    }

    const stats = data.stats;
    renderStats(stats);
    renderRoleBadges(stats.users.byRole);
    renderCharts(stats);
    renderRecentUsers(stats.recentUsers);
    renderRecentMeetings(stats.recentMeetings);

    // Update trend period label
    const trendEl = document.getElementById('trendPeriod');
    if (trendEl) trendEl.textContent = `Last ${days} days`;

  } catch (err) {
    console.error('[Dashboard] Failed to load stats:', err);
    errorEl.textContent = 'Failed to load dashboard data: ' + err.message;
    errorEl.classList.remove('hidden');
  }
}

function renderStats(stats) {
  const s = stats;

  // Companies
  document.getElementById('statCompanies').textContent = s.companies.total;
  document.getElementById('statActiveCompanies').textContent = s.companies.active;
  document.getElementById('companyGrowth').textContent = `+${s.companies.new} new`;

  // Users
  document.getElementById('statUsers').textContent = s.users.total;
  document.getElementById('statActiveUsers').textContent = s.users.active;
  document.getElementById('userGrowth').textContent = `+${s.users.new} new`;

  // Meetings
  document.getElementById('statMeetings').textContent = s.meetings.total;
  document.getElementById('statInProgress').textContent = s.meetings.inProgress;
  document.getElementById('statCompletedMeetings').textContent = s.meetings.completed;

  // Live dot - hide if no in-progress meetings
  const liveDot = document.getElementById('liveDot');
  if (liveDot) {
    liveDot.classList.toggle('hidden', s.meetings.inProgress === 0);
  }

  // System
  document.getElementById('statMemUsage').textContent = s.system.memUsage + '%';
  document.getElementById('statCpuLoad').textContent = s.system.cpuLoad || '0.0';
  document.getElementById('statUptime').textContent = formatUptime(s.system.uptime);

  // Memory bar
  const memBar = document.getElementById('memBar');
  if (memBar) {
    const pct = parseFloat(s.system.memUsage) || 0;
    memBar.style.width = Math.min(pct, 100) + '%';
    // Color coding
    if (pct > 80) {
      memBar.className = 'bg-red-500 h-1.5 rounded-full transition-all duration-500';
    } else if (pct > 60) {
      memBar.className = 'bg-amber-500 h-1.5 rounded-full transition-all duration-500';
    } else {
      memBar.className = 'bg-indigo-500 h-1.5 rounded-full transition-all duration-500';
    }
  }
}

function renderRoleBadges(byRole) {
  const container = document.getElementById('roleBadges');
  if (!container) return;

  const roleColors = {
        super_admin: 'bg-indigo-100 text-indigo-700 border-indigo-200',
        admin: 'bg-blue-100 text-blue-700 border-blue-200',
        reviewer: 'bg-emerald-100 text-emerald-700 border-emerald-200',
        instructor: 'bg-amber-100 text-amber-700 border-amber-200',
        solo_instructor: 'bg-violet-100 text-violet-700 border-violet-200'
  };

  const roleLabels = {
    super_admin: 'SA',
    admin: 'Admin',
    reviewer: 'Reviewer',
    instructor: 'Instructor',
    solo_instructor: 'Solo'
  };

  const entries = Object.entries(byRole);
  if (!entries.length) {
        container.innerHTML = '<span class="text-[10px] text-slate-600 font-medium">No users</span>';
    return;
  }

  container.innerHTML = entries.map(([role, count]) => {
        const colors = roleColors[role] || 'bg-slate-100 text-slate-700 border-slate-300';
    const label = roleLabels[role] || role;
    return `<span class="text-[10px] px-1.5 py-0.5 rounded border ${colors}">${label}: ${count}</span>`;
  }).join('');
}

function renderCharts(stats) {
  // Meeting Trends Chart
  const mc = document.getElementById('meetingTrendsChart');
  if (mc) {
    if (meetingTrendsChartInstance) {
      meetingTrendsChartInstance.destroy();
      meetingTrendsChartInstance = null;
    }

    const trendData = stats.trends.meetingTrends || [];
    const labels = trendData.map(t => t.date);
    const values = trendData.map(t => t.count);

    meetingTrendsChartInstance = new Chart(mc, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Meetings',
          data: values,
          backgroundColor: 'rgba(99,102,241,0.3)',
          borderColor: 'rgba(99,102,241,1)',
          borderWidth: 1,
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: {
            ticks: { color: '#64748b', font: { size: 10 } },
            grid: { color: '#e2e8f0' }
          },
          y: {
            beginAtZero: true,
            ticks: { color: '#64748b', font: { size: 10 }, stepSize: 1 },
            grid: { color: '#e2e8f0' }
          }
        }
      }
    });
  }

  // User Signups Chart
  const uc = document.getElementById('userTrendsChart');
  if (uc) {
    if (userTrendsChartInstance) {
      userTrendsChartInstance.destroy();
      userTrendsChartInstance = null;
    }

    const userTrends = stats.trends.userTrends || [];
    const labels = userTrends.map(t => t.date);
    const values = userTrends.map(t => t.count);

    userTrendsChartInstance = new Chart(uc, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'New Users',
          data: values,
          borderColor: 'rgba(52,211,153,1)',
          backgroundColor: 'rgba(52,211,153,0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.3,
          pointBackgroundColor: 'rgba(52,211,153,1)',
          pointRadius: 3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: {
            ticks: { color: '#64748b', font: { size: 10 } },
            grid: { color: '#e2e8f0' }
          },
          y: {
            beginAtZero: true,
            ticks: { color: '#64748b', font: { size: 10 }, stepSize: 1 },
            grid: { color: '#e2e8f0' }
          }
        }
      }
    });
  }
}

function renderRecentUsers(users) {
  const tbody = document.getElementById('recentUsersBody');
  if (!tbody) return;

  if (!users || !users.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="py-6 text-center text-slate-700 font-medium">No users yet</td></tr>';
    return;
  }

  tbody.innerHTML = users.map(u => `
    <tr class="hover:bg-emerald-100 transition-colors">\n      <td class="py-2 px-3">\n        <div class="flex items-center gap-2">\n          <div class="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center text-[8px] font-semibold text-slate-600">
            ${(u.name || 'U').charAt(0).toUpperCase()}
          </div>
          <span class="text-slate-900">${escHtml(u.name || 'Unknown')}</span>
        </div>
      </td>
      <td class="py-2 px-3 text-slate-700">${escHtml(u.role || 'N/A')}</td>
      <td class="py-2 px-3 text-slate-700">${escHtml(u.company || 'N/A')}</td>
      <td class="py-2 px-3">${statusBadge(u.status)}</td>
      <td class="py-2 px-3 text-[10px] text-slate-700">${formatDate(u.created_at)}</td>
    </tr>
  `).join('');
}

function renderRecentMeetings(meetings) {
  const tbody = document.getElementById('recentMeetingsBody');
  if (!tbody) return;

  if (!meetings || !meetings.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="py-6 text-center text-slate-700 font-medium">No meetings yet</td></tr>';
    return;
  }

  tbody.innerHTML = meetings.map(m => `
    <tr class="hover:bg-indigo-100 transition-colors">
      <td class="py-2 px-3 text-slate-900 max-w-[140px] truncate" title="${escHtml(m.title)}">${escHtml(m.title)}</td>
      <td class="py-2 px-3">${statusBadge(m.status)}</td>
      <td class="py-2 px-3 text-slate-700">${escHtml(m.owner || 'N/A')}</td>
      <td class="py-2 px-3 text-[10px] text-slate-700">${formatDateTime(m.start_time)}</td>
    </tr>
  `).join('');
}

// Auto-refresh on page load
document.addEventListener('DOMContentLoaded', () => {
  // Wait a bit for components to load, then fetch data
  setTimeout(refreshDashboard, 500);
});

// Also refresh whenever timeRange changes
document.addEventListener('change', (e) => {
  if (e.target.id === 'timeRange') {
    refreshDashboard();
  }
});


