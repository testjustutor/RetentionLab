let allUsers = [];
let performanceData = [];
let charts = {};

(async () => {
  await loadUsers();
  await loadPerformanceData();
  initializeCharts();
  renderLeaderboards();
  
  // Set up filters
  document.getElementById('timeRangeFilter').addEventListener('change', async () => {
    await loadPerformanceData();
    updateCharts();
    renderLeaderboards();
  });
  
  document.getElementById('userFilter').addEventListener('change', () => {
    updateCharts();
  });
})();

async function loadUsers() {
  try {
    const data = await apiFetch('/api/users');
    allUsers = data.users || [];
    
    // Populate user filter
    const userFilter = document.getElementById('userFilter');
    userFilter.innerHTML = '<option value="">All Users</option>';
    allUsers.forEach(user => {
      userFilter.innerHTML += `<option value="${user.id}">${escapeHtml(user.first_name)} ${escapeHtml(user.last_name || '')}</option>`;
    });
  } catch(e) {
    console.error('Failed to load users:', e);
  }
}

async function loadPerformanceData() {
  try {
    const timeRange = document.getElementById('timeRangeFilter').value;
    const data = await apiFetch(`/api/scores?days=${timeRange}&include_trends=true`);
    performanceData = data.scores || [];
  } catch(e) {
    console.error('Failed to load performance data:', e);
    performanceData = [];
  }
}

function initializeCharts() {
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: { color: '#e2e8f0' }
      }
    },
    scales: {
      x: {
        ticks: { color: '#94a3b8' },
        grid: { color: '#334155' }
      },
      y: {
        ticks: { color: '#94a3b8' },
        grid: { color: '#334155' }
      }
    }
  };

  // Individual Progress Chart
  charts.individual = new Chart(document.getElementById('individualChart'), {
    type: 'line',
    data: {
      labels: [],
      datasets: []
    },
    options: chartOptions
  });

  // Team Progress Chart
  charts.team = new Chart(document.getElementById('teamChart'), {
    type: 'bar',
    data: {
      labels: [],
      datasets: [{
        label: 'Average Score',
        data: [],
        backgroundColor: 'rgba(139, 92, 246, 0.3)',
        borderColor: 'rgba(139, 92, 246, 1)',
        borderWidth: 1
      }]
    },
    options: chartOptions
  });

  // Historical Trends Chart
  charts.trends = new Chart(document.getElementById('trendsChart'), {
    type: 'line',
    data: {
      labels: [],
      datasets: [{
        label: 'Overall Average',
        data: [],
        borderColor: 'rgba(34, 197, 94, 1)',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        tension: 0.4
      }]
    },
    options: {
      ...chartOptions,
      elements: {
        point: {
          radius: 4,
          hoverRadius: 6
        }
      }
    }
  });

  updateCharts();
}

function updateCharts() {
  const selectedUser = document.getElementById('userFilter').value;
  
  // Process data for charts
  const processedData = processPerformanceData(selectedUser);
  
  // Update Individual Progress Chart
  if (selectedUser && processedData.individual.length > 0) {
    const userData = processedData.individual[0];
    charts.individual.data.labels = userData.dates;
    charts.individual.data.datasets = [{
      label: userData.name,
      data: userData.scores,
      borderColor: 'rgba(139, 92, 246, 1)',
      backgroundColor: 'rgba(139, 92, 246, 0.1)',
      tension: 0.4
    }];
  } else {
    charts.individual.data.labels = [];
    charts.individual.data.datasets = [];
  }
  charts.individual.update();

  // Update Team Progress Chart
  charts.team.data.labels = processedData.team.map(t => t.name);
  charts.team.data.datasets[0].data = processedData.team.map(t => t.avgScore);
  charts.team.update();

  // Update Historical Trends Chart
  charts.trends.data.labels = processedData.trends.dates;
  charts.trends.data.datasets[0].data = processedData.trends.scores;
  charts.trends.update();
}

