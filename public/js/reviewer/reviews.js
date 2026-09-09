/**
 * public/js/reviewer/reviews.js
 * Reviewer review queue — date/meeting/session filters + read-only status table.
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
const reviewsTableBody = document.getElementById('reviewsTableBody');
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
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const fmtDuration = (minutes) => {
  if (!minutes) return '-';
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h${m}m` : `${h}h`;
};

function statusBadge(status) {
  const map = {
    unassigned: 'bg-slate-200 text-slate-700 border-slate-300',
    pending: 'bg-amber-100 text-amber-800 border-amber-300',
    in_progress: 'bg-violet-100 text-violet-800 border-violet-300',
    'in-progress': 'bg-violet-100 text-violet-800 border-violet-300',
    completed: 'bg-emerald-100 text-emerald-800 border-emerald-300'
  };
  const label = {
    unassigned: 'Unassigned',
    pending: 'Pending',
    in_progress: 'In Progress',
    'in-progress': 'In Progress',
    completed: 'Completed'
  };
  const cls = map[status] || 'bg-slate-200 text-slate-700 border-slate-300';
  return { cls, label: label[status] || status || '—' };
}
// __PART2__
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

// ── Render (read-only) ──────────────────────────────────────────────────────
function renderItems(items) {
  if (!reviewsTableBody) return;
  if (!items.length) {
    reviewsTableBody.innerHTML = '';
    if (tableWrapper) tableWrapper.classList.add('hidden');
    if (noData) noData.classList.remove('hidden');
    return;
  }

  if (noData) noData.classList.add('hidden');
  if (tableWrapper) tableWrapper.classList.remove('hidden');

  reviewsTableBody.innerHTML = items.map((r) => {
    const badge = statusBadge(r.review_status);
    return `
      <tr class="border-b border-violet-200 hover:bg-violet-50 transition-colors">
        <td class="px-3 py-2">
          <p class="text-xs font-bold text-slate-900 truncate">${escapeHtml(r.title || `Meeting #${r.meeting_id}`)}</p>
          <p class="text-[10px] text-slate-600 mt-0.5 truncate">${escapeHtml(r.calendar_account || '')}</p>
        </td>
        <td class="px-3 py-2 text-[10px] font-semibold text-slate-700 capitalize">${escapeHtml((r.platform || 'unknown').replace('-', ' '))}</td>
        <td class="px-3 py-2 text-xs font-semibold text-slate-700">${fmtDate(r.start_time)}</td>
        <td class="px-3 py-2 text-xs font-semibold text-slate-700">${fmtDuration(r.duration)}</td>
        <td class="px-3 py-2 text-xs font-bold ${r.avg_score != null ? 'text-slate-900' : 'text-slate-400'}">${r.avg_score != null ? r.avg_score : '-'}</td>
        <td class="px-3 py-2">
          <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold border ${badge.cls}">${badge.label}</span>
        </td>
        <td class="px-3 py-2 text-xs font-semibold text-slate-700">${escapeHtml(r.assigned_by) || '—'}</td>
      </tr>`;
  }).join('');
}

function updateSummary(counts) {
  if (!summaryBar) return;
  summaryBar.classList.remove('hidden');
  if (document.getElementById('countTotal')) document.getElementById('countTotal').textContent = counts.total || 0;
  if (document.getElementById('countUnassigned')) document.getElementById('countUnassigned').textContent = counts.unassigned || 0;
  if (document.getElementById('countPending')) document.getElementById('countPending').textContent = counts.pending || 0;
  if (document.getElementById('countActive')) document.getElementById('countActive').textContent = counts.in_progress || 0;
  if (document.getElementById('countCompleted')) document.getElementById('countCompleted').textContent = counts.completed || 0;
}
// __PART3__
async function getData() {
  const params = new URLSearchParams();
  if (fromDate.value) params.set('from_date', fromDate.value);
  if (toDate.value) params.set('to_date', toDate.value);
  if (meetingFilter.value) params.set('meeting_id', meetingFilter.value);
  if (sessionFilter.value) params.set('session_id', sessionFilter.value);

  setStatus('Loading...', true);
  try {
    const data = await apiGet(`/api/reviewer/reviews/filtered-reviews?${params.toString()}`);
    if (data && data.success === false) {
      setStatus(data.error || 'Failed to load reviews.', false);
      return;
    }
    const items = (data && data.sessions) || [];
    renderItems(items);
    updateSummary(data.counts || { total: items.length, unassigned: 0, pending: 0, in_progress: 0, completed: 0 });
    setStatus(items.length ? `${items.length} review(s)` : 'No data', true);
  } catch (err) {
    console.error(err);
    setStatus('Unable to fetch reviews.', false);
  }
}

function resetFilters() {
  fromDate.value = toISO(new Date(Date.now() - 29 * 24 * 60 * 60 * 1000));
  toDate.value = toISO(new Date());
  meetingFilter.value = '';
  sessionFilter.value = '';
  populateSessions();
  reviewsTableBody.innerHTML = '';
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