/**
 * public/js/admin/index.js
 */

let dashboardData = null;

(async () => {
  await loadDashboardData();
  renderDashboard();
})();

async function loadDashboardData() {
  try {
    // Add cache-busting parameter to ensure fresh data
    const timestamp = Date.now();
    const data = await apiFetch(`/api/admin/dashboard/overview?_t=${timestamp}`);
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
    renderStatusTable(dashboardData.statusDistribution);
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
    xaxis: { categories: trends.dates || [], labels: { style: { colors: '#0e7490', fontSize: '10px', fontWeight: 600 } } },
    yaxis: { labels: { style: { colors: '#0e7490', fontSize: '10px', fontWeight: 600 } } },
    colors: ['#0891b2'],
    stroke: { curve: 'smooth', width: 3 },
    fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.5, opacityTo: 0.1 } },
    dataLabels: { enabled: false }
  });
  chart.render();
}

function renderScoreChart(scores) {
  // Simplify labels to show only score ranges
  const simplifiedLabels = (scores.labels || []).map(label => {
    if (label.includes('Excellent')) return '80-100';
    if (label.includes('Good')) return '60-79';
    if (label.includes('Average')) return '40-59';
    if (label.includes('Needs')) return '<40';
    return label;
  });

  const chart = new ApexCharts(document.querySelector('#scoreChart'), {
    series: [{
      name: 'Sessions',
      data: scores.data || []
    }],
    chart: {
      type: 'bar',
      height: 200,
      toolbar: { show: false },
      fontFamily: 'inherit',
      background: 'transparent',
      spacing: { top: 10, right: 10, bottom: 10, left: 10 }
    },
    plotOptions: {
      bar: {
        borderRadius: 6,
        columnWidth: '70%',
        distributed: true,
        dataLabels: {
          position: 'top'
        }
      }
    },
    colors: ['#10b981', '#eab308', '#f59e0b', '#ef4444'],
    xaxis: {
      categories: simplifiedLabels,
      labels: {
        show: true,
        style: {
          colors: '#7c2d12',
          fontSize: '11px',
          fontWeight: 700
        }
      },
      axisBorder: {
        show: false
      },
      axisTicks: {
        show: false
      }
    },
    yaxis: {
      labels: {
        style: {
          colors: '#9a3412',
          fontSize: '10px',
          fontWeight: 600
        }
      }
    },
    grid: {
      borderColor: '#fed7aa',
      strokeDashArray: 3,
      xaxis: {
        lines: {
          show: false
        }
      },
      yaxis: {
        lines: {
          show: true
        }
      },
      padding: {
        bottom: 0
      }
    },
    legend: {
      show: false
    },
    dataLabels: {
      enabled: true,
      style: {
        colors: ['#ffffff'],
        fontSize: '12px',
        fontWeight: 800
      },
      textAnchor: 'middle',
      offsetX: 0,
      offsetY: 0,
      formatter: function(val) {
        return val > 0 ? val : '';
      }
    },
    tooltip: {
      theme: 'light',
      style: {
        fontSize: '12px'
      },
      y: {
        formatter: function(val) {
          return val + ' sessions';
        }
      }
    }
  });
  chart.render();
}

function renderStatusTable(status) {
  const tbody = document.getElementById('statusTable');
  if (!tbody) return;

  if (!status || !status.labels || !status.data) {
    tbody.innerHTML = '<tr><td colspan="3" class="py-2 text-center text-emerald-800 font-medium">No data available</td></tr>';
    return;
  }

  const total = status.data.reduce((sum, count) => sum + count, 0);
  
  tbody.innerHTML = status.labels.map((label, index) => {
    const count = status.data[index] || 0;
    const percentage = total > 0 ? ((count / total) * 100).toFixed(1) : 0;
    const statusClass = getStatusClass(label);
    
    return `
      <tr class="border-b border-emerald-300 hover:bg-emerald-100 transition-colors">
        <td class="py-2 px-2 text-[11px] font-bold text-emerald-950">
          <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${statusClass}">${escapeHtml(label)}</span>
        </td>
        <td class="py-2 px-2 text-[11px] font-bold text-emerald-900 text-right">${count}</td>
        <td class="py-2 px-2 text-[11px] font-semibold text-emerald-700 text-right">${percentage}%</td>
      </tr>
    `;
  }).join('');
}

function renderPlatformChart(platform) {
  const chart = new ApexCharts(document.querySelector('#platformChart'), {
    series: [{
      name: 'Meetings',
      data: platform.data || []
    }],
    chart: {
      type: 'bar',
      height: 256,
      toolbar: { show: false },
      fontFamily: 'inherit',
      background: 'transparent'
    },
    plotOptions: {
      bar: {
        borderRadius: 6,
        columnWidth: '60%',
        distributed: true
      }
    },
    colors: ['#8b5cf6', '#6366f1', '#3b82f6', '#06b6d4'],
    xaxis: {
      categories: platform.labels || [],
      labels: {
        style: {
          colors: '#4c1d95',
          fontSize: '10px',
          fontWeight: 700
        },
        rotate: -30,
        rotateAlways: true,
        hideOverlappingLabels: true
      },
      axisBorder: {
        show: true,
        color: '#a78bfa',
        height: 2
      },
      axisTicks: {
        show: true,
        color: '#a78bfa',
        height: 4
      }
    },
    yaxis: {
      labels: {
        style: {
          colors: '#5b21b6',
          fontSize: '10px',
          fontWeight: 600
        }
      }
    },
    grid: {
      borderColor: '#ddd6fe',
      strokeDashArray: 3,
      xaxis: {
        lines: {
          show: false
        }
      },
      yaxis: {
        lines: {
          show: true
        }
      }
    },
    legend: {
      show: false
    },
    dataLabels: {
      enabled: true,
      style: {
        colors: ['#ffffff'],
        fontSize: '11px',
        fontWeight: 700
      },
      textAnchor: 'middle',
      offsetX: 0,
      offsetY: -8,
      formatter: function(val) {
        return val > 0 ? val : '';
      }
    },
    tooltip: {
      theme: 'light',
      style: {
        fontSize: '12px'
      },
      y: {
        formatter: function(val) {
          return val + ' meetings';
        }
      }
    }
  });
  chart.render();
}

function renderActivityTable(activities) {
  const tbody = document.getElementById('activityTable');
  if (!activities || activities.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="py-3 text-center text-slate-700 font-medium">No recent activity</td></tr>';
    return;
  }

  tbody.innerHTML = activities.map(a => `
    <tr class="border-b border-slate-300 hover:bg-slate-200 transition-colors">
      <td class="py-2 px-2 text-[11px] font-semibold text-slate-800">${formatDate(a.time)}</td>
      <td class="py-2 px-2 text-[11px] font-bold text-slate-900">${escapeHtml(a.meeting)}</td>
      <td class="py-2 px-2 text-[11px] font-semibold text-slate-700">${a.platform}</td>
      <td class="py-2 px-2"><span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${getStatusClass(a.status)}">${a.status}</span></td>
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
    <div class="flex items-center justify-between py-2 border-b border-amber-200 last:border-0">
      <span class="text-[11px] font-semibold text-amber-900">${stat.label}</span>
      <span class="text-[11px] font-bold text-amber-950">${stat.value}</span>
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