let allScores = [];
let allMeetings = [];
let trendsChart = null;

(async () => {
  await loadScores();
  updateStats();
  renderEvaluationTable();
  initChart();
})();

async function loadScores() {
  try {
    const data = await apiFetch('/api/admin/evaluations/reports/summary');
    allScores = data.scores || [];
    allMeetings = data.meetings || [];
    
    // Update stats if available
    if (data.stats) {
      document.getElementById('totalMeetings').textContent = data.stats.totalMeetings || 0;
      document.getElementById('avgAiScore').textContent = data.stats.avgAiScore || '0.0';
      document.getElementById('avgHumanScore').textContent = data.stats.avgHumanScore || '0.0';
      document.getElementById('totalRubrics').textContent = data.stats.totalRubrics || 0;
      document.getElementById('totalReviewers').textContent = data.stats.totalReviewers || 0;
    }
  } catch(e) {
    console.error('Failed to load scores:', e);
    // Fallback to direct endpoints
    try {
      const scoresData = await apiFetch('/api/admin/scores');
      allScores = scoresData.scores || [];
    } catch(e2) { console.error('Fallback scores failed:', e2); }
    try {
      const meetingsData = await apiFetch('/api/admin/meetings/list');
      allMeetings = meetingsData.meetings || [];
    } catch(e2) { console.error('Fallback meetings failed:', e2); }
  }
}

// Rubrics derived from meeting/rubric score data
function getRubricsForMeeting(meetingId) {
  const meetingScores = allScores.filter(s => s.meeting_id === meetingId);
  const rubricIds = new Set(meetingScores.map(s => s.rubric_id || s.category_id).filter(Boolean));
  return Array.from(rubricIds);
}

function updateStats() {
  const aiScores = allScores.filter(s => s.score_type === 'AI');
  const humanScores = allScores.filter(s => s.score_type === 'HUMAN');

  const avgAi = aiScores.length ? (aiScores.reduce((sum, s) => sum + (+s.score || 0), 0) / aiScores.length).toFixed(1) : '0.0';
  const avgHuman = humanScores.length ? (humanScores.reduce((sum, s) => sum + (+s.score || 0), 0) / humanScores.length).toFixed(1) : '0.0';

  document.getElementById('totalMeetings').textContent = allMeetings.length;
  document.getElementById('avgAiScore').textContent = avgAi;
  document.getElementById('avgHumanScore').textContent = avgHuman;
  // Count unique indicator/category groups from scores
  const rubricGroups = new Set(allScores.map(s => s.category_id || s.rubric_id).filter(Boolean));
  document.getElementById('totalRubrics').textContent = rubricGroups.size || 0;

  // Count unique reviewers
  const reviewerIds = new Set(allScores.map(s => s.reviewer_id).filter(Boolean));
  document.getElementById('totalReviewers').textContent = reviewerIds.size;
}

