/**
 * Engagement Insights Page
 * Displays dynamic engagement metrics from session quality data
 */
let engagementData = null;
let dateFilter = null;
let instructorFilter = null;

(async () => {
  // Initialize date filter (30 days default)
  dateFilter = createDateFilter({
    days: 30,
    onFilter: () => loadEngagementData()
  });

  await loadEngagementData();
})();

async function loadEngagementData() {
  try {
    const { fromDate, toDate } = dateFilter.getDates();
    
    const data = await apiFetch('/api/admin/insights/engagement', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from_date: fromDate,
        to_date: toDate
      })
    });
    engagementData = data;
    
    renderSummary(data.summary);
    renderInstructorBreakdown(data.instructor_breakdown);
    renderRecentSessions(data.recent_sessions);
    
    showToast('Engagement data loaded successfully');
  } catch (e) {
    console.error('Failed to load engagement data:', e);
    showToast('Failed to load data: ' + e.message, true);
  }
}

function renderSummary(summary) {
  document.getElementById('totalSessions').textContent = summary.total_sessions || 0;
  document.getElementById('avgEngagement').textContent = summary.avg_engagement || 0;
  document.getElementById('avgLearningImpact').textContent = summary.avg_learning_impact || 0;
  document.getElementById('avgScore').textContent = summary.avg_score || 0;

  // Engagement level distribution
  const levels = summary.engagement_levels || { high: 0, medium: 0, low: 0 };
  const total = levels.high + levels.medium + levels.low;
  
  if (total > 0) {
    const highPct = Math.round((levels.high / total) * 100);
    const mediumPct = Math.round((levels.medium / total) * 100);
    const lowPct = Math.round((levels.low / total) * 100);
    
    document.getElementById('highEngagement').textContent = highPct + '%';
    document.getElementById('mediumEngagement').textContent = mediumPct + '%';
    document.getElementById('lowEngagement').textContent = lowPct + '%';
  }
}

function renderInstructorBreakdown(instructors) {
  const container = document.getElementById('instructorBreakdown');
  
  if (!instructors || instructors.length === 0) {
    container.innerHTML = '<p class="text-slate-500 text-center py-8">No instructor data available</p>';
    return;
  }

  const html = instructors.map(inst => `
    <div class="bg-slate-800/30 border border-slate-700/50 rounded-md p-3 hover:bg-slate-800/50 transition-colors">
      <div class="flex items-center justify-between">
        <div class="flex-1">
          <p class="text-xs font-semibold text-slate-100">${escapeHtml(inst.instructor_name)}</p>
          <p class="text-[10px] text-slate-400 mt-0.5">${inst.session_count} session${inst.session_count !== 1 ? 's' : ''}</p>
        </div>
        <div class="flex gap-3">
          <div class="text-right">
            <p class="text-sm font-bold ${getEngagementColor(inst.avg_engagement)}">${inst.avg_engagement}%</p>
            <p class="text-[10px] text-slate-500">Engagement</p>
          </div>
          <div class="text-right">
            <p class="text-sm font-bold ${getEngagementColor(inst.avg_learning_impact)}">${inst.avg_learning_impact}%</p>
            <p class="text-[10px] text-slate-500">Impact</p>
          </div>
        </div>
      </div>
    </div>
  `).join('');

  container.innerHTML = html;
}

function renderRecentSessions(sessions) {
  const container = document.getElementById('recentSessions');
  
  if (!sessions || sessions.length === 0) {
    container.innerHTML = '<p class="text-slate-500 text-center py-8">No recent sessions available</p>';
    return;
  }

  const html = sessions.map(session => `
    <div class="bg-slate-800/30 border border-slate-700/50 rounded-md p-3 hover:bg-slate-800/50 transition-colors">
      <div class="flex items-start justify-between">
        <div class="flex-1">
          <p class="text-xs font-semibold text-slate-100">${escapeHtml(session.meeting_title)}</p>
          <p class="text-[10px] text-slate-400 mt-0.5">${formatDate(session.meeting_date)} • ${escapeHtml(session.instructor_name)}</p>
        </div>
        <div class="flex gap-2 ml-3">
          <div class="text-right">
            <p class="text-sm font-bold ${getEngagementColor(session.student_engagement)}">${session.student_engagement}%</p>
            <p class="text-[10px] text-slate-500">Engagement</p>
          </div>
        </div>
      </div>
      ${session.overall_rating ? `<p class="text-[10px] text-slate-400 mt-1.5"><span class="text-violet-400">Rating:</span> ${escapeHtml(session.overall_rating)}</p>` : ''}
    </div>
  `).join('');

  container.innerHTML = html;
}

function getEngagementColor(value) {
  const num = parseFloat(value) || 0;
  if (num >= 70) return 'text-emerald-600';
  if (num >= 40) return 'text-amber-800';
  return 'text-red-400';
}

function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function escapeHtml(s) {
  if (!s) return '';
  const div = document.createElement('div');
  div.textContent = String(s);
  return div.innerHTML;
}