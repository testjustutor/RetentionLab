/**
 * Analytics Insights Page
 * Displays dynamic analytics from session quality and meeting data
 */
let dateFilter = null;

(async () => {
  // Initialize date filter (30 days default) - data loaded on Get Data click.
  dateFilter = createDateFilter({
    days: 30,
    autoLoad: false, // only fetch when Get Data is clicked (no auto-load on date change)
    onFilter: () => loadAnalytics()
  });

  // Load initial data on page load
  loadAnalytics();
})();

async function loadAnalytics() {
  try {
    const { fromDate, toDate } = dateFilter.getDates();

    const data = await apiFetch('/api/admin/insights/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from_date: fromDate, to_date: toDate })
    });

    renderOverallMetrics(data.overall_metrics);
    renderMeetingTrends(data.meeting_trends);
    renderScoreDistribution(data.score_distribution);

    showToast('Analytics loaded successfully');
  } catch (e) {
    console.error('Failed to load analytics:', e);
    showToast('Failed to load data: ' + e.message, true);
  }
}

function renderOverallMetrics(metrics) {
  metrics = metrics || {};
  document.getElementById('totalSessions').textContent = metrics.total_sessions || 0;
  document.getElementById('avgScore').textContent = metrics.avg_score || 0;
  document.getElementById('avgEngagement').textContent = metrics.avg_engagement || 0;
  document.getElementById('avgLearningImpact').textContent = metrics.avg_learning_impact || 0;
}

function renderMeetingTrends(trends) {
  const container = document.getElementById('meetingTrendsChart');
  if (!container) return;

  if (!trends || trends.length === 0) {
    container.innerHTML = '<p class="text-indigo-800 text-center py-6 text-[12px] font-medium">No meeting trend data available</p>';
    return;
  }

  const max = Math.max(...trends.map(t => t.meeting_count || 0));
  // Fixed chart height (px); tallest bar reserved height leaves room for count + label.
  const CHART_HEIGHT = 120;
  const MAX_BAR = 84;

  const bars = trends.map(t => {
    const count = t.meeting_count || 0;
    const barHeight = max > 0 ? Math.round((count / max) * MAX_BAR) : 0;
    return `
      <div class="flex flex-col items-center justify-end flex-1 min-w-0 gap-1">
        <span class="text-[10px] font-bold text-indigo-900">${count}</span>
        <div class="w-full max-w-8 bg-gradient-to-b from-indigo-400 to-indigo-600 rounded-t shadow-sm transition-all"
             style="height:${barHeight}px"></div>
        <span class="text-[10px] text-slate-600 truncate w-full text-center" title="${escapeHtml(t.month || '')}">${escapeHtml(formatMonth(t.month))}</span>
      </div>`;
  }).join('');

  container.innerHTML = `<div class="flex items-end gap-2" style="height:${CHART_HEIGHT}px">${bars}</div>`;
}

function formatMonth(month) {
  if (!month || /^\d{4}-\d{2}$/.test(month) === false) return month || '';
  const [year, mm] = month.split('-');
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const idx = parseInt(mm, 10) - 1;
  const name = names[idx] || mm;
  return `${name} ${year}`;
}

function renderScoreDistribution(distribution) {
  const container = document.getElementById('scoreDistribution');
  if (!container) return;

  const bands = distribution || [];
  if (bands.length === 0) {
    container.innerHTML = '<p class="text-emerald-800 text-center py-6 text-[12px] font-medium">No score distribution data</p>';
    return;
  }

  const total = bands.reduce((s, b) => s + (b.band_count || 0), 0);
  const colorMap = { '9-10': 'bg-emerald-500', '7-8': 'bg-violet-500', '5-6': 'bg-amber-500', '<5': 'bg-red-500' };

  const rows = bands.map(b => {
    const pct = total > 0 ? Math.round((b.band_count / total) * 100) : 0;
    const color = colorMap[b.score_band] || 'bg-slate-400';
    return `
      <div class="flex items-center gap-2 text-[12px]">
        <span class="text-slate-700 w-8 font-bold">${escapeHtml(b.score_band)}</span>
        <div class="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
          <div class="h-full ${color} rounded-full" style="width:${pct}%"></div>
        </div>
        <span class="text-slate-700 font-bold w-20 text-right">${b.band_count} (${pct}%)</span>
      </div>`;
  }).join('');

  container.innerHTML = `<div class="space-y-2.5">${rows}</div>`;
}

function escapeHtml(s) {
  if (!s) return '';
  const div = document.createElement('div');
  div.textContent = String(s);
  return div.innerHTML;
}