function renderEvaluationTable() {
  const tbody = document.getElementById('evaluationBody');
  const filterType = document.getElementById('scoreTypeFilter')?.value || '';

  // Group scores by meeting
  const byMeeting = {};
  allScores.forEach(score => {
    const mid = score.meeting_id || 'unknown';
    if (!byMeeting[mid]) byMeeting[mid] = { ai: [], human: [] };
    if (score.score_type === 'AI') byMeeting[mid].ai.push(+score.score || 0);
    else byMeeting[mid].human.push(+score.score || 0);
  });

  const meetings = allMeetings.filter(m => !filterType || byMeeting[m.meeting_id]);
  
  if (!meetings.length) {
    tbody.innerHTML = '<tr><td class="py-8 px-4 text-slate-500 text-center" colspan="7">No evaluation data found</td></tr>';
    return;
  }

  let html = '';
  meetings.forEach(m => {
    const ms = byMeeting[m.meeting_id];
    const rubrics = getRubricsForMeeting(m.meeting_id);
    const aiAvg = ms?.ai?.length ? (ms.ai.reduce((a,b) => a+b, 0) / ms.ai.length).toFixed(1) : '-';
    const humanAvg = ms?.human?.length ? (ms.human.reduce((a,b) => a+b, 0) / ms.human.length).toFixed(1) : '-';
    const finalScore = ms ? (((ms.ai.reduce((a,b) => a+b, 0) + ms.human.reduce((a,b) => a+b, 0)) / (ms.ai.length + ms.human.length)) || 0).toFixed(1) : '-';
    const totalReviews = (ms?.ai?.length || 0) + (ms?.human?.length || 0);

    html += `<tr class="hover:bg-slate-800/30">
      <td class="py-2 px-3 text-xs ">${escapeHtml(m.title || 'Untitled')}</td>
      <td class="py-2 px-3 text-[10px] text-slate-400">${rubrics.length} rubric${rubrics.length !== 1 ? 's' : ''}</td>
      <td class="py-2 px-3 text-[10px] font-medium ${+aiAvg >= 4 ? 'text-emerald-600' : +aiAvg >= 3 ? 'text-blue-400' : 'text-slate-400'}">${aiAvg}</td>
      <td class="py-2 px-3 text-[10px] font-medium ${+humanAvg >= 4 ? 'text-emerald-600' : +humanAvg >= 3 ? 'text-blue-400' : 'text-slate-400'}">${humanAvg}</td>
      <td class="py-2 px-3 text-xs font-bold ">${finalScore}</td>
      <td class="py-2 px-3 text-[10px] text-slate-400">${totalReviews}</td>
      <td class="py-2 px-3 text-[10px] text-slate-500">${formatDate(m.start_time)}</td>
    </tr>`;
  });

  tbody.innerHTML = html;
}

function initChart() {
  const ctx = document.getElementById('trendsChart').getContext('2d');
  
  // Group scores by date
  const byDate = {};
  allScores.forEach(s => {
    const date = new Date(s.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    if (!byDate[date]) byDate[date] = { ai: [], human: [] };
    if (s.score_type === 'AI') byDate[date].ai.push(+s.score || 0);
    else byDate[date].human.push(+s.score || 0);
  });

  const dates = Object.keys(byDate).sort((a,b) => new Date(a) - new Date(b));
  const aiAvgs = dates.map(d => byDate[d].ai.length ? (byDate[d].ai.reduce((a,b) => a+b, 0) / byDate[d].ai.length) : null);
  const humanAvgs = dates.map(d => byDate[d].human.length ? (byDate[d].human.reduce((a,b) => a+b, 0) / byDate[d].human.length) : null);

  trendsChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: dates,
      datasets: [
        {
          label: 'AI Score',
          data: aiAvgs,
          borderColor: 'rgba(139, 92, 246, 1)',
          backgroundColor: 'rgba(139, 92, 246, 0.1)',
          tension: 0.4,
          pointRadius: 4
        },
        {
          label: 'Human Score',
          data: humanAvgs,
          borderColor: 'rgba(34, 197, 94, 1)',
          backgroundColor: 'rgba(34, 197, 94, 0.1)',
          tension: 0.4,
          pointRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#e2e8f0' } }
      },
      scales: {
        x: { ticks: { color: '#94a3b8' }, grid: { color: '#334155' } },
        y: { min: 0, max: 5, ticks: { color: '#94a3b8' }, grid: { color: '#334155' } }
      }
    }
  });
}

async function exportReport() {
  try {
    const rows = allScores.map(s => ({
      meeting: s.meeting_title || 'Untitled',
      indicator: s.indicator_name || 'Unknown',
      type: s.score_type || 'HUMAN',
      score: (+s.score || 0).toFixed(1),
      reviewer: s.reviewer_name || 'System',
      date: formatDate(s.created_at)
    }));

    if (!rows.length) { showToast('No data to export', true); return; }

    const headers = Object.keys(rows[0]);
    const csv = [headers.join(',')].concat(rows.map(r => headers.map(k => `"${String(r[k]).replace(/"/g,'""')}"`).join(','))).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `evaluation-report-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast('Report exported');
  } catch(e) { showToast('Export failed: ' + e.message, true); }
}

// Set up filter
document.addEventListener('change', (e) => {
  if (e.target.id === 'scoreTypeFilter') renderEvaluationTable();
});

function formatDate(d) {
  if (!d) return 'N/A';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function escapeHtml(s) {
  if (!s) return '';
  const div = document.createElement('div');
  div.textContent = String(s);
  return div.innerHTML;
}