/**
 * public/js/admin/evaluation/performance.js
 */

let allUsers = [];
let allInstructors = [];
let allMeetings = [];
let performanceData = [];
let instructorDropdown = null;
let meetingDropdown = null;

(async () => {
  // Set default dates (last 30 days)
  setDefaultDates();

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

function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
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
    instructorDropdown = createSearchableSelect({
      containerId: 'instructorFilterContainer',
      placeholder: 'All Instructors',
      dataSource: instructorData,
      displayField: 'name',
      valueField: 'id',
      onSelect: (value) => {
        if (value) {
          loadMeetings(value);
        } else {
          initMeetingsDropdown('All Meetings', []);
        }
      }
    });

    // Initialize meeting dropdown (empty initially)
    initMeetingsDropdown('All Meetings', []);
  } catch(e) {
    console.error('Failed to load instructors:', e);
  }
}

function initMeetingsDropdown(placeholder, dataSource) {
  meetingDropdown = createSearchableSelect({
    containerId: 'meetingFilterContainer',
    placeholder,
    dataSource,
    displayField: 'name',
    valueField: 'id',
    onSelect: () => {}
  });
}

async function loadMeetings(instructorId) {
  if (!instructorId) {
    initMeetingsDropdown('All Meetings', []);
    return;
  }

  // Loading state
  initMeetingsDropdown('Loading meetings...', []);

  try {
    const data = await apiFetch(`/api/admin/scores/sessions/${instructorId}`);
    allMeetings = data.sessions || [];

    const meetingData = allMeetings.length > 0
      ? allMeetings.map(m => ({ id: m.session_id, name: m.meeting_title + ' - ' + (m.start_time ? formatDate(m.start_time) : 'No date') }))
      : [{ id: '', name: 'No meetings found' }];

    initMeetingsDropdown('All Meetings', meetingData);
  } catch(e) {
    console.error('Failed to load meetings:', e);
    initMeetingsDropdown('Failed to load', []);
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
    
    // Update stats and tables
    updateStats(flatScores);
    renderTables(flatScores);
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

function renderTables(scores) {
  renderScoreDistribution(scores);
  renderCategoryPerformance(scores);
  renderTrends(scores);
}

function renderScoreDistribution(scores) {
  const tbody = document.getElementById('distributionTable');
  if (!tbody) return;

  const labels = ['Excellent (8-10)', 'Good (6-8)', 'Average (4-6)', 'Needs Improvement (<4)'];
  const counts = [0, 0, 0, 0];
  scores.forEach(score => {
    const value = +score.score || 0;
    if (value >= 8) counts[0]++;
    else if (value >= 6) counts[1]++;
    else if (value >= 4) counts[2]++;
    else counts[3]++;
  });

  const total = counts.reduce((sum, c) => sum + c, 0);
  if (total === 0) {
    tbody.innerHTML = '<tr><td colspan="3" class="py-2 text-center text-emerald-800 font-medium">No data available</td></tr>';
    return;
  }

  tbody.innerHTML = labels.map((label, i) => {
    const pct = ((counts[i] / total) * 100).toFixed(1);
    return `
      <tr class="border-b border-emerald-200 hover:bg-emerald-100/70 transition-colors">
        <td class="py-2 px-2 text-[11px] font-semibold text-emerald-950">${escapeHtml(label)}</td>
        <td class="py-2 px-2 text-[11px] font-bold text-emerald-900 text-right">${counts[i]}</td>
        <td class="py-2 px-2 text-[11px] font-semibold text-emerald-800 text-right">${pct}%</td>
      </tr>`;
  }).join('');
}

function renderCategoryPerformance(scores) {
  const tbody = document.getElementById('categoryTable');
  if (!tbody) return;

  const categoryData = processPerformanceData(scores).categories.slice().sort((a, b) => b.avgScore - a.avgScore);
  if (!categoryData.length) {
    tbody.innerHTML = '<tr><td colspan="3" class="py-2 text-center text-blue-800 font-medium">No data available</td></tr>';
    return;
  }

  tbody.innerHTML = categoryData.map(cat => `
    <tr class="border-b border-blue-200 hover:bg-blue-100/70 transition-colors">
      <td class="py-2 px-2 text-[11px] font-semibold text-blue-950">${escapeHtml(cat.name)}</td>
      <td class="py-2 px-2 text-[11px] font-bold text-blue-900 text-right">${cat.count}</td>
      <td class="py-2 px-2 text-[11px] font-bold ${getScoreColor(cat.avgScore)} text-right">${cat.avgScore.toFixed(1)}</td>
    </tr>`).join('');
}

function renderTrends(scores) {
  const tbody = document.getElementById('trendsTable');
  if (!tbody) return;

  const trends = processPerformanceData(scores).trends;
  if (!trends.dates.length) {
    tbody.innerHTML = '<tr><td colspan="3" class="py-2 text-center text-indigo-800 font-medium">No data available</td></tr>';
    return;
  }

  tbody.innerHTML = trends.dates.map((date, i) => `
    <tr class="border-b border-indigo-200 hover:bg-indigo-100/70 transition-colors">
      <td class="py-2 px-2 text-[11px] font-semibold text-indigo-950">${formatShortDate(date)}</td>
      <td class="py-2 px-2 text-[11px] font-bold text-indigo-900 text-right">${trends.scores[i].toFixed(1)}</td>
      <td class="py-2 px-2 text-[11px] font-semibold text-indigo-800 text-right">${trends.counts[i]}</td>
    </tr>`).join('');
}

function formatShortDate(dateStr) {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  });
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
  const categories = Object.entries(categoryScores).map(([name, values]) => ({
    name,
    count: values.length,
    avgScore: values.reduce((sum, s) => sum + s, 0) / values.length
  }));

  // Calculate historical trends
  const trendDates = Object.keys(dailyAverages).sort();
  const trendScores = trendDates.map(date => {
    const dayScores = dailyAverages[date];
    return dayScores.reduce((sum, s) => sum + s, 0) / dayScores.length;
  });
  const trendCounts = trendDates.map(date => dailyAverages[date].length);

  return {
    categories,
    trends: {
      dates: trendDates,
      scores: trendScores,
      counts: trendCounts
    }
  };
}

