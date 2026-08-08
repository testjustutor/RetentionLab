let allUsers = [];
let allInstructors = [];
let allMeetings = [];
let performanceData = [];
let charts = {};
let instructorDropdown = null;
let meetingDropdown = null;

(async () => {
  // Set default dates (last 30 days)
  setDefaultDates();
  
  // Initialize charts first
  initializeCharts();
  
  // Load filters
  await loadInstructors();
  
  // Load initial data
  await getPerformanceData();
})();

function setDefaultDates() {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  
  document.getElementById('toDate').value = now.toISOString().split('T')[0];
  document.getElementById('fromDate').value = thirtyDaysAgo.toISOString().split('T')[0];
}

async function loadInstructors() {
  try {
    const data = await apiFetch('/api/admin/scores/evaluation/instructors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    allInstructors = data.instructors || [];
    
    const instructorData = allInstructors.map(i => ({ id: i.id, name: (i.first_name || '') + ' ' + (i.last_name || '') + ' (' + i.email + ')' }));
    instructorDropdown = createDarkSearchableSelect({
      containerId: 'instructorFilterContainer',
      placeholder: 'All Instructors',
      dataSource: instructorData,
      displayField: 'name',
      valueField: 'id',
      onSelect: (value) => {
        if (value) {
          loadMeetings(value);
        } else {
          meetingDropdown = createDarkSearchableSelect({
            containerId: 'meetingFilterContainer',
            placeholder: 'All Meetings',
            dataSource: [],
            displayField: 'name',
            valueField: 'id',
            onSelect: () => {}
          });
        }
      }
    });

    // Initialize meeting dropdown (empty initially)
    meetingDropdown = createDarkSearchableSelect({
      containerId: 'meetingFilterContainer',
      placeholder: 'All Meetings',
      dataSource: [],
      displayField: 'name',
      valueField: 'id',
      onSelect: () => {}
    });
  } catch(e) {
    console.error('Failed to load instructors:', e);
  }
}

async function loadMeetings(instructorId) {
  if (!instructorId) {
    meetingDropdown = createDarkSearchableSelect({
      containerId: 'meetingFilterContainer',
      placeholder: 'All Meetings',
      dataSource: [],
      displayField: 'name',
      valueField: 'id',
      onSelect: () => {}
    });
    return;
  }

  // Loading state
  meetingDropdown = createDarkSearchableSelect({
    containerId: 'meetingFilterContainer',
    placeholder: 'Loading meetings...',
    dataSource: [],
    displayField: 'name',
    valueField: 'id',
    onSelect: () => {}
  });

  try {
    const data = await apiFetch(`/api/scores/sessions/${instructorId}`);
    allMeetings = data.sessions || [];
    
    const meetingData = allMeetings.length > 0
      ? allMeetings.map(m => ({ id: m.session_id, name: m.meeting_title + ' - ' + (m.start_time ? formatDate(m.start_time) : 'No date') }))
      : [{ id: '', name: 'No meetings found' }];

    meetingDropdown = createDarkSearchableSelect({
      containerId: 'meetingFilterContainer',
      placeholder: 'All Meetings',
      dataSource: meetingData,
      displayField: 'name',
      valueField: 'id',
      onSelect: () => {}
    });
  } catch(e) {
    console.error('Failed to load meetings:', e);
    meetingDropdown = createDarkSearchableSelect({
      containerId: 'meetingFilterContainer',
      placeholder: 'Failed to load',
      dataSource: [],
      displayField: 'name',
      valueField: 'id',
      onSelect: () => {}
    });
  }
}

async function getPerformanceData() {
  const fromDate = document.getElementById('fromDate').value;
  const toDate = document.getElementById('toDate').value;
  const instructorId = instructorDropdown ? instructorDropdown.getValue() : null;
  const sessionId = meetingDropdown ? meetingDropdown.getValue() : null;

  if (!fromDate || !toDate) {
    showToast('Please select both from and to dates', true);
    return;
  }

  try {
    // Build request body
    const requestBody = {
      from_date: fromDate,
      to_date: toDate
    };
    if (instructorId) requestBody.instructor_id = instructorId;
    if (sessionId) requestBody.session_id = sessionId;

    // Fetch filtered scores using POST
    const data = await apiFetch('/api/admin/scores/filtered', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });
    performanceData = data.categories || [];
    
    // Convert categories to flat array for stats
    let flatScores = [];
    performanceData.forEach(cat => {
      Object.values(cat.indicators || {}).forEach(ind => {
        ind.scores.forEach(score => {
          flatScores.push(score);
        });
      });
    });
    
    // Update stats and charts
    updateStats(flatScores);
    updateCharts(flatScores);
    renderLeaderboards(flatScores);
    
    showToast('Data loaded successfully');
  } catch(e) {
    console.error('Failed to load performance data:', e);
    showToast('Failed to load data: ' + e.message, true);
  }
}
function updateStats(scores) {
  let totalScores = 0;
  let totalScoreValue = 0;
  let highestScore = 0;
  const uniqueEvaluations = new Set();

  scores.forEach(score => {
    totalScores++;
    totalScoreValue += (+score.score || 0);
    if ((+score.score || 0) > highestScore) highestScore = +score.score || 0;
    uniqueEvaluations.add(`${score.meeting_id}-${score.session_id}-${score.indicator_id}`);
  });

  const avgScore = totalScores > 0 ? (totalScoreValue / totalScores).toFixed(1) : '0.0';
  
  document.getElementById('totalScores').textContent = totalScores;
  document.getElementById('avgScore').textContent = avgScore;
  document.getElementById('highestScore').textContent = highestScore.toFixed(1);
  document.getElementById('evalCount').textContent = uniqueEvaluations.size;
}

