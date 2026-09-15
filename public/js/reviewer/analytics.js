/**
 * public/js/reviewer/analytics.js
 * Reviewer analytics — filters + auto-load + KPI/detail tables.
 */

const fromDate = document.getElementById('fromDate');
const toDate = document.getElementById('toDate');
const meetingFilter = document.getElementById('meetingFilter');
const sessionFilter = document.getElementById('sessionFilter');
const getDataBtn = document.getElementById('getDataBtn');
const resetBtn = document.getElementById('resetBtn');
const filterStatus = document.getElementById('filterStatus');
const summaryBar = document.getElementById('summaryBar');
const detailCards = document.getElementById('detailCards');
const noData = document.getElementById('noData');
const statusBody = document.getElementById('statusBody');
const scoresBody = document.getElementById('scoresBody');
const evalsBody = document.getElementById('evalsBody');

const state = { meetings: [], sessions: [], sessionsByMeeting: {} };

// ── Helpers ─────────────────────────────────────────────────────────────────
const apiGet = async (path) => {
  const res = await fetch(path, { credentials: 'include' });
  return res.json();
};

const escapeHtml = (s) => {
  if (!s) return '';
  const div = document.createElement('div');
  div.textContent = String(s);
  return div.innerHTML;
};

const setStatus = (msg, ok = true) => {
  if (!filterStatus) return;
  filterStatus.textContent = msg;
  filterStatus.className = ok ? 'text-xs text-blue-900' : 'text-xs text-rose-700';
};

const toISO = (d) => d.toISOString().slice(0, 10);

const statusLabel = (s) => ({
  pending: 'Pending',
  unassigned: 'Unassigned',
  in_progress: 'In Progress',
  'in-progress': 'In Progress',
  completed: 'Completed'
}[s] || s || '—');

// ── Load filter options ─────────────────────────────────────────────────────
async function loadFilterOptions() {
  try {
    const data = await apiGet('/api/reviewer/sessions/filter-options');
    state.meetings = (data && data.meetings) || [];
    state.sessions = (data && data.sessions) || [];
    state.sessionsByMeeting = {};

    meetingFilter.innerHTML = '<option value="">All Meetings</option>';
    state.meetings.forEach((m) => meetingFilter.appendChild(new Option(m.meeting_title || `Meeting #${m.meeting_id}`, String(m.meeting_id))));

    state.sessions.forEach((s) => {
      (state.sessionsByMeeting[String(s.meeting_id)] = state.sessionsByMeeting[String(s.meeting_id)] || []).push(s);
    });

    populateSessions();
  } catch (err) {
    console.error('Failed to load filter options:', err);
    setStatus('Failed to load filters.', false);
  }
}

function populateSessions() {
  const selectedMeeting = meetingFilter.value;
  const filtered = selectedMeeting
    ? state.sessionsByMeeting[selectedMeeting] || []
    : state.sessions;

  sessionFilter.innerHTML = '<option value="">All Sessions</option>';
  filtered.forEach((s) => sessionFilter.appendChild(new Option(`Session #${s.session_id}`, String(s.session_id))));
}
// __PART2__
function renderAnalytics(a) {
  if (!a) return;
  const dist = a.status_distribution || [];
  const d = {};
  dist.forEach((r) => { d[r.status] = r.count; });
  const total = a.total_reviews || 0;

  if (!summaryBar) return;
  summaryBar.classList.remove('hidden');
  detailCards.classList.remove('hidden');
  noData.classList.add('hidden');

  document.getElementById('kpiTotal').textContent = total;
  document.getElementById('kpiPending').textContent = d.pending || 0;
  document.getElementById('kpiActive').textContent = (d.in_progress || d['in-progress'] || 0);
  document.getElementById('kpiCompleted').textContent = d.completed || 0;
  document.getElementById('kpiAvgScore').textContent = (a.scores && a.scores.avg_score) || 0;

  // status table
  statusBody.innerHTML = dist.length ? dist.map((r) => `
    <tr class="hover:bg-blue-50 transition-colors">
      <td class="py-1.5 px-2 font-semibold text-slate-800">${escapeHtml(statusLabel(r.status))}</td>
      <td class="py-1.5 px-2 text-right font-bold text-slate-900">${r.count}</td>
    </tr>`).join('')
    : '<tr><td colspan="2" class="py-3 text-center text-slate-500">No activity</td></tr>';

  // scores table
  const sc = a.scores || {};
  scoresBody.innerHTML = `
    <tr><td class="py-1.5 px-2 font-semibold text-slate-700">Scores Saved</td><td class="py-1.5 px-2 text-right font-bold text-slate-900">${sc.total_scores || 0}</td></tr>
    <tr><td class="py-1.5 px-2 font-semibold text-slate-700">Avg Score</td><td class="py-1.5 px-2 text-right font-bold text-violet-700">${sc.avg_score || 0}</td></tr>`;

  // evaluations table
  const ev = a.evaluations || {};
  evalsBody.innerHTML = `
    <tr><td class="py-1.5 px-2 font-semibold text-slate-700">Evaluations</td><td class="py-1.5 px-2 text-right font-bold text-slate-900">${ev.total_evals || 0}</td></tr>
    <tr><td class="py-1.5 px-2 font-semibold text-slate-700">Avg Final %</td><td class="py-1.5 px-2 text-right font-bold text-emerald-700">${ev.avg_final_score || 0}</td></tr>`;
}

async function getData() {
  const params = new URLSearchParams();
  if (fromDate.value) params.set('from_date', fromDate.value);
  if (toDate.value) params.set('to_date', toDate.value);
  if (meetingFilter.value) params.set('meeting_id', meetingFilter.value);
  if (sessionFilter.value) params.set('session_id', sessionFilter.value);

  setStatus('Loading...', true);
  try {
    const data = await apiGet(`/api/reviewer/reviews/analytics?${params.toString()}`);
    if (data && data.success === false) {
      setStatus(data.error || 'Failed to load analytics.', false);
      return;
    }
    const a = (data && data.analytics) || {};
    if (a.total_reviews || (a.scores && a.scores.total_scores)) {
      renderAnalytics(a);
      setStatus('Analytics loaded.', true);
    } else {
      summaryBar.classList.add('hidden');
      detailCards.classList.add('hidden');
      noData.classList.remove('hidden');
      setStatus('No data', true);
    }
  } catch (err) {
    console.error(err);
    setStatus('Unable to fetch analytics.', false);
  }
}

function resetFilters() {
  fromDate.value = toISO(new Date(Date.now() - 29 * 24 * 60 * 60 * 1000));
  toDate.value = toISO(new Date());
  meetingFilter.value = '';
  sessionFilter.value = '';
  populateSessions();
  summaryBar.classList.add('hidden');
  detailCards.classList.add('hidden');
  noData.classList.add('hidden');
  setStatus('', true);
}

// ── Wiring ──────────────────────────────────────────────────────────────────
if (meetingFilter) {
  meetingFilter.addEventListener('change', () => { sessionFilter.value = ''; populateSessions(); });
}
if (getDataBtn) getDataBtn.addEventListener('click', getData);
if (resetBtn) resetBtn.addEventListener('click', resetFilters);

// Default date range = last 30 days
if (fromDate && toDate) {
  fromDate.value = toISO(new Date(Date.now() - 29 * 24 * 60 * 60 * 1000));
  toDate.value = toISO(new Date());
}

// Auto-load data on reload using default filters
document.addEventListener('DOMContentLoaded', async () => {
  await loadFilterOptions();
  await getData();
});