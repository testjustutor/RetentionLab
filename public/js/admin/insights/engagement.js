/**
 * Engagement Insights Page
 * Displays dynamic engagement metrics from session quality data
 */
let engagementData = null;
let dateFilter = null;
let instructorFilter = null;

(async () => {
  // Initialize date filter (30 days default) - sets default From/To dates in the filter.
  dateFilter = createDateFilter({
    days: 30,
    onFilter: () => loadEngagementData()
  });
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

  renderDistribution(summary.engagement_levels);
}

function renderDistribution(levels) {
  const tbody = document.getElementById('distributionTable');
  if (!tbody) return;

  const data = levels || { high: 0, medium: 0, low: 0 };
  const total = (data.high || 0) + (data.medium || 0) + (data.low || 0);

  if (total === 0) {
    tbody.innerHTML = '<tr><td colspan="3" class="py-2 text-center text-emerald-800 font-medium">No data available</td></tr>';
    return;
  }

  const rows = [
    { label: 'High (70%+)', count: data.high || 0, color: 'text-emerald-700' },
    { label: 'Medium (40-69%)', count: data.medium || 0, color: 'text-amber-700' },
    { label: 'Low (<40%)', count: data.low || 0, color: 'text-red-600' }
  ];

  tbody.innerHTML = rows.map(r => {
    const pct = ((r.count / total) * 100).toFixed(1);
    return `
      <tr class="border-b border-emerald-200 hover:bg-emerald-100/70 transition-colors">
        <td class="py-2 px-2 text-[11px] font-semibold text-emerald-950">${escapeHtml(r.label)}</td>
        <td class="py-2 px-2 text-[11px] font-bold ${r.color} text-right">${r.count}</td>
        <td class="py-2 px-2 text-[11px] font-semibold text-emerald-800 text-right">${pct}%</td>
      </tr>`;
  }).join('');
}

function renderInstructorBreakdown(instructors) {
  const tbody = document.getElementById('instructorTable');
  if (!tbody) return;

  if (!instructors || instructors.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="py-2 text-center text-blue-800 font-medium">No instructor data available</td></tr>';
    return;
  }

  tbody.innerHTML = instructors.map(inst => `
    <tr class="border-b border-blue-200 hover:bg-blue-100/70 transition-colors">
      <td class="py-2 px-2 text-[11px] font-semibold text-blue-950">${escapeHtml(inst.instructor_name)}</td>
      <td class="py-2 px-2 text-[11px] font-bold text-blue-900 text-right">${inst.session_count}</td>
      <td class="py-2 px-2 text-[11px] font-bold ${getEngagementColor(inst.avg_engagement)} text-right">${inst.avg_engagement}%</td>
      <td class="py-2 px-2 text-[11px] font-bold ${getEngagementColor(inst.avg_learning_impact)} text-right">${inst.avg_learning_impact}%</td>
    </tr>`).join('');
}

function renderRecentSessions(sessions) {
  const tbody = document.getElementById('recentSessionsTable');
  if (!tbody) return;

  if (!sessions || sessions.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="py-2 text-center text-violet-800 font-medium">No recent sessions available</td></tr>';
    return;
  }

  tbody.innerHTML = sessions.map(session => `
    <tr class="border-b border-violet-200 hover:bg-violet-100/70 transition-colors">
      <td class="py-2 px-2 text-[11px] font-semibold text-violet-950">${escapeHtml(session.meeting_title)}</td>
      <td class="py-2 px-2 text-[11px] text-violet-900">${escapeHtml(session.instructor_name)}</td>
      <td class="py-2 px-2 text-[11px] text-violet-900 whitespace-nowrap">${formatDate(session.meeting_date)}</td>
      <td class="py-2 px-2 text-[11px] font-bold ${getEngagementColor(session.student_engagement)} text-right">${session.student_engagement}%</td>
      <td class="py-2 px-2 text-[11px] font-semibold text-violet-900">${session.overall_rating ? escapeHtml(session.overall_rating) : '—'}</td>
    </tr>`).join('');
}

function getEngagementColor(value) {
  const num = parseFloat(value) || 0;
  if (num >= 70) return 'text-emerald-700';
  if (num >= 40) return 'text-amber-700';
  return 'text-red-600';
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