function initializeCharts() {
  // Common chart options with dark theme
  const commonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: { 
          color: '#e2e8f0',
          font: { size: 11 }
        }
      }
    },
    scales: {
      x: {
        ticks: { color: '#94a3b8', font: { size: 10 } },
        grid: { color: '#334155' }
      },
      y: {
        min: 0,
        max: 10,
        ticks: { color: '#94a3b8', font: { size: 10 } },
        grid: { color: '#334155' }
      }
    }
  };

  // Distribution Chart (Doughnut) — 0-10 scale
  charts.distribution = new Chart(document.getElementById('distributionChart'), {
    type: 'doughnut',
    data: {
      labels: ['Excellent (8-10)', 'Good (6-8)', 'Average (4-6)', 'Needs Improvement (<4)'],
      datasets: [{
        data: [0, 0, 0, 0],
        backgroundColor: [
          'rgba(16, 185, 129, 0.8)',
          'rgba(59, 130, 246, 0.8)',
          'rgba(245, 158, 11, 0.8)',
          'rgba(239, 68, 68, 0.8)'
        ],
        borderColor: '#1e293b',
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#e2e8f0', font: { size: 10 }, padding: 10 }
        }
      }
    }
  });

  // Category Performance Chart (Radar) — 0-10 scale
  charts.category = new Chart(document.getElementById('categoryChart'), {
    type: 'radar',
    data: {
      labels: [],
      datasets: [{
        label: 'Average Score',
        data: [],
        backgroundColor: 'rgba(139, 92, 246, 0.2)',
        borderColor: 'rgba(139, 92, 246, 1)',
        borderWidth: 2,
        pointBackgroundColor: 'rgba(139, 92, 246, 1)',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: 'rgba(139, 92, 246, 1)'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        r: {
          angleLines: { color: '#334155' },
          grid: { color: '#334155' },
          pointLabels: { color: '#e2e8f0', font: { size: 10 } },
          ticks: { 
            color: '#94a3b8',
            backdropColor: 'transparent',
            font: { size: 9 }
          },
          suggestedMin: 0,
          suggestedMax: 10
        }
      }
    }
  });

  // Trends Chart (Line)
  charts.trends = new Chart(document.getElementById('trendsChart'), {
    type: 'line',
    data: {
      labels: [],
      datasets: [{
        label: 'Average Score',
        data: [],
        borderColor: 'rgba(34, 197, 94, 1)',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        borderWidth: 2,
        tension: 0.4,
        fill: true,
        pointRadius: 3,
        pointHoverRadius: 5,
        pointBackgroundColor: 'rgba(34, 197, 94, 1)'
      }]
    },
    options: {
      ...commonOptions,
      plugins: {
        ...commonOptions.plugins,
        tooltip: {
          mode: 'index',
          intersect: false
        }
      },
      elements: {
        line: {
          tension: 0.4
        }
      }
    }
  });
}

