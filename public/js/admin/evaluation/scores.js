let allScores = [];
let currentFilter = '';

(async () => {
  await loadData();
  updateStats();
  renderScores();
  
  // Set up filter
  document.getElementById('scoreTypeFilter').addEventListener('change', (e) => {
    currentFilter = e.target.value;
    renderScores();
  });
})();

async function loadData() {
  try {
    const data = await apiFetch('/api/scores');
    allScores = data.scores || [];
  } catch(e) {
    document.getElementById('scoresRoot').innerHTML = `<p class="text-red-400">Failed to load scores: ${e.message}</p>`;
  }
}

function updateStats() {
  const total = allScores.length;
  const aiScores = allScores.filter(s => s.score_type === 'AI').length;
  const humanScores = allScores.filter(s => s.score_type === 'HUMAN').length;
  const avgScore = total > 0 ? (allScores.reduce((sum, s) => sum + (+s.score || 0), 0) / total).toFixed(1) : '0.0';
  
  document.getElementById('totalScores').textContent = total;
  document.getElementById('avgScore').textContent = avgScore;
  document.getElementById('aiScores').textContent = aiScores;
  document.getElementById('humanScores').textContent = humanScores;
}

function renderScores() {
  const root = document.getElementById('scoresRoot');
  const filtered = currentFilter ? allScores.filter(s => s.score_type === currentFilter) : allScores;

  if (!filtered.length) {
    root.innerHTML = '<p class="text-slate-500 text-center py-16">No scores found</p>';
    return;
  }

  // Group by meeting
  const byMeeting = {};
  filtered.forEach(score => {
    const key = score.meeting_id || 'unknown';
    if (!byMeeting[key]) byMeeting[key] = [];
    byMeeting[key].push(score);
  });

  let html = '<div class="space-y-6">';
  Object.entries(byMeeting).forEach(([meetingId, scores]) => {
    const firstScore = scores[0];
    const avgMeetingScore = scores.length > 0 ? (scores.reduce((sum, s) => sum + (+s.score || 0), 0) / scores.length).toFixed(1) : '0.0';
    
    html += `<div class="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
      <div class="px-3 py-2.5 border-b border-slate-800 bg-slate-800/30">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-xs font-semibold text-white">${escapeHtml(firstScore.meeting_title || 'Untitled Meeting')}</h3>
            <p class="text-[10px] text-slate-400 mt-0.5">${formatDate(firstScore.meeting_date)} • ${scores.length} score${scores.length !== 1 ? 's' : ''}</p>
          </div>
          <div class="text-right">
            <p class="text-xl font-bold text-white">${avgMeetingScore}</p>
            <p class="text-[10px] text-slate-500">Average</p>
          </div>
        </div>
      </div>
      
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs">
          <thead>
            <tr class="border-b border-slate-800 text-[10px] text-slate-500 uppercase tracking-wider">
              <th class="py-2 px-3">Indicator</th>
              <th class="py-2 px-3 w-16">Type</th>
              <th class="py-2 px-3 w-16 text-center">Score</th>
              <th class="py-2 px-3 w-28">Reviewer</th>
              <th class="py-2 px-3 w-28">Date</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-800/50">`;
    
    scores.forEach(score => {
      const typeColor = score.score_type === 'AI' ? 'bg-violet-500/10 text-violet-400' : 'bg-emerald-500/10 text-emerald-600';
      const scoreColor = getScoreColor(+score.score || 0);
      
      html += `<tr class="hover:bg-slate-800/30">
        <td class="py-2 px-3 text-white">${escapeHtml(score.indicator_name || 'Unknown')}</td>
        <td class="py-2 px-3"><span class="text-[10px] px-1.5 py-0.5 rounded ${typeColor}">${score.score_type || 'HUMAN'}</span></td>
        <td class="py-2 px-3 text-center"><span class="font-bold ${scoreColor}">${(+score.score || 0).toFixed(1)}</span></td>
        <td class="py-2 px-3 text-slate-400">${escapeHtml(score.reviewer_name || 'System')}</td>
        <td class="py-2 px-3 text-slate-500">${formatDate(score.created_at)}</td>
      </tr>`;
    });
    
    html += '</tbody></table></div></div>';
  });
  html += '</div>';
  root.innerHTML = html;
}

async function exportScores() {
  try {
    const filtered = currentFilter ? allScores.filter(s => s.score_type === currentFilter) : allScores;
    
    if (!filtered.length) {
      showToast('No scores to export', true);
      return;
    }

    // Create CSV content
    const headers = ['Meeting Title', 'Meeting Date', 'Indicator', 'Score Type', 'Score', 'Reviewer', 'Date'];
    const csvContent = [
      headers.join(','),
      ...filtered.map(score => [
        `"${(score.meeting_title || 'Untitled Meeting').replace(/"/g, '""')}"`,
        formatDate(score.meeting_date),
        `"${(score.indicator_name || 'Unknown').replace(/"/g, '""')}"`,
        score.score_type || 'HUMAN',
        (+score.score || 0).toFixed(1),
        `"${(score.reviewer_name || 'System').replace(/"/g, '""')}"`,
        formatDate(score.created_at)
      ].join(','))
    ].join('\n');

    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `session-scores-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    showToast('Scores exported successfully');
  } catch(e) {
    showToast('Export failed: ' + e.message, true);
  }
}

function getScoreColor(score) {
  if (score >= 4.0) return 'text-emerald-600';
  if (score >= 3.0) return 'text-blue-400';
  if (score >= 2.0) return 'text-amber-800';
  return 'text-red-400';
}

function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-US', { 
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function escapeHtml(s) {
  if (!s) return '';
  const div = document.createElement('div');
  div.textContent = String(s);
  return div.innerHTML;
}