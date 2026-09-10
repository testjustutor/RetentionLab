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
      '<tr><td colspan="5" class="py-6 px-2 text-red-700 text-center">No session selected.</td></tr>';
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
    const categoryScores = data.categoryScores || [];
    const overallSummary = data.overallSummary || null;

    renderMeta(session);
    renderStats(stats);
    renderTable(session, results);
    renderCategoryScores(categoryScores);
    renderOverallSummary(overallSummary);

    if (!results.length) {
      showToast('No AI audit results found for this session', true);
    }
  } catch (e) {
    console.error('loadSessionReport:', e);
    document.getElementById('sessionMeta').innerHTML =
      '<div class="text-red-700 font-semibold">Failed to load session report: ' + escHtml(e.message) + '</div>';
    document.getElementById('auditBody').innerHTML =
      '<tr><td colspan="5" class="py-6 px-2 text-red-700 text-center">Failed to load data.</td></tr>';
    document.getElementById('categoryScoresBody').innerHTML =
      '<tr><td colspan="7" class="py-6 px-2 text-red-700 text-center">Failed to load data.</td></tr>';
    document.getElementById('overallSummaryBody').innerHTML =
      '<div class="text-red-700 font-semibold">Failed to load data.</div>';
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
    body.innerHTML = '<tr><td colspan="5" class="py-6 px-2 text-blue-800 text-center">No AI audit results found for this session</td></tr>';
    return;
  }

  let html = '';
  results.forEach((r) => {
    // AI Outcome: the DB stores the label directly (Met / Not met / N/A),
    // but a numeric code is also accepted for source-data compatibility:
    //   1 = Met, 2 = Not met, 3 = N/A
    let outcome;
    const rating = r.rating;
    if (rating === null || rating === undefined || rating === '') {
      outcome = 'N/A';
    } else if (rating === 1 || rating === '1') outcome = 'Met';
    else if (rating === 2 || rating === '2') outcome = 'Not met';
    else if (rating === 3 || rating === '3') outcome = 'N/A';
    else if (/^n\/?a$/i.test(String(rating)) || /not applicable/i.test(String(rating))) outcome = 'N/A';
    else if (rating === true) outcome = 'Met';
    else if (rating === false) outcome = 'Not met';
    else outcome = String(rating).trim();

    const outcomeColor = outcome === 'Met' ? 'text-emerald-700'
      : outcome === 'Not met' ? 'text-red-700'
      : 'text-slate-500';

    const weight = (r.category_weight !== null && r.category_weight !== undefined && r.category_weight !== '')
      ? r.category_weight : (r.indicator_value || '-');

    const quote = r.ai_evidence || r.evidence_quote || '-';

    html += `<tr class="border-b border-blue-200 hover:bg-blue-100/70 transition-colors align-top">
      <td class="py-2 px-2 text-[11px] font-semibold text-blue-950">${escHtml(r.category_name || r.category_id || 'Other')}</td>
      <td class="py-2 px-2 text-[11px] text-blue-900">${escHtml(r.indicator_name || r.indicator_id || '-')}</td>
      <td class="py-2 px-2 text-[11px] text-blue-800 text-right">${escHtml(weight)}</td>
      <td class="py-2 px-2 text-[11px] font-bold text-right ${outcomeColor}">${escHtml(outcome)}</td>
      <td class="py-2 px-2 text-[11px] italic text-slate-600 max-w-xs break-words">${escHtml(quote)}</td>
    </tr>`;
  });
  body.innerHTML = html;
}

// ai_audit_category_scores: one row per rubric category (A-H) for this session.
function renderCategoryScores(categoryScores) {
  const body = document.getElementById('categoryScoresBody');
  if (!categoryScores.length) {
    body.innerHTML = '<tr><td colspan="7" class="py-6 px-2 text-violet-800 text-center">No category scores found for this session</td></tr>';
    return;
  }

  let html = '';
  categoryScores.forEach((c) => {
    const scoreColor = c.categoryScore >= 70 ? 'text-emerald-700'
      : c.categoryScore >= 40 ? 'text-amber-700'
      : 'text-red-700';
    const weightDisplay = (c.category_weight !== null && c.category_weight !== undefined)
      ? (Number(c.category_weight) * 100).toFixed(0) + '%' : '-';

    html += `<tr class="border-b border-violet-200 hover:bg-violet-100/70 transition-colors">
      <td class="py-2 px-2 text-[11px] font-semibold text-violet-950">${escHtml(c.category_name)}</td>
      <td class="py-2 px-2 text-[11px] text-violet-800 text-right">${escHtml(weightDisplay)}</td>
      <td class="py-2 px-2 text-[11px] text-emerald-700 text-right font-semibold">${escHtml(c.countMet)}</td>
      <td class="py-2 px-2 text-[11px] text-red-700 text-right font-semibold">${escHtml(c.countNotMet)}</td>
      <td class="py-2 px-2 text-[11px] text-slate-500 text-right">${escHtml(c.countNotApplicable)}</td>
      <td class="py-2 px-2 text-[11px] text-violet-800 text-right">${escHtml(c.totalCriteria)}</td>
      <td class="py-2 px-2 text-[11px] font-bold text-right ${scoreColor}">${escHtml(c.categoryScore.toFixed(1))}%</td>
    </tr>`;
  });
  body.innerHTML = html;
}

// ai_audit_overall_summary: the single session-level rollup row.
function renderOverallSummary(overallSummary) {
  const card = document.getElementById('overallSummaryCard');
  const body = document.getElementById('overallSummaryBody');

  if (!overallSummary) {
    body.innerHTML = '<div class="text-slate-500">No overall summary found for this session</div>';
    return;
  }

  const scoreColor = overallSummary.finalScore >= 70 ? 'text-emerald-700'
    : overallSummary.finalScore >= 40 ? 'text-amber-700'
    : 'text-red-700';

  card.classList.toggle('border-red-400', overallSummary.redFlag);
  card.classList.toggle('from-red-50', overallSummary.redFlag);
  card.classList.toggle('to-red-100', overallSummary.redFlag);

  let html = `
    <div class="flex flex-wrap items-center gap-x-8 gap-y-2 mb-2">
      <div>
        <p class="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Final Score</p>
        <p class="text-lg font-bold ${scoreColor}">${escHtml(overallSummary.finalScore.toFixed(2))}%</p>
      </div>
      <div>
        <p class="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Total Criteria</p>
        <p class="text-sm font-bold text-slate-900">${escHtml(overallSummary.totalCriteriaAll)}</p>
      </div>
      <div>
        <p class="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Gate Status</p>
        <span class="text-[10px] px-2 py-0.5 rounded font-bold ${overallSummary.redFlag ? 'bg-red-200 text-red-800' : 'bg-emerald-100 text-emerald-700'}">
          ${overallSummary.redFlag ? 'RED FLAG' : 'All Gates Passed'}
        </span>
      </div>
    </div>`;

  if (overallSummary.overallSummaryText) {
    html += `<div class="text-[11px] text-slate-700 border-t border-slate-300 pt-2 mt-1">${escHtml(overallSummary.overallSummaryText)}</div>`;
  }

  body.innerHTML = html;
}

function formatDateTime(d) {
  if (!d) return 'N/A';
  const dt = new Date(d);
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' ' + dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}
function formatTime(d) { if (!d) return ''; return new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }); }