/**
 * public/js/reviewer/score.js
 * Reviewer scores report — filters by date/meeting/session + Get Data.
 */

const fromDate = document.getElementById('fromDate');
const toDate = document.getElementById('toDate');
const meetingFilter = document.getElementById('meetingFilter');
const sessionFilter = document.getElementById('sessionFilter');
const getDataBtn = document.getElementById('getDataBtn');
const resetBtn = document.getElementById('resetBtn');
const filterStatus = document.getElementById('filterStatus');
const summaryBar = document.getElementById('summaryBar');
const reportSection = document.getElementById('reportSection');
const reportTableBody = document.getElementById('reportTableBody');
const noData = document.getElementById('noData');

const state = { meetings: [], sessions: [] };

// ── Helpers ─────────────────────────────────────────────────────────────────
const apiGet = async (path) => {
  const res = await fetch(path, { credentials: 'include' });
  return res.json();
};

const escapeHtml = (s) => {
  if (s === null || s === undefined) return '';
  const div = document.createElement('div');
  div.textContent = String(s);
  return div.innerHTML;
};

const fmtDateTime = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const setStatus = (msg, ok = true) => {
  if (!filterStatus) return;
  filterStatus.textContent = msg;
  filterStatus.className = ok ? 'text-xs text-blue-900' : 'text-xs text-rose-700';
};

const toISO = (d) => d.toISOString().slice(0, 10);

// ── Load filter options ─────────────────────────────────────────────────────
async function loadFilterOptions() {
  try {
    const data = await apiGet('/api/reviewer/scores/filter-options');
    state.meetings = (data && data.meetings) || [];
    state.sessions = (data && data.sessions) || [];

    meetingFilter.innerHTML = '<option value="">All Meetings</option>';
    state.meetings.forEach((m) => meetingFilter.appendChild(new Option(m.title, String(m.id))));

    populateSessions();
  } catch (err) {
    console.error('Failed to load filter options:', err);
    setStatus('Failed to load filters.', false);
  }
}

function populateSessions() {
  const selectedMeeting = meetingFilter.value;
  const filtered = selectedMeeting
    ? state.sessions.filter((s) => String(s.meeting_id) === String(selectedMeeting))
    : state.sessions;

  sessionFilter.innerHTML = '<option value="">All Sessions</option>';
  filtered.forEach((s) => {
    sessionFilter.appendChild(new Option(`Session #${s.session_id}`, String(s.session_id)));
  });
}
// __PART2__
// ── Report rendering ────────────────────────────────────────────────────────
function renderReport(data) {
  const rows = (data && data.rows) || [];
  const summary = (data && data.summary) || { total_scores: 0, avg_score: 0, meetings_covered: 0, sessions_covered: 0 };

  document.getElementById('statTotal').textContent = summary.total_scores ?? rows.length;
  document.getElementById('statAvg').textContent = summary.avg_score ?? 0;
  document.getElementById('statMeetings').textContent = summary.meetings_covered ?? 0;
  document.getElementById('statSessions').textContent = summary.sessions_covered ?? 0;

  summaryBar.classList.remove('hidden');

  if (!rows.length) {
    reportSection.classList.add('hidden');
    noData.classList.remove('hidden');
    reportTableBody.innerHTML = '';
    return;
  }

  noData.classList.add('hidden');
  reportSection.classList.remove('hidden');

  reportTableBody.innerHTML = rows.map((r, idx) => `
    <tr class="hover:bg-indigo-50 transition-colors">
      <td class="py-2 px-2 font-bold text-slate-900">${idx + 1}</td>
      <td class="py-2 px-2 font-semibold text-slate-700">${fmtDateTime(r.scored_at)}</td>
      <td class="py-2 px-2 font-bold text-slate-900">${escapeHtml(r.meeting_title || `Meeting #${r.meeting_id}`)}</td>
      <td class="py-2 px-2 font-semibold text-slate-700">#${r.session_id ?? '—'}</td>
      <td class="py-2 px-2 text-slate-800">${escapeHtml(r.indicator_code || '')}${r.indicator_name ? ` · ${escapeHtml(r.indicator_name)}` : ''}</td>
      <td class="py-2 px-2 font-semibold text-slate-700">${escapeHtml(r.category_name || 'Unknown')}</td>
      <td class="py-2 px-2 font-bold ${Number(r.score) >= 70 ? 'text-emerald-700' : Number(r.score) >= 40 ? 'text-amber-700' : 'text-rose-700'}">${r.score ?? '—'}</td>
      <td class="py-2 px-2 font-semibold text-slate-700">${escapeHtml(r.score_type || '—')}</td>
      <td class="py-2 px-2 text-slate-600">${escapeHtml(r.comment) || '—'}</td>
    </tr>
  `).join('');
}

// ── Get data ────────────────────────────────────────────────────────────────
async function getData() {
  const params = new URLSearchParams();
  if (fromDate.value) params.set('from_date', fromDate.value);
  if (toDate.value) params.set('to_date', toDate.value);
  if (meetingFilter.value) params.set('meeting_id', meetingFilter.value);
  if (sessionFilter.value) params.set('session_id', sessionFilter.value);

  setStatus('Loading...', true);
  try {
    const data = await apiGet(`/api/reviewer/scores/report?${params.toString()}`);
    if (data && data.success === false) {
      setStatus(data.error || 'Failed to load report.', false);
      return;
    }
    renderReport(data);
    setStatus(data.rows && data.rows.length ? `${data.rows.length} score(s)` : 'No data', true);
  } catch (err) {
    console.error(err);
    setStatus('Unable to fetch report.', false);
  }
}

function resetFilters() {
  fromDate.value = toISO(new Date(Date.now() - 29 * 24 * 60 * 60 * 1000));
  toDate.value = toISO(new Date());
  meetingFilter.value = '';
  populateSessions();
  summaryBar.classList.add('hidden');
  reportSection.classList.add('hidden');
  noData.classList.add('hidden');
  reportTableBody.innerHTML = '';
  setStatus('', true);
}

// ── Wiring ──────────────────────────────────────────────────────────────────
if (meetingFilter) {
  meetingFilter.addEventListener('change', () => {
    sessionFilter.value = '';
    populateSessions();
  });
}
if (resetBtn) resetBtn.addEventListener('click', resetFilters);
if (getDataBtn) getDataBtn.addEventListener('click', getData);

// Default date range = last 30 days
if (fromDate && toDate) {
  fromDate.value = toISO(new Date(Date.now() - 29 * 24 * 60 * 60 * 1000));
  toDate.value = toISO(new Date());
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadFilterOptions();
  await getData();
});