function renderLeaderboards(scores) {
  // ── Top Performers (grouped by reviewer) ──
  const reviewerMap = {};
  scores.forEach(score => {
    const reviewerId = score.reviewer_id || score.user_id;
    if (reviewerId === undefined || reviewerId === null) return;
    if (!reviewerMap[reviewerId]) {
      reviewerMap[reviewerId] = { name: score.reviewer_name || ('User ' + reviewerId), scores: [] };
    }
    reviewerMap[reviewerId].scores.push(+score.score || 0);
  });

  const performers = Object.values(reviewerMap).map(r => ({
    name: r.name,
    avgScore: r.scores.reduce((sum, s) => sum + s, 0) / r.scores.length
  }));
  performers.sort((a, b) => b.avgScore - a.avgScore);

  const performerBody = document.getElementById('topPerformersTable');
  if (!performerBody) return;
  if (!performers.length) {
    performerBody.innerHTML = '<tr><td colspan="3" class="py-2 text-center text-amber-800 font-medium">No data available</td></tr>';
  } else {
    const medals = ['🥇', '🥈', '🥉'];
    performerBody.innerHTML = performers.map((p, index) => `
      <tr class="border-b border-amber-200 hover:bg-amber-100/70 transition-colors">
        <td class="py-2 px-2 text-[11px] font-bold text-amber-950">${medals[index] || (index + 1)}</td>
        <td class="py-2 px-2 text-[11px] font-semibold text-amber-950 truncate max-w-[180px]">${escapeHtml(p.name)}</td>
        <td class="py-2 px-2 text-[11px] font-bold ${getScoreColor(p.avgScore)} text-right">${p.avgScore.toFixed(1)}</td>
      </tr>`).join('');
  }

  // ── Category Rankings ──
  const categoryBody = document.getElementById('categoryRankingsTable');
  if (!categoryBody) return;
  const categories = processPerformanceData(scores).categories.slice().sort((a, b) => b.avgScore - a.avgScore);
  if (!categories.length) {
    categoryBody.innerHTML = '<tr><td colspan="3" class="py-2 text-center text-violet-800 font-medium">No data available</td></tr>';
  } else {
    categoryBody.innerHTML = categories.map((cat, index) => `
      <tr class="border-b border-violet-200 hover:bg-violet-100/70 transition-colors">
        <td class="py-2 px-2 text-[11px] font-bold text-violet-950">${index === 0 ? '🏆' : (index + 1)}</td>
        <td class="py-2 px-2 text-[11px] font-semibold text-violet-950 truncate max-w-[180px]">${escapeHtml(cat.name)}</td>
        <td class="py-2 px-2 text-[11px] font-bold ${getScoreColor(cat.avgScore)} text-right">${cat.avgScore.toFixed(1)}</td>
      </tr>`).join('');
  }
}

function getScoreColor(score) {
  if (score >= 8.0) return 'text-emerald-700';
  if (score >= 6.0) return 'text-blue-700';
  if (score >= 4.0) return 'text-amber-700';
  return 'text-red-600';
}

function escapeHtml(s) {
  if (!s) return '';
  const div = document.createElement('div');
  div.textContent = String(s);
  return div.innerHTML;
}

