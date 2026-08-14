/**
 * Team Performance Report (admin).
 * Fetches server-side team aggregation from /api/admin/reports/teams/summary
 * with date + instructor filters. Renders a column/bar chart + team cards.
 */
let teams = [];
let teamStats = {};
let dateFilter = null;
let instructorFilter = null;
let teamChart = null;

(async () => {
  dateFilter = createDateFilter({
    days: 30,
    autoLoad: false,
    onFilter: (fromDate, toDate) => loadData(fromDate, toDate)
  });
  loadInstructors();
  // Load on refresh using the default one-month date range.
  await loadData();
})();

async function loadInstructors() {
  try {
    instructorFilter = createSearchableSelect({
      containerId: 'instructorFilterContainer',
      placeholder: 'All instructors',
      dataSource: async () => {
        const json = await apiFetch('/api/admin/reports/teams/instructors');
        return json.instructors || [];
      },
      displayField: 'name',
      valueField: 'id'
    });
  } catch (e) {
    console.error('Failed to load instructors:', e);
  }
}

async function loadData(fromDate, toDate) {
  try {
    if (!fromDate || !toDate) {
      const dates = dateFilter.getDates();
      fromDate = dates.fromDate;
      toDate = dates.toDate;
    }
    const params = new URLSearchParams();
    params.append('from_date', fromDate);
    params.append('to_date', toDate);
    const instructorId = instructorFilter ? instructorFilter.getValue() : null;
    if (instructorId) params.append('instructor_id', instructorId);

    const json = await apiFetch('/api/admin/reports/teams/summary?' + params.toString());
    teams = json.teams || [];
    teamStats = json.stats || {};

    renderStats();
    populateTeamFilter();
    renderChart();
    renderTeamCards();
    showToast('Team data loaded successfully');
  } catch (e) {
    console.error('loadData:', e);
    teams = [];
    teamStats = {};
    renderStats();
    populateTeamFilter();
    renderChart();
    renderTeamCards();
    showToast('Failed to load team data: ' + e.message, true);
  }
}

function renderStats() {
  const ids = ['totalTeams', 'totalMembers', 'avgPerformance', 'growthRate'];
  const vals = [teamStats.totalTeams || 0, teamStats.totalMembers || 0, teamStats.avgPerformance || '0.0', teamStats.growthRate || '0.0'];
  ids.forEach((id, i) => {
    const el = document.getElementById(id);
    if (el) el.textContent = vals[i];
  });
}

function populateTeamFilter() {
  const filter = document.getElementById('teamFilter');
  if (!filter) return;
  filter.innerHTML = '<option value="">All Teams</option>';
  teams.forEach((t) => {
    filter.innerHTML += `<option value='${escapeHtml(t.name || '')}'>${escapeHtml(t.name || '')}</option>`;
  });
  filter.onchange = () => renderTeamCards();
}

function renderChart() {
  const ctx = document.getElementById('teamChart');
  if (!ctx || typeof Chart === 'undefined') return;
  const labels = teams.map((t) => t.name || 'Team');
  const scores = teams.map((t) => Number(t.avgScore) || 0);
  const members = teams.map((t) => Number(t.memberCount) || 0);

  if (teamChart) teamChart.destroy();

  teamChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Average Score', data: scores, backgroundColor: 'rgba(139, 92, 246, 0.45)', borderColor: 'rgba(139, 92, 246, 1)', borderWidth: 1, yAxisID: 'y' },
        { label: 'Members', data: members, backgroundColor: 'rgba(34, 197, 94, 0.35)', borderColor: 'rgba(34, 197, 94, 1)', borderWidth: 1, yAxisID: 'y1' }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { labels: { color: '#c4b5fd', font: { size: 13, weight: 'bold' } } } },
      scales: {
        x: { ticks: { color: '#7dd3fc', font: { size: 12, weight: 'bold' } }, grid: { color: '#475569' } },
        y: { beginAtZero: true, ticks: { color: '#7dd3fc', font: { size: 12, weight: 'bold' } }, grid: { color: '#475569' }, position: 'left' },
        y1: { beginAtZero: true, ticks: { color: '#7dd3fc', font: { size: 12, weight: 'bold' } }, grid: { display: false }, position: 'right' }
      }
    }
  });
}

