/**
 * root/public/js/instructor/dashboard.js
 */
(function () {
  const API_BASE = '/api/instructor-dashboard';

  async function apiFetch(path) {
    const res = await fetch(API_BASE + path, {
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include'
    });
    const text = await res.text();
    try { return JSON.parse(text); } catch (e) { return text; }
  }

  const setText = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };

  function initStats(data) {
    setText('stat-upcoming', data.upcomingMeetings ?? 0);
    setText('stat-completed', data.completedSessions ?? 0);
    setText('stat-avg-score', data.avgScore ?? 0);
    setText('stat-content', data.contentGenerated ?? 0);
    setText('stat-total', data.totalMeetings ?? 0);
  }

  async function loadStats() {
    const result = await apiFetch('/stats');
    if (!result || !result.success) throw new Error('Failed to load stats');
    initStats(result.data);
    return result.data;
  }

  async function loadRecentMeetings() {
    const result = await apiFetch('/recent-meetings');
    if (!result || !result.success) return [];
    const list = document.getElementById('recentMeetingsList');
    if (!list) return;
    list.innerHTML = '';
    result.data.forEach(m => {
      const li = document.createElement('li');
      li.className = 'flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2';
      li.innerHTML = `
        <div class="min-w-0">
          <p class="truncate text-sm font-medium text-white">${escapeHtml(m.title || 'Untitled Meeting')}</p>
          <p class="text-xs text-slate-400">${m.platform || 'Unknown'} • ${m.start_time ? new Date(m.start_time).toLocaleDateString() : 'No date'}</p>
        </div>
        <span class="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusClass(m.status)}">${m.status || 'pending'}</span>
      `;
      list.appendChild(li);
    });
  }

  function statusClass(status) {
    const map = {
      completed: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
      active: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
      joining: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
      queued: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
      failed: 'bg-rose-500/15 text-rose-300 border-rose-500/30'
    };
    return map[status] || 'bg-slate-500/15 text-slate-300 border-slate-500/30';
  }

  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  async function init() {
    try {
      await Promise.all([loadStats(), loadRecentMeetings()]);
      setText('lastUpdated', new Date().toLocaleString());
    } catch (err) {
      console.error('Instructor dashboard init error:', err);
    }
  }

  // Expose init function globally for external calls (e.g., after calendar sync)
  window.loadDashboard = init;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();