function updateCharts(scores) {
  // Update Distribution Chart — 0-10 scale
  const distribution = [0, 0, 0, 0]; // Excellent, Good, Average, Needs Improvement
  scores.forEach(score => {
    const scoreValue = +score.score || 0;
    if (scoreValue >= 8) distribution[0]++;
    else if (scoreValue >= 6) distribution[1]++;
    else if (scoreValue >= 4) distribution[2]++;
    else distribution[3]++;
  });
  charts.distribution.data.datasets[0].data = distribution;
  charts.distribution.update();

  // Update Category Performance Chart
  const categoryData = processPerformanceData(scores).categories;
  charts.category.data.labels = categoryData.map(c => c.name);
  charts.category.data.datasets[0].data = categoryData.map(c => c.avgScore);
  charts.category.update();

  // Update Trends Chart
  const trends = processPerformanceData(scores).trends;
  charts.trends.data.labels = trends.dates;
  charts.trends.data.datasets[0].data = trends.scores;
  charts.trends.options.scales.y.min = 0;
  charts.trends.options.scales.y.max = 10;
  charts.trends.update();
}

function processPerformanceData(scores) {
  // Group scores by category
  const categoryScores = {};
  const dailyAverages = {};
  
  scores.forEach(score => {
    const scoreValue = +score.score || 0;
    const categoryName = score.category_name || 'Uncategorized';
    const date = new Date(score.created_at).toISOString().split('T')[0];

    // Category data
    if (!categoryScores[categoryName]) categoryScores[categoryName] = [];
    categoryScores[categoryName].push(scoreValue);

    // Daily averages
    if (!dailyAverages[date]) dailyAverages[date] = [];
    dailyAverages[date].push(scoreValue);
  });

  // Calculate category averages
  const categories = Object.entries(categoryScores).map(([name, scores]) => ({
    name,
    avgScore: scores.reduce((sum, s) => sum + s, 0) / scores.length
  }));

  // Calculate historical trends
  const trendDates = Object.keys(dailyAverages).sort();
  const trendScores = trendDates.map(date => {
    const dayScores = dailyAverages[date];
    return dayScores.reduce((sum, s) => sum + s, 0) / dayScores.length;
  });

  return {
    categories,
    trends: {
      dates: trendDates,
      scores: trendScores
    }
  };
}

function renderLeaderboards(scores) {
  // Group by user for leaderboards
  const userScores = {};
  scores.forEach(score => {
    const userId = score.user_id || score.reviewer_id;
    if (!userScores[userId]) userScores[userId] = [];
    userScores[userId].push(+score.score || 0);
  });

  // Calculate user averages
  const team = Object.entries(userScores).map(([userId, userScores]) => {
    const avgScore = userScores.reduce((sum, s) => sum + s, 0) / userScores.length;
    return { userId, avgScore };
  });
  team.sort((a, b) => b.avgScore - a.avgScore);

  // Top Performers
  const topPerformersHtml = team.slice(0, 5).map((user, index) => {
    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`;
    const scoreColor = getScoreColor(user.avgScore);
    
    return `<div class="flex items-center justify-between p-2.5 rounded-md bg-slate-800/30 hover:bg-slate-800/50 transition-colors">
      <div class="flex items-center gap-2">
        <span class="text-lg">${medal}</span>
        <div>
          <p class="text-xs font-semibold ">User ${user.userId}</p>
          <p class="text-[10px] text-slate-500">Top Performer</p>
        </div>
      </div>
      <span class="text-base font-bold ${scoreColor}">${user.avgScore.toFixed(1)}</span>
    </div>`;
  }).join('');
  
  document.getElementById('topPerformers').innerHTML = topPerformersHtml || '<p class="text-slate-500 text-center py-8">No data available</p>';

  // Category Rankings
  const categoryData = processPerformanceData(scores).categories;
  const categoryRankingsHtml = categoryData.slice(0, 5).map((cat, index) => {
    const scoreColor = getScoreColor(cat.avgScore);
    
    return `<div class="flex items-center justify-between p-2.5 rounded-md bg-slate-800/30 hover:bg-slate-800/50 transition-colors">
      <div class="flex items-center gap-2">
        <span class="text-lg">${index === 0 ? '🏆' : '📊'}</span>
        <div>
          <p class="text-xs font-semibold ">${escapeHtml(cat.name)}</p>
          <p class="text-[10px] text-slate-500">Category</p>
        </div>
      </div>
      <span class="text-base font-bold ${scoreColor}">${cat.avgScore.toFixed(1)}</span>
    </div>`;
  }).join('');
  
  document.getElementById('categoryRankings').innerHTML = categoryRankingsHtml || '<p class="text-slate-500 text-center py-8">No data available</p>';
}

function getScoreColor(score) {
  if (score >= 8.0) return 'text-emerald-600';
  if (score >= 6.0) return 'text-blue-400';
  if (score >= 4.0) return 'text-amber-800';
  return 'text-red-400';
}

function escapeHtml(s) {
  if (!s) return '';
  const div = document.createElement('div');
  div.textContent = String(s);
  return div.innerHTML;
}
