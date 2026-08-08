/**
 * Rubric Evaluation Page
 * Displays full scored rubric table with domain groupings, criteria, ratings, and evidence
 * Uses cascading filters for instructor, board, class, subject, and meeting selection.
 */

(async () => {
  // Wait for header to be ready, then set page title
  if (globalThis.__rlHeaderReady) {
    await globalThis.__rlHeaderReady;
  }
  
  // Wait a bit more for header to finish loading from API
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Set page title in header
  const pageTitle = document.getElementById('pageTitle');
  const pageDescription = document.getElementById('pageDescription');
  if (pageTitle) pageTitle.textContent = 'Rubric Report';
  if (pageDescription) pageDescription.textContent = 'Detailed rubric evaluation and scoring';
  
  SessionQualityFilters.onGetData((sessionId, filters) => {
    loadRubricData(sessionId);
  });

  await SessionQualityFilters.init('filters-container');
  
  // Show initial prompt
  showEmpty('Select filters and click "Get Data" to view rubric report');
})();

async function loadRubricData(sessionInternalId) {
  const content = document.getElementById('content');
  content.innerHTML = '<p class="text-[12px] text-slate-500">Loading rubric evaluation...</p>';

  try {
    const response = await apiFetch('/api/admin/tutoring/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_internal_id: sessionInternalId })
    });
    const data = response.data || response;
    const report = data.report || {};
    const snapshot = data.snapshot || {};
    const rubricEvaluations = data.rubricEvaluations || [];

    if (!report || Object.keys(report).length === 0) {
      showEmpty('No rubric data available for this session');
      return;
    }

    renderRubric(report, snapshot, rubricEvaluations);
  } catch (e) {
    console.error('Failed to load rubric:', e);
    content.innerHTML = `<p class="text-[12px] text-red-600">Error loading rubric: ${e.message}</p>`;
  }
}

function renderRubric(report, snapshot, evaluations) {
  const content = document.getElementById('content');

  // Build snapshot cards
  const snapshotHtml = `
    <div class="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
      <div class="p-2.5 rounded-lg bg-white border border-slate-200">
        <p class="text-[9px] text-slate-500 uppercase tracking-wide">Overall Score</p>
        <h3 class="text-lg font-bold text-slate-950 mt-0.5">${report.weighted_score_pct || 'N/A'}%</h3>
      </div>
      <div class="p-2.5 rounded-lg bg-white border border-slate-200">
        <p class="text-[9px] text-slate-500 uppercase tracking-wide">Rating</p>
        <h3 class="text-lg font-bold text-blue-600 mt-0.5">${report.overall_rating || 'N/A'}</h3>
      </div>
      <div class="p-2.5 rounded-lg bg-white border border-slate-200">
        <p class="text-[9px] text-slate-500 uppercase tracking-wide">Gate Status</p>
        <h3 class="text-lg font-bold ${report.gate_status === 'all_passed' ? 'text-emerald-700' : 'text-amber-700'} mt-0.5">${report.gate_status === 'all_passed' ? 'Passed' : 'Failed'}</h3>
      </div>
      <div class="p-2.5 rounded-lg bg-white border border-slate-200">
        <p class="text-[9px] text-slate-500 uppercase tracking-wide">Confidence</p>
        <h3 class="text-lg font-bold text-slate-950 mt-0.5">${report.confidence_level || 'N/A'}</h3>
      </div>
    </div>
  `;

  // Executive summary from snapshot
  const summaryHtml = snapshot.executive_summary ? `
    <div class="bg-white border border-slate-200 rounded-lg p-3 mb-3">
      <h3 class="text-[12px] font-semibold text-slate-900 mb-2">Executive Summary</h3>
      <p class="text-[12px] text-slate-700 leading-relaxed">${escapeHtml(snapshot.executive_summary)}</p>
    </div>
  ` : '';

  // Rubric evaluations table
  let evaluationsHtml = '';
  if (evaluations && evaluations.length > 0) {
    evaluationsHtml = `
      <div class="bg-white border border-slate-200 rounded-lg p-3">
        <h3 class="text-[12px] font-semibold text-slate-900 mb-2">Indicator Evaluations</h3>
        <div class="overflow-x-auto">
          <table class="w-full text-left text-[12px]">
            <thead>
              <tr class="border-b border-slate-200">
                <th class="py-1.5 px-2 text-[9px] text-slate-500 uppercase">Indicator</th>
                <th class="py-1.5 px-2 text-[9px] text-slate-500 uppercase">Category</th>
                <th class="py-1.5 px-2 text-[9px] text-slate-500 uppercase">Rating</th>
                <th class="py-1.5 px-2 text-[9px] text-slate-500 uppercase">Weight</th>
                <th class="py-1.5 px-2 text-[9px] text-slate-500 uppercase">Benchmark</th>
                <th class="py-1.5 px-2 text-[9px] text-slate-500 uppercase">Evidence</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-200">
              ${evaluations.map(eval => `
                <tr>
                  <td class="py-1.5 px-2"><strong>${escapeHtml(eval.indicator_name || 'N/A')}</strong></td>
                  <td class="py-1.5 px-2">${escapeHtml(eval.indicator_type || '-')}</td>
                  <td class="py-1.5 px-2"><span class="text-[11px] font-medium ${getRatingColorClass(eval.rating)}">${escapeHtml(eval.rating || 'N/A')}</span></td>
                  <td class="py-1.5 px-2">${eval.weight || '-'}</td>
                  <td class="py-1.5 px-2">${escapeHtml(eval.benchmark || '-')}</td>
                  <td class="py-1.5 px-2">${escapeHtml(eval.evidence_text || 'No evidence')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  content.innerHTML = snapshotHtml + summaryHtml + evaluationsHtml;
}

function getRatingColorClass(rating) {
  if (!rating || rating === 'N/A') return 'text-slate-500';
  const r = rating.toLowerCase();
  if (r === 'exemplary' || r === 'strong' || r === 'yes' || r === 'good') return 'text-emerald-700';
  if (r === 'proficient' || r === 'moderate' || r === 'partial' || r === 'fair') return 'text-blue-600';
  if (r === 'developing' || r === 'weak' || r === 'limited' || r === 'needs improvement') return 'text-amber-700';
  return 'text-slate-500';
}

function showEmpty(message) {
  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="text-center py-8">
      <p class="text-lg text-slate-500">📊</p>
      <p class="text-[12px] text-slate-500 mt-2">No Data Available</p>
      <p class="text-[11px] text-slate-400 mt-1">${escapeHtml(message)}</p>
    </div>
  `;
}

function escapeHtml(s) {
  if (!s) return '';
  const div = document.createElement('div');
  div.textContent = String(s);
  return div.innerHTML;
}