async function loadDashboard() {
  try {
    const now = new Date();
    document.getElementById('lastUpdated').textContent = `Updated: ${now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;

    // Load all data in parallel
    const [meetingsData, reviewsData, scoresData, usersData] = await Promise.all([
      apiFetch('/api/meetings/list?days=7'),
      apiFetch('/api/reviews/queue?status=pending'),
      apiFetch('/api/scores'),
      apiFetch('/api/users')
    ]);

    const meetings = meetingsData.meetings || [];
    const scores = scoresData.scores || [];
    const users = usersData.users || usersData.data || [];

    // Update KPIs
    const today = new Date().toDateString();
    const todayMeetings = meetings.filter(m => new Date(m.start_time).toDateString() === today).length;
    const weekMeetings = meetings.length;
    const pendingReviews = (reviewsData.reviews || []).length;
    const avgScore = scores.length > 0 ? (scores.reduce((sum, s) => sum + (+s.score || 0), 0) / scores.length).toFixed(1) : '--';
    const completedMeetings = meetings.filter(m => m.status === 'completed').length;
    const completionRate = meetings.length > 0 ? Math.round((completedMeetings / meetings.length) * 100) : 0;

    // Update KPI cards
    const kpis = document.querySelectorAll('h3');
    kpis[0].textContent = todayMeetings || 0;
    kpis[1].textContent = pendingReviews;
    kpis[2].textContent = avgScore;
    kpis[3].textContent = users.length;
    kpis[4].textContent = weekMeetings;
    kpis[5].textContent = completionRate + '%';

    // Recent Activity Table
    const activityTable = document.getElementById('activityTable');
    if (activityTable && meetings.length > 0) {
      const recent = meetings.slice(0, 8);
      activityTable.innerHTML = recent.map(m => {
        const time = new Date(m.start_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        const statusColor = m.status === 'completed' ? 'text-emerald-600' : m.status === 'active' ? 'text-blue-400' : 'text-slate-400';
        return `<tr class="hover:bg-slate-800/30">
          <td class="py-1.5 px-2 text-slate-500">${time}</td>
          <td class="py-1.5 px-2 text-slate-500">${escapeHtml(m.title || 'Untitled')}</td>
          <td class="py-1.5 px-2 text-slate-400">${escapeHtml(m.platform || '-')}</td>
          <td class="py-1.5 px-2 ${statusColor} capitalize">${m.status || 'unknown'}</td>
        </tr>`;
      }).join('');
    }

    // Quick Stats
    const quickStats = document.getElementById('quickStats');
    if (quickStats) {
      const avgDuration = meetings.length > 0 
        ? Math.round(meetings.reduce((sum, m) => {
            if (m.start_time && m.end_time) {
              return sum + (new Date(m.end_time) - new Date(m.start_time)) / 60000;
            }
            return sum;
          }, 0) / meetings.length)
        : 0;
      
      quickStats.innerHTML = `
        <div class="flex justify-between text-[10px]">
          <span class="text-slate-400">Avg Duration:</span>
          <span class="text-slate-400 font-medium">${avgDuration} min</span>
        </div>
        <div class="flex justify-between text-[10px]">
          <span class="text-slate-400">Total Users:</span>
          <span class="text-slate-400 font-medium">${users.length}</span>
        </div>
        <div class="flex justify-between text-[10px]">
          <span class="text-slate-400">Total Scores:</span>
          <span class="text-slate-400 font-medium">${scores.length}</span>
        </div>
        <div class="flex justify-between text-[10px]">
          <span class="text-slate-400">Completion:</span>
          <span class="text-emerald-600 font-medium">${completionRate}%</span>
        </div>
      `;
    }

    // Render all charts
    if (typeof ApexCharts !== 'undefined') {
      renderTrendsChart(meetings);
      renderScoreChart(scores);
      renderStatusChart(meetings);
      renderPlatformChart(meetings);
    }
  } catch (error) {
    console.error('Failed to load dashboard:', error);
  }
}

function renderTrendsChart(meetings) {
  const byDate = {};
  meetings.forEach(m => {
    const d = m.start_time ? new Date(m.start_time).toLocaleDateString('en-US', {month: 'short', day: 'numeric'}) : 'Unknown';
    byDate[d] = (byDate[d] || 0) + 1;
  });
  
  const labels = Object.keys(byDate).slice(-7);
  const data = labels.map(l => byDate[l]);
  
  const chartEl = document.querySelector('#trendsChart');
  if (chartEl && labels.length > 0) {
    const options = {
      series: [{ name: 'Meetings', data: data }],
      chart: {
        type: 'bar',
        height: 160,
        background: 'transparent',
        toolbar: { show: false },
        animations: { enabled: true, easing: 'easeinout', speed: 800 }
      },
      plotOptions: {
        bar: {
          borderRadius: 6,
          columnWidth: '60%'
        }
      },
      colors: ['#8b5cf6'],
      fill: {
        type: 'gradient',
        gradient: {
          shade: 'dark',
          type: 'vertical',
          shadeIntensity: 0.3,
          gradientToColors: ['#8b5cf6'],
          inverseColors: false,
          opacityFrom: 0.9,
          opacityTo: 0.5,
          stops: [0, 100]
        }
      },
      dataLabels: { enabled: false },
      stroke: { show: true, width: 2, colors: ['transparent'] },
      xaxis: {
        categories: labels,
        labels: { style: { colors: '#94a3b8', fontSize: '9px', fontWeight: 500 } },
        axisBorder: { show: false },
        axisTicks: { show: false }
      },
      yaxis: {
        labels: { style: { colors: '#94a3b8', fontSize: '9px', fontWeight: 500 }, formatter: (val) => Math.round(val) }
      },
      grid: { borderColor: 'rgba(51, 65, 85, 0.5)', strokeDashArray: 4, xaxis: { lines: { show: false } } },
      tooltip: { theme: 'dark', style: { fontSize: '10px' } }
    };
    
    new ApexCharts(chartEl, options).render();
  }
}

function renderScoreChart(scores) {
  const chartEl = document.querySelector('#scoreChart');
  if (!chartEl || !scores.length) return;

  const bins = { 'Excellent (4-5)': 0, 'Good (3-4)': 0, 'Needs Work (<3)': 0 };
  scores.forEach(s => {
    const val = +s.score || 0;
    if (val >= 4) bins['Excellent (4-5)']++;
    else if (val >= 3) bins['Good (3-4)']++;
    else bins['Needs Work (<3)']++;
  });

  const options = {
    series: Object.values(bins),
    chart: {
      type: 'donut',
      height: 160,
      background: 'transparent',
      animations: { enabled: true, easing: 'easeinout', speed: 1200 }
    },
    labels: Object.keys(bins),
    colors: ['#22c55e', '#3b82f6', '#f59e0b'],
    fill: { type: 'solid', opacity: 0.85 },
    stroke: { show: true, width: 2, colors: ['#22c55e', '#3b82f6', '#f59e0b'] },
    dataLabels: {
      enabled: true,
      style: { fontSize: '10px', fontWeight: 600, colors: ['#fff'] },
      dropShadow: { enabled: false }
    },
    plotOptions: {
      pie: {
        donut: {
          size: '65%',
          labels: {
            show: true,
            name: { show: true, fontSize: '9px', fontWeight: 500, color: '#94a3b8' },
            value: { show: true, fontSize: '14px', fontWeight: 700, color: '#e2e8f0' }
          }
        }
      }
    },
    legend: {
      position: 'bottom',
      fontSize: '9px',
      fontWeight: 500,
      labels: { colors: '#e2e8f0' },
      markers: { width: 8, height: 8, radius: 4, offsetX: -3 },
      itemMargin: { horizontal: 8, vertical: 4 }
    },
    tooltip: { theme: 'dark', style: { fontSize: '10px' } }
  };
  
  new ApexCharts(chartEl, options).render();
}

function renderStatusChart(meetings) {
  const chartEl = document.querySelector('#statusChart');
  if (!chartEl || !meetings.length) return;

  const statuses = {};
  meetings.forEach(m => {
    const s = m.status || 'unknown';
    statuses[s] = (statuses[s] || 0) + 1;
  });

  const statusColors = {
    'completed': '#22c55e',
    'active': '#3b82f6',
    'joining': '#8b5cf6',
    'scheduled': '#f59e0b'
  };

  const labels = Object.keys(statuses);
  const data = Object.values(statuses);

  const options = {
    series: data,
    chart: {
      type: 'pie',
      height: 128,
      background: 'transparent',
      animations: { enabled: true, easing: 'easeinout', speed: 1200 }
    },
    labels: labels,
    colors: labels.map(l => statusColors[l] || '#94a3b8'),
    fill: { type: 'solid', opacity: 0.85 },
    stroke: { show: true, width: 2, colors: labels.map(l => statusColors[l] || '#94a3b8') },
    dataLabels: {
      enabled: true,
      style: { fontSize: '9px', fontWeight: 600, colors: ['#fff'] },
      dropShadow: { enabled: false }
    },
    plotOptions: {
      pie: {
        expandOnClick: true,
        dataLabels: { offset: -15 }
      }
    },
    legend: {
      position: 'bottom',
      fontSize: '9px',
      fontWeight: 500,
      labels: { colors: '#e2e8f0' },
      markers: { width: 8, height: 8, radius: 4, offsetX: -3 },
      itemMargin: { horizontal: 6, vertical: 3 }
    },
    tooltip: { theme: 'dark', style: { fontSize: '10px' } }
  };
  
  new ApexCharts(chartEl, options).render();
}

function renderPlatformChart(meetings) {
  const chartEl = document.querySelector('#platformChart');
  if (!chartEl || !meetings.length) return;

  const platforms = {};
  meetings.forEach(m => {
    const p = m.platform || 'Unknown';
    platforms[p] = (platforms[p] || 0) + 1;
  });

  const labels = Object.keys(platforms);
  const data = Object.values(platforms);

  const options = {
    series: [{ name: 'Meetings', data: data }],
    chart: {
      type: 'bar',
      height: 128,
      background: 'transparent',
      toolbar: { show: false },
      animations: { enabled: true, easing: 'easeinout', speed: 800 }
    },
    plotOptions: {
      bar: {
        horizontal: true,
        borderRadius: 6,
        columnWidth: '70%'
      }
    },
    colors: ['#3b82f6'],
    fill: {
      type: 'gradient',
      gradient: {
        shade: 'dark',
        type: 'horizontal',
        shadeIntensity: 0.3,
        gradientToColors: ['#8b5cf6'],
        inverseColors: false,
        opacityFrom: 0.9,
        opacityTo: 0.6,
        stops: [0, 100]
      }
    },
    dataLabels: { enabled: false },
    stroke: { show: true, width: 2, colors: ['transparent'] },
    xaxis: {
      categories: labels,
      labels: { 
        style: { colors: '#e2e8f0', fontSize: '9px', fontWeight: 500 },
        formatter: (val) => Math.round(val)
      },
      axisBorder: { show: false },
      axisTicks: { show: false }
    },
    yaxis: {
      labels: { style: { colors: '#e2e8f0', fontSize: '9px', fontWeight: 500 } }
    },
    grid: {
      borderColor: 'rgba(51, 65, 85, 0.5)',
      strokeDashArray: 4,
      yaxis: { lines: { show: false } }
    },
    tooltip: { theme: 'dark', style: { fontSize: '10px' } }
  };
  
  new ApexCharts(chartEl, options).render();
}

function escapeHtml(s) {
  if (!s) return '';
  const div = document.createElement('div');
  div.textContent = String(s);
  return div.innerHTML;
}

// Initialize dashboard - dependencies should be loaded by now
// common-ui.js (apiFetch) and apexcharts are loaded before this script
setTimeout(() => {
  if (typeof apiFetch === 'function') {
    loadDashboard();
  } else {
    console.error('apiFetch not available - common-ui.js may not have loaded');
  }
}, 100);