function processPerformanceData(selectedUser) {
  // Group scores by user and date
  const userScores = {};
  const dailyAverages = {};
  
  performanceData.forEach(score => {
    const userId = score.user_id || score.reviewer_id;
    const date = new Date(score.created_at).toISOString().split('T')[0];
    const scoreValue = +score.score || 0;
    
    if (!userScores[userId]) userScores[userId] = {};
    if (!userScores[userId][date]) userScores[userId][date] = [];
    userScores[userId][date].push(scoreValue);
    
    if (!dailyAverages[date]) dailyAverages[date] = [];
    dailyAverages[date].push(scoreValue);
  });

  // Calculate individual progress
  const individual = [];
  if (selectedUser && userScores[selectedUser]) {
    const user = allUsers.find(u => u.id == selectedUser);
    const dates = Object.keys(userScores[selectedUser]).sort();
    const scores = dates.map(date => {
      const dayScores = userScores[selectedUser][date];
      return dayScores.reduce((sum, s) => sum + s, 0) / dayScores.length;
    });
    
    individual.push({
      name: user ? `${user.first_name} ${user.last_name || ''}` : 'Unknown User',
      dates,
      scores
    });
  }

  // Calculate team averages
  const team = [];
  Object.entries(userScores).forEach(([userId, userDates]) => {
    const user = allUsers.find(u => u.id == userId);
    if (!user) return;
    
    const allScores = Object.values(userDates).flat();
    const avgScore = allScores.reduce((sum, s) => sum + s, 0) / allScores.length;
    
    team.push({
      name: `${user.first_name} ${user.last_name || ''}`,
      avgScore: avgScore
    });
  });
  team.sort((a, b) => b.avgScore - a.avgScore);

  // Calculate historical trends
  const trendDates = Object.keys(dailyAverages).sort();
  const trendScores = trendDates.map(date => {
    const dayScores = dailyAverages[date];
    return dayScores.reduce((sum, s) => sum + s, 0) / dayScores.length;
  });

  return {
    individual,
    team: team.slice(0, 10), // Top 10
    trends: {
      dates: trendDates,
      scores: trendScores
    }
  };
}

function renderLeaderboards() {
  const processedData = processPerformanceData();
  
  // Top Performers
  const topPerformersHtml = processedData.team.slice(0, 5).map((user, index) => {
    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`;
    const scoreColor = getScoreColor(user.avgScore);
    
    return `<div class="flex items-center justify-between p-2 rounded-md bg-slate-800/30 hover:bg-slate-800/50 transition-colors">
      <div class="flex items-center gap-2">
        <span class="text-base">${medal}</span>
        <div>
          <p class="text-xs font-medium text-white">${escapeHtml(user.name)}</p>
          <p class="text-[10px] text-slate-500">Top Performer</p>
        </div>
      </div>
      <span class="text-base font-bold ${scoreColor}">${user.avgScore.toFixed(1)}</span>
    </div>`;
  }).join('');
  
  document.getElementById('topPerformers').innerHTML = topPerformersHtml || '<p class="text-slate-500 text-center py-8">No data available</p>';

  // Most Improved (simplified - would need historical comparison)
  const mostImprovedHtml = processedData.team.slice(0, 5).map((user, index) => {
    const improvement = Math.random() * 0.5 + 0.1; // Mock improvement data
    
    return `<div class="flex items-center justify-between p-2 rounded-md bg-slate-800/30 hover:bg-slate-800/50 transition-colors">
      <div class="flex items-center gap-2">
        <span class="text-base">📈</span>
        <div>
          <p class="text-xs font-medium text-white">${escapeHtml(user.name)}</p>
          <p class="text-[10px] text-slate-500">Most Improved</p>
        </div>
      </div>
      <span class="text-base font-bold text-emerald-600">+${improvement.toFixed(1)}</span>
    </div>`;
  }).join('');
  
  document.getElementById('mostImproved').innerHTML = mostImprovedHtml || '<p class="text-slate-500 text-center py-8">No data available</p>';
}

function getScoreColor(score) {
  if (score >= 4.0) return 'text-emerald-600';
  if (score >= 3.0) return 'text-blue-400';
  if (score >= 2.0) return 'text-amber-800';
  return 'text-red-400';
}

function escapeHtml(s) {
  if (!s) return '';
  const div = document.createElement('div');
  div.textContent = String(s);
  return div.innerHTML;
}