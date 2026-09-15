/**
 * public/js/reviewer/sessions.js
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
const sessionsTableBody = document.getElementById('sessionsTableBody');
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

function getPlatformIcon(platform) {
  const icons = {
    'google-meet': `<svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M22.54 6.42a2.78 2.78 0 00-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 00-1.94 2A29 29 0 001 12a29 29 0 00.46 5.58 2.78 2.78 0 001.94 2C5.12 20 12 20 12 20s6.88 0 8.6-.46a2.78 2.78 0 001.94-2A29 29 0 0023 12a29 29 0 00-.46-5.58z"/><polygon points="9.75 15.02 15.5 12 9.75 8.98" fill="#0F172A"/></svg>`,
    'zoom': `<svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/><path d="M10 8l6 4-6 4V8z" fill="#0F172A"/></svg>`,
    'teams': `<svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/></svg>`,
    'unknown': `<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>`
  };
  return icons[platform] || icons['unknown'];
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now - d;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDuration(minutes) {
  if (!minutes) return '-';
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h${m}m` : `${h}h`;
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

// ── Render ──────────────────────────────────────────────────────────────────
function renderSessions(sessions) {
  if (!sessionsTableBody) return;
  if (!sessions.length) {
    sessionsTableBody.innerHTML = '';
    if (tableWrapper) tableWrapper.classList.add('hidden');
    if (noData) noData.classList.remove('hidden');
    return;
  }

  if (noData) noData.classList.add('hidden');
  if (tableWrapper) tableWrapper.classList.remove('hidden');

  sessionsTableBody.innerHTML = sessions.map((s) => `
    <tr class="border-b border-blue-200 hover:bg-blue-100 transition-colors cursor-pointer" onclick="viewSession('${s.meeting_id}', '${s.session_id}')">
      <td class="px-3 py-2">
        <div class="flex items-center gap-2">
          <div class="w-6 h-6 rounded bg-blue-100 border border-blue-300 flex items-center justify-center text-blue-700 flex-shrink-0">
            ${getPlatformIcon(s.platform)}
          </div>
          <div class="min-w-0">
            <p class="text-xs font-bold text-slate-900 truncate">${escapeHtml(s.title)}</p>
            <p class="text-[10px] text-slate-600 mt-0.5">#${s.session_id} · ${s.participant_count || 0} participants</p>
          </div>
        </div>
      </td>
      <td class="px-3 py-2">
        <span class="text-[10px] font-semibold text-slate-700 capitalize">${escapeHtml((s.platform || 'unknown').replace('-', ' '))}</span>
      </td>
      <td class="px-3 py-2">
        <span class="text-xs font-semibold text-slate-700">${formatDate(s.start_time)}</span>
      </td>
      <td class="px-3 py-2">
        <span class="text-xs font-semibold text-slate-700">${formatDuration(s.duration)}</span>
      </td>
      <td class="px-3 py-2">
        ${s.avg_score != null ? `
        <div class="flex items-center gap-1.5">
          <div class="w-12 h-1 bg-slate-200 rounded-full overflow-hidden">
            <div class="h-full rounded-full ${s.avg_score >= 7 ? 'bg-emerald-500' : s.avg_score >= 4 ? 'bg-amber-500' : 'bg-red-500'}" style="width: ${s.avg_score * 10}%"></div>
          </div>
          <span class="text-xs font-bold ${s.avg_score >= 7 ? 'text-emerald-700' : s.avg_score >= 4 ? 'text-amber-700' : 'text-red-700'}">${s.avg_score}</span>
        </div>
        ` : '<span class="text-[10px] text-slate-500">-</span>'}
      </td>
      <td class="px-3 py-2 text-right">
        <div class="flex items-center justify-end gap-0.5">
          ${s.audio_url ? `<button onclick="event.stopPropagation(); openContentModal('${s.audio_url}', 'Audio')" class="p-1 text-violet-600 hover:text-violet-400" title="Audio"><svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M19 11V7a5 5 0 00-10 0v4M5 11v4a5 5 0 0010 0v-4"/></svg></button>` : ''}
          ${s.transcript_url ? `<button onclick="event.stopPropagation(); openContentModal('${s.transcript_url}', 'Transcript')" class="p-1 text-violet-600 hover:text-violet-400" title="Transcript"><svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M9 12h6M9 16h6M9 8h6"/><rect x="3" y="4" width="18" height="16" rx="2"/></svg></button>` : ''}
          ${s.summary_url ? `<button onclick="event.stopPropagation(); openContentModal('${s.summary_url}', 'Summary')" class="p-1 text-violet-600 hover:text-violet-400" title="Summary"><svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h7"/></svg></button>` : ''}
        </div>
      </td>
    </tr>
  `).join('');
}
// __PART3__
function updateSummary(counts) {
  if (!summaryBar) return;
  summaryBar.classList.remove('hidden');
  if (document.getElementById('countTotal')) document.getElementById('countTotal').textContent = counts.total || 0;
  if (document.getElementById('countCompleted')) document.getElementById('countCompleted').textContent = counts.completed || 0;
  if (document.getElementById('countInProgress')) document.getElementById('countInProgress').textContent = counts.in_progress || 0;
  if (document.getElementById('countScheduled')) document.getElementById('countScheduled').textContent = counts.scheduled || 0;
}

async function getData() {
  const params = new URLSearchParams();
  if (fromDate.value) params.set('from_date', fromDate.value);
  if (toDate.value) params.set('to_date', toDate.value);
  if (meetingFilter.value) params.set('meeting_id', meetingFilter.value);
  if (sessionFilter.value) params.set('session_id', sessionFilter.value);

  setStatus('Loading...', true);
  try {
    const data = await apiGet(`/api/reviewer/sessions/filtered-sessions?${params.toString()}`);
    if (data && data.success === false) {
      setStatus(data.error || 'Failed to load sessions.', false);
      return;
    }
    const sessions = (data && data.sessions) || [];
    renderSessions(sessions);
    updateSummary(data.counts || { total: sessions.length, completed: 0, in_progress: 0, scheduled: 0 });
    setStatus(sessions.length ? `${sessions.length} session(s)` : 'No data', true);
  } catch (err) {
    console.error(err);
    setStatus('Unable to fetch sessions.', false);
  }
}

function resetFilters() {
  fromDate.value = toISO(new Date(Date.now() - 29 * 24 * 60 * 60 * 1000));
  toDate.value = toISO(new Date());
  meetingFilter.value = '';
  sessionFilter.value = '';
  populateSessions();
  sessionsTableBody.innerHTML = '';
  if (summaryBar) summaryBar.classList.add('hidden');
  if (tableWrapper) tableWrapper.classList.add('hidden');
  if (noData) noData.classList.add('hidden');
  setStatus('', true);
}
// __PART4__
// ── Modal ───────────────────────────────────────────────────────────────────
function openContentModal(url, title) {
  const modal = document.getElementById('contentModal');
  const modalTitle = document.getElementById('modalTitle');
  const modalContent = document.getElementById('modalContent');
  if (!modal || !modalTitle || !modalContent) return;

  modalTitle.textContent = title;
  modalContent.innerHTML = '<div class="flex items-center justify-center py-12"><svg class="w-8 h-8 text-slate-600 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg></div>';
  modal.classList.remove('hidden');
  modal.classList.add('flex');

  fetch(url, { credentials: 'include' })
    .then((res) => { if (!res.ok) throw new Error('Failed to load content'); return res.text(); })
    .then((text) => {
      if (url.endsWith('.json')) {
        try { modalContent.innerHTML = '<pre class="bg-slate-800/50 p-4 rounded-lg overflow-auto text-xs text-slate-300 font-mono">' + escapeHtml(JSON.stringify(JSON.parse(text), null, 2)) + '</pre>'; }
        catch { modalContent.innerHTML = '<pre class="bg-slate-800/50 p-4 rounded-lg overflow-auto text-xs text-slate-300 font-mono whitespace-pre-wrap">' + escapeHtml(text) + '</pre>'; }
      } else if (url.endsWith('.txt') || url.endsWith('.md') || url.endsWith('.vtt')) {
        modalContent.innerHTML = '<div class="max-w-none"><pre class="whitespace-pre-wrap font-mono text-sm text-slate-300">' + escapeHtml(text) + '</pre></div>';
      } else if (url.endsWith('.mp3') || url.endsWith('.wav') || url.endsWith('.m4a')) {
        modalContent.innerHTML = '<audio controls class="w-full" src="' + url + '"></audio>';
      } else {
        modalContent.innerHTML = '<pre class="bg-slate-800/50 p-4 rounded-lg overflow-auto text-xs text-slate-300 font-mono whitespace-pre-wrap">' + escapeHtml(text) + '</pre>';
      }
    })
    .catch((err) => { modalContent.innerHTML = '<div class="flex flex-col items-center justify-center py-12 text-red-400"><p>Failed to load content</p><p class="text-xs mt-1 text-slate-500">' + escapeHtml(err.message) + '</p></div>'; });
}

function closeContentModal() {
  const modal = document.getElementById('contentModal');
  if (!modal) return;
  modal.classList.add('hidden');
  modal.classList.remove('flex');
  document.getElementById('modalContent').innerHTML = '';
}

function viewSession(meetingId, sessionId) {
  window.location.href = `/reviewer/evaluation-summary?meeting_id=${meetingId}${sessionId ? `&session_id=${sessionId}` : ''}`;
}

// ── Wiring ──────────────────────────────────────────────────────────────────
if (meetingFilter) {
  meetingFilter.addEventListener('change', () => { sessionFilter.value = ''; populateSessions(); });
}
if (getDataBtn) getDataBtn.addEventListener('click', getData);
if (resetBtn) resetBtn.addEventListener('click', resetFilters);

const contentModal = document.getElementById('contentModal');
if (contentModal) contentModal.addEventListener('click', (e) => { if (e.target === contentModal) closeContentModal(); });

// Default date range = last 30 days
if (fromDate && toDate) {
  fromDate.value = toISO(new Date(Date.now() - 29 * 24 * 60 * 60 * 1000));
  toDate.value = toISO(new Date());
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadFilterOptions();
  await getData();
});