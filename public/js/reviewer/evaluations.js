/**
 * public/js/reviewer/evaluations.js
 * Reviewer evaluations (review queue) page — filters + compact table.
 */

const fromDate = document.getElementById('fromDate');
const toDate = document.getElementById('toDate');
const meetingFilter = document.getElementById('meetingFilter');
const sessionFilter = document.getElementById('sessionFilter');
const getDataBtn = document.getElementById('getDataBtn');
const resetBtn = document.getElementById('resetBtn');
const filterStatus = document.getElementById('filterStatus');
const summaryBar = document.getElementById('summaryBar');
const tableWrapper = document.getElementById('tableWrapper');
const evaluationsTableBody = document.getElementById('evaluationsTableBody');
const noData = document.getElementById('noData');

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

const fmtDate = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const fmtDateTime = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

function statusBadge(status) {
  const map = {
    pending: 'bg-amber-100 text-amber-800 border-amber-300',
    unassigned: 'bg-slate-200 text-slate-700 border-slate-300',
    in_progress: 'bg-violet-100 text-violet-800 border-violet-300',
    'in-progress': 'bg-violet-100 text-violet-800 border-violet-300',
    completed: 'bg-emerald-100 text-emerald-800 border-emerald-300'
  };
  const label = {
    pending: 'Pending',
    unassigned: 'Unassigned',
    in_progress: 'In Progress',
    'in-progress': 'In Progress',
    completed: 'Completed'
  };
  const cls = map[status] || 'bg-slate-200 text-slate-700 border-slate-300';
  return { cls, label: label[status] || status || '—' };
}
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

// ── Render ──────────────────────────────────────────────────────────────────
function renderItems(items) {
  if (!evaluationsTableBody) return;
  if (!items.length) {
    evaluationsTableBody.innerHTML = '';
    if (tableWrapper) tableWrapper.classList.add('hidden');
    if (noData) noData.classList.remove('hidden');
    return;
  }

  if (noData) noData.classList.add('hidden');
  if (tableWrapper) tableWrapper.classList.remove('hidden');

  const statusOf = (r) => r.session_status || r.meeting_status || '';

  evaluationsTableBody.innerHTML = items.map((r) => {
    const badge = statusBadge(r.review_status);
    const st = statusOf(r);
    const stBadge = st === 'completed'
      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
      : ['in_progress', 'active', 'joining'].includes(st)
        ? 'bg-violet-100 text-violet-800 border-violet-300'
        : 'bg-amber-100 text-amber-800 border-amber-300';
    return `
      <tr class="border-b border-blue-200 hover:bg-blue-100 transition-colors">
        <td class="px-3 py-2">
          <p class="text-xs font-bold text-slate-900 truncate max-w-[200px]">#${r.session_id} · ${escapeHtml(r.title || `Meeting #${r.meeting_id}`)}</p>
          <p class="text-[10px] text-slate-600 mt-0.5">${escapeHtml((r.platform || 'unknown').replace('-', ' '))}</p>
        </td>
        <td class="px-3 py-2 text-xs text-slate-700">${escapeHtml((r.platform || 'unknown').replace('-', ' '))}</td>
        <td class="px-3 py-2 text-xs font-semibold text-slate-700">${fmtDate(r.start_time)}</td>
        <td class="px-3 py-2">
          <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold border ${stBadge}">${escapeHtml(st) || '—'}</span>
        </td>
        <td class="px-3 py-2 text-right text-xs font-bold text-indigo-700">${r.avg_score != null ? `${r.avg_score}` : '—'}</td>
        <td class="px-3 py-2">
          <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold border ${badge.cls}">${badge.label}</span>
        </td>
        <td class="px-3 py-2 text-xs text-slate-700">${fmtDateTime(r.assigned_at)}</td>
        <td class="px-3 py-2 text-xs font-semibold text-slate-700">${escapeHtml(r.assigned_by) || '—'}</td>
        <td class="px-3 py-2 text-xs text-slate-700">${fmtDateTime(r.reviewed_at)}</td>
        <td class="px-3 py-2 text-xs text-slate-600 max-w-[180px] truncate">${escapeHtml(r.comments) || '—'}</td>
        <td class="px-3 py-2 text-right">
          <a href="/reviewer/evaluation-summary?meeting_id=${r.meeting_id}&session_id=${r.session_id}" class="inline-flex rounded-md bg-violet-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-violet-500 transition">Review</a>
        </td>
      </tr>`;
  }).join('');
}

function updateSummary(counts) {
  if (!summaryBar) return;
  summaryBar.classList.remove('hidden');
  if (document.getElementById('countTotal')) document.getElementById('countTotal').textContent = counts.total || 0;
  if (document.getElementById('countPending')) document.getElementById('countPending').textContent = counts.pending || 0;
  if (document.getElementById('countInProgress')) document.getElementById('countInProgress').textContent = counts.in_progress || 0;
  if (document.getElementById('countCompleted')) document.getElementById('countCompleted').textContent = counts.completed || 0;
}
async function getData() {
  const params = new URLSearchParams();
  if (fromDate.value) params.set('from_date', fromDate.value);
  if (toDate.value) params.set('to_date', toDate.value);
  if (meetingFilter.value) params.set('meeting_id', meetingFilter.value);
  if (sessionFilter.value) params.set('session_id', sessionFilter.value);

  setStatus('Loading...', true);
  try {
    const data = await apiGet(`/api/reviewer/sessions/evaluations?${params.toString()}`);
    if (data && data.success === false) {
      setStatus(data.error || 'Failed to load evaluations.', false);
      return;
    }
    const items = (data && data.items) || [];
    renderItems(items);
    updateSummary(data.counts || { total: items.length, pending: 0, in_progress: 0, completed: 0 });
    setStatus(items.length ? `${items.length} evaluation(s)` : 'No data', true);
  } catch (err) {
    console.error(err);
    setStatus('Unable to fetch evaluations.', false);
  }
}

function resetFilters() {
  fromDate.value = toISO(new Date(Date.now() - 29 * 24 * 60 * 60 * 1000));
  toDate.value = toISO(new Date());
  meetingFilter.value = '';
  sessionFilter.value = '';
  populateSessions();
  evaluationsTableBody.innerHTML = '';
  if (summaryBar) summaryBar.classList.add('hidden');
  if (tableWrapper) tableWrapper.classList.add('hidden');
  if (noData) noData.classList.add('hidden');
  setStatus('', true);
}

// ── Wiring ──────────────────────────────────────────────────────────────────
if (meetingFilter) {
  meetingFilter.addEventListener('change', () => { sessionFilter.value = ''; populateSessions(); });
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