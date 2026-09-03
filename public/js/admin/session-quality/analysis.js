/**
 * Session Analysis Page
 * Displays what worked well, needs improvement, and missed opportunities
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
  if (pageTitle) pageTitle.textContent = 'Session Analysis';
  if (pageDescription) pageDescription.textContent = 'What worked well, needs improvement, and missed opportunities';
  
  SessionQualityFilters.onGetData((sessionId, filters) => {
    loadAnalysisData(sessionId);
  });

  await SessionQualityFilters.init('filters-container');
  
  // Show initial prompt
  showEmpty('Select filters and click "Get Data" to view session analysis');
})();

async function loadAnalysisData(sessionInternalId) {
  const content = document.getElementById('content');
  content.innerHTML = '<p class="text-[12px] text-slate-500">Loading session analysis...</p>';

  try {
    const response = await apiFetch('/api/admin/tutoring/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_internal_id: sessionInternalId })
    });
    const data = response.data || response;
    const rawAnalysis = data.analysis || {};

    // Backend returns a row with what_worked_well, what_needs_improvement, missed_opportunities
    // as JSON arrays. Normalize to the flat array format renderAnalysis expects.
    let analysis = [];
    if (Array.isArray(rawAnalysis)) {
      analysis = rawAnalysis;
    } else {
      const workedWell = (rawAnalysis.what_worked_well || []).map(item => ({
        ...item,
        analysis_type: 'worked_well'
      }));
      const needsImprovement = (rawAnalysis.what_needs_improvement || []).map(item => ({
        ...item,
        analysis_type: 'needs_improvement'
      }));
      const missedOpportunities = (rawAnalysis.missed_opportunities || []).map(item => ({
        ...item,
        analysis_type: 'missed_opportunity'
      }));
      analysis = [...workedWell, ...needsImprovement, ...missedOpportunities];
    }

    if (!analysis || analysis.length === 0) {
      showEmpty('No analysis data available for this session');
      return;
    }

    renderAnalysis(analysis);
  } catch (e) {
    console.error('Failed to load analysis:', e);
    content.innerHTML = `<p class="text-[12px] text-red-600">Error loading analysis: ${e.message}</p>`;
  }
}

function renderAnalysis(analysis) {
  const content = document.getElementById('content');

  // Group by analysis type
  const workedWell = analysis.filter(a => a.analysis_type === 'worked_well' || a.analysis_type === 'strength');
  const needsImprovement = analysis.filter(a => a.analysis_type === 'needs_improvement' || a.analysis_type === 'weakness');
  const missedOpportunities = analysis.filter(a => a.analysis_type === 'missed_opportunity' || a.analysis_type === 'opportunity');

  let html = '';

  // What Worked Well
  if (workedWell.length > 0) {
    html += `
      <div class="bg-white border border-slate-200 rounded-lg p-3 mb-3">
        <h3 class="text-[12px] font-semibold text-emerald-700 mb-2">✓ What Worked Well</h3>
        <div class="space-y-2">
          ${workedWell.map(item => `
            <div class="text-[12px] text-slate-700 p-2 border-l-2 border-emerald-400">
              <div class="font-medium text-slate-900">${escapeHtml(item.description || item.title || 'Strength')}</div>
              ${item.evidence ? `<div class="text-slate-500 mt-1"><strong>Evidence:</strong> ${escapeHtml(item.evidence)}</div>` : ''}
              ${item.impact ? `<div class="text-slate-500"><strong>Impact:</strong> ${escapeHtml(item.impact)}</div>` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // Needs Improvement
  if (needsImprovement.length > 0) {
    html += `
      <div class="bg-white border border-slate-200 rounded-lg p-3 mb-3">
        <h3 class="text-[12px] font-semibold text-amber-700 mb-2">⚠ Needs Improvement</h3>
        <div class="space-y-2">
          ${needsImprovement.map(item => `
            <div class="text-[12px] text-slate-700 p-2 border-l-2 border-amber-400">
              <div class="font-medium text-slate-900">${escapeHtml(item.description || item.title || 'Area for Growth')}</div>
              ${item.evidence ? `<div class="text-slate-500 mt-1"><strong>Evidence:</strong> ${escapeHtml(item.evidence)}</div>` : ''}
              ${item.recommendation ? `<div class="text-slate-500"><strong>Recommendation:</strong> ${escapeHtml(item.recommendation)}</div>` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // Missed Opportunities
  if (missedOpportunities.length > 0) {
    html += `
      <div class="bg-white border border-slate-200 rounded-lg p-3 mb-3">
        <h3 class="text-[12px] font-semibold text-blue-700 mb-2">ℹ Missed Opportunities</h3>
        <div class="space-y-2">
          ${missedOpportunities.map(item => `
            <div class="text-[12px] text-slate-700 p-2 border-l-2 border-blue-400">
              <div class="font-medium text-slate-900">${escapeHtml(item.description || item.title || 'Opportunity')}</div>
              ${item.evidence ? `<div class="text-slate-500 mt-1"><strong>Context:</strong> ${escapeHtml(item.evidence)}</div>` : ''}
              ${item.suggested_approach ? `<div class="text-slate-500"><strong>Suggested Approach:</strong> ${escapeHtml(item.suggested_approach)}</div>` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // If no categorized items, show all as generic list
  if (workedWell.length === 0 && needsImprovement.length === 0 && missedOpportunities.length === 0) {
    html = `
      <div class="bg-white border border-slate-200 rounded-lg p-3">
        <h3 class="text-[12px] font-semibold text-slate-900 mb-2">Session Analysis</h3>
        <div class="overflow-x-auto">
          <table class="w-full text-left text-[12px]">
            <thead>
              <tr class="border-b border-slate-200">
                <th class="py-1.5 px-2 text-[9px] text-slate-500 uppercase">Type</th>
                <th class="py-1.5 px-2 text-[9px] text-slate-500 uppercase">Description</th>
                <th class="py-1.5 px-2 text-[9px] text-slate-500 uppercase">Evidence</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-200">
              ${analysis.map(item => `
                <tr>
                  <td class="py-1.5 px-2"><span class="text-[11px] text-blue-600 font-medium">${escapeHtml(item.analysis_type || 'General')}</span></td>
                  <td class="py-1.5 px-2">${escapeHtml(item.description || item.title || '-')}</td>
                  <td class="py-1.5 px-2">${escapeHtml(item.evidence || '-')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  content.innerHTML = html;
}

function showEmpty(message) {
  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="text-center py-8">
      <p class="text-lg text-slate-500">📝</p>
      <p class="text-[12px] text-slate-500 mt-2">No Analysis Available</p>
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