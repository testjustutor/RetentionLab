/**
 * public/js/super_admin/reports/meeting-ai-session-report.js
 */

(function () {
  const params = new URLSearchParams(window.location.search);
  const sessionId = params.get('session_id');

  if (!sessionId) {
    document.getElementById('sessionMeta').innerHTML =
      '<div class="text-red-700 font-semibold">Missing session_id parameter.</div>';
    document.getElementById('auditBody').innerHTML =
      '<tr><td colspan="9" class="py-6 px-2 text-red-700 text-center">No session selected.</td></tr>';
    return;
  }

  loadSessionReport();
})();

async function loadSessionReport() {
  try {
    const data = await apiFetch('/api/super_admin/reports/meeting-ai-evaluation/session/' + encodeURIComponent(new URLSearchParams(window.location.search).get('session_id')));
    const session = data.session || {};
    const results = data.results || [];
    const stats = data.stats || {};

    renderMeta(session);
    renderStats(stats);
    renderTable(session, results);

    if (!results.length) {
      showToast('No AI audit results found for this session', true);
    }
  } catch (e) {
    console.error('loadSessionReport:', e);
    document.getElementById('sessionMeta').innerHTML =
      '<div class="text-red-700 font-semibold">Failed to load session report: ' + escHtml(e.message) + '</div>';
    document.getElementById('auditBody').innerHTML =
      '<tr><td colspan="9" class="py-6 px-2 text-red-700 text-center">Failed to load data.</td></tr>';
    showToast('Failed to load session report: ' + e.message, true);
  }
}

function renderMeta(session) {
  const el = document.getElementById('sessionMeta');
  const statusColor = session.session_status === 'completed' ? 'bg-emerald-100 text-emerald-700'
    : session.session_status === 'active' || session.session_status === 'joining' ? 'bg-blue-100 text-blue-700'
    : 'bg-slate-100 text-slate-600';

  el.innerHTML = `
    <div class="flex flex-wrap items-center gap-x-6 gap-y-2">
      <div>
        <p class="text-[10px] font-bold text-indigo-500 uppercase tracking-wide">Meeting</p>
        <p class="text-sm font-bold text-slate-900">${escHtml(session.meeting_title || '-')}</p>
      </div>
      <div>
        <p class="text-[10px] font-bold text-indigo-500 uppercase tracking-wide">Instructor</p>
        <p class="text-sm font-bold text-slate-900">${escHtml(session.instructor_name || session.instructor_email || '-')}</p>
      </div>
      <div>
        <p class="text-[10px] font-bold text-indigo-500 uppercase tracking-wide">Session #</p>
        <p class="text-sm font-bold text-slate-900">${escHtml(session.session_id)}</p>
      </div>
      <div>
        <p class="text-[10px] font-bold text-indigo-500 uppercase tracking-wide">Session Time</p>
        <p class="text-sm font-bold text-slate-900">${formatDateTime(session.session_start)} &rarr; ${formatTime(session.session_end)}</p>
      </div>
      <div>
        <p class="text-[10px] font-bold text-indigo-500 uppercase tracking-wide">Status</p>
        <span class="text-[10px] px-2 py-0.5 rounded font-bold ${statusColor}">${escHtml(session.session_status || 'unknown')}</span>
      </div>
      <div>
        <p class="text-[10px] font-bold text-indigo-500 uppercase tracking-wide">Platform</p>
        <p class="text-sm font-bold text-slate-900">${escHtml(session.platform || '-')}</p>
      </div>
      <div class="ml-auto">
          <a href="/super_admin/reports/meeting-ai-evaluation-report" class="px-3 py-1.5 rounded-md bg-slate-600 hover:bg-slate-500 text-white text-xs font-semibold transition-colors">Back to Report</a>
      </div>
    </div>`;
}
function renderStats(stats) {
  document.getElementById('statIndicators').textContent = stats.indicatorCount || 0;
  document.getElementById('statAvgScore').textContent = (stats.avgScorePct || 0) + '%';
  document.getElementById('statOqi').textContent = stats.oqiScore || '-';
  document.getElementById('statGateFailed').textContent = stats.gateFailed || 0;
  document.getElementById('statEvidence').textContent = stats.evidenceCount || 0;
}

function renderTable(session, results) {
  const body = document.getElementById('auditBody');
  if (!results.length) {
    body.innerHTML = '<tr><td colspan="9" class="py-6 px-2 text-blue-800 text-center">No AI audit results found for this session</td></tr>';
    return;
  }

  let html = '';
  results.forEach((r) => {
    // Excluded indicator (e.g. video-gated, not scorable from transcript) has a
    // null ai_score. Render as "N/A" instead of coercing to 0 / crashing.
    const isExcluded = r.ai_score === null || r.ai_score === undefined;
    const score = isExcluded ? null : Number(r.ai_score) || 0;
    const max = Number(r.ai_max_score) || 0;
    const pct = !isExcluded && max > 0 ? Math.round((score / max) * 100) : null;
    const pctColor = pct === null ? 'text-slate-500' : pct >= 70 ? 'text-emerald-700' : pct >= 50 ? 'text-amber-700' : 'text-red-700';
    const scoreText = isExcluded ? 'N/A' : score.toFixed(2);
    const pctText = pct === null ? 'N/A' : `${pct}%`;

    const raw = r.ai_raw_response;
    let rawText = '';
    try {
      const parsed = typeof raw === 'object' ? raw : JSON.parse(raw || '{}');
      rawText = escHtml(parsed.answer || JSON.stringify(parsed));
    } catch (err) {
      rawText = escHtml(typeof raw === 'string' ? raw : '');
    }

    html += `<tr class="border-b border-blue-200 hover:bg-blue-100/70 transition-colors align-top">
      <td class="py-2 px-2 text-[11px] font-semibold text-blue-950">${escHtml(r.category_name || r.category_id || 'Other')}</td>
      <td class="py-2 px-2 text-[11px] text-blue-900">${escHtml(r.indicator_name || r.indicator_id || '-')}</td>
      <td class="py-2 px-2 text-[11px] text-blue-800 text-right">${escHtml(r.category_weight != null ? r.category_weight : '-')}</td>
      <td class="py-2 px-2 text-[11px] font-bold text-blue-950 text-right">${scoreText}</td>
      <td class="py-2 px-2 text-[11px] text-blue-800 text-right">${max}</td>
      <td class="py-2 px-2 text-[11px] font-bold text-right ${pctColor}">${pctText}</td>
      <td class="py-2 px-2 text-[11px] text-slate-800 max-w-xs">${rawText || escHtml(r.ai_evidence || '-')}</td>
      <td class="py-2 px-2 text-[11px] italic text-slate-600 max-w-xs">${escHtml(r.evidence_quote || '-')}</td>
      <td class="py-2 px-2 text-[11px] text-blue-800 whitespace-nowrap">${formatDateTime(r.scored_at)}</td>
    </tr>`;
  });
  body.innerHTML = html;
}

function formatDateTime(d) {
  if (!d) return 'N/A';
  const dt = new Date(d);
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' ' + dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}
function formatTime(d) { if (!d) return ''; return new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }); }