function getVisibleTeams() {
  const selected = document.getElementById('teamFilter') ? document.getElementById('teamFilter').value : '';
  return selected ? teams.filter((t) => (t.name || '') === selected) : teams;
}

function renderTeamCards() {
  const container = document.getElementById('teamCards');
  if (!container) return;
  const visible = getVisibleTeams();
  if (!visible.length) {
    container.innerHTML = `<p class='text-slate-700 font-semibold text-center py-16 col-span-2'>No teams found</p>`;
    return;
  }
  let html = '';
  visible.forEach((t) => {
    const avg = Number(t.avgScore) || 0;
    const accent = avg >= 4 ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
      : avg >= 3 ? 'border-blue-300 bg-blue-50 text-blue-900'
      : 'border-slate-300 bg-slate-50 text-slate-800';
    html += `<div class='bg-white border-2 border-blue-200 rounded-lg p-3 shadow-md'>`;
    html += `<h4 class='text-[14px] font-bold text-blue-950 mb-3 border-b-2 border-blue-100 pb-2'>${escapeHtml(t.name || 'Team')}</h4>`;
    html += `<div class='grid grid-cols-2 gap-2'>`;
    html += `<div class='border-2 ${accent} rounded-md p-2 text-center'>
      <p class='text-[10px] font-bold uppercase tracking-wide'>Members</p>
      <p class='text-lg font-extrabold'>${t.memberCount}</p>
    </div>`;
    html += `<div class='border-2 ${accent} rounded-md p-2 text-center'>
      <p class='text-[10px] font-bold uppercase tracking-wide'>Avg Score</p>
      <p class='text-lg font-extrabold text-blue-950'>${t.avgScore}</p>
    </div>`;
    html += `<div class='border-2 ${accent} rounded-md p-2 text-center'>
      <p class='text-[10px] font-bold uppercase tracking-wide'>Scores</p>
      <p class='text-lg font-extrabold'>${t.scoreCount}</p>
    </div>`;
    html += `<div class='border-2 ${accent} rounded-md p-2 text-center'>
      <p class='text-[10px] font-bold uppercase tracking-wide'>Participation</p>
      <p class='text-lg font-extrabold'>${t.participation}%</p>
    </div>`;
    html += `</div></div>`;
  });
  container.innerHTML = html;
}

function exportTeamReport() {
  if (!teams.length) { showToast('No data to export', true); return; }
  const headers = ['Team', 'Members', 'Avg Score', 'Scores', 'Participation', 'High', 'Medium', 'Low'];
  const NL = String.fromCharCode(10);
  const DQ = String.fromCharCode(34);
  const rows = teams.map((t) => [t.name || '', t.memberCount, t.avgScore, t.scoreCount, t.participation + '%', t.high || 0, t.medium || 0, t.low || 0]);
  const csv = [headers.join(',')].concat(rows.map((r) => r.map((v) => csvEscape(v, DQ)).join(','))).join(NL);
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'team-report-' + new Date().toISOString().split('T')[0] + '.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast('Report exported');
}

function csvEscape(v, DQ) {
  let s = String(v == null ? '' : v);
  const C = String.fromCharCode(44);
  const NL = String.fromCharCode(10);
  const CR = String.fromCharCode(13);
  if (s.indexOf(DQ) >= 0 || s.indexOf(C) >= 0 || s.indexOf(NL) >= 0 || s.indexOf(CR) >= 0) {
    s = DQ + s.split(DQ).join(DQ + DQ) + DQ;
  }
  return s;
}

function escapeHtml(s) {
  if (!s) return '';
  const div = document.createElement('div');
  div.textContent = String(s);
  return div.innerHTML;
}

