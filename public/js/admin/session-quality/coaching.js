/**
 * Coaching Feedback Page
 * Displays strengths and areas to improve for tutor/coach audience
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
  if (pageTitle) pageTitle.textContent = 'Coaching Feedback';
  if (pageDescription) pageDescription.textContent = 'Strengths and areas to improve for tutor development';
  
  SessionQualityFilters.onGetData((sessionId, filters) => {
    loadCoachingData(sessionId);
  });

  await SessionQualityFilters.init('filters-container');
  
  // Show initial prompt
  showEmpty('Select filters and click "Get Data" to view coaching feedback');
})();

async function loadCoachingData(sessionId) {
  const content = document.getElementById('content');
  content.innerHTML = '<p class="text-[12px] text-slate-500">Loading coaching feedback...</p>';

  try {
    const response = await apiFetch('/api/admin/tutoring/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_internal_id: sessionId })
    });
    const data = response.data || response;
    const rawCoaching = data.coaching || {};
    // Backend returns { strengths: [...], areas_to_improve: [...] }, normalize to flat array
    let coaching = [];
    if (Array.isArray(rawCoaching)) {
      coaching = rawCoaching;
    } else {
      const strengths = (rawCoaching.strengths || []).map(item => ({
        ...item,
        feedback_type: 'strength',
        area: item.area || 'Strength'
      }));
      const improvements = (rawCoaching.areas_to_improve || []).map(item => ({
        ...item,
        feedback_type: 'improvement',
        area: item.area || 'Area for Growth'
      }));
      coaching = [...strengths, ...improvements];
    }

    if (!coaching || coaching.length === 0) {
      showEmpty('No coaching feedback available for this session');
      return;
    }

    renderCoaching(coaching);
  } catch (e) {
    console.error('Failed to load coaching:', e);
    content.innerHTML = `<p class="text-[12px] text-red-600">Error loading coaching: ${e.message}</p>`;
  }
}

function renderCoaching(coaching) {
  const content = document.getElementById('content');

  // Group by feedback type
  const strengths = coaching.filter(c => c.feedback_type === 'strength' || c.area === 'strength');
  const improvements = coaching.filter(c => c.feedback_type === 'improvement' || c.area === 'improvement');

  let html = '';

  // Strengths
  if (strengths.length > 0) {
    html += `
      <div class="bg-white border border-slate-200 rounded-lg p-3 mb-3">
        <h3 class="text-[12px] font-semibold text-emerald-700 mb-2">✓ Strengths</h3>
        <div class="space-y-2">
          ${strengths.map(item => `
            <div class="text-[12px] text-slate-700 p-2 border-l-2 border-emerald-400">
              <div class="font-medium text-slate-900">${escapeHtml(item.area || item.title || 'Strength')}</div>
              ${item.evidence ? `<div class="text-slate-500 mt-1"><strong>Evidence:</strong> ${escapeHtml(item.evidence)}</div>` : ''}
              ${item.why_it_matters ? `<div class="text-slate-500"><strong>Why it matters:</strong> ${escapeHtml(item.why_it_matters)}</div>` : ''}
              ${item.recommended_action ? `<div class="text-slate-500"><strong>Recommended action:</strong> ${escapeHtml(item.recommended_action)}</div>` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // Areas to Improve
  if (improvements.length > 0) {
    html += `
      <div class="bg-white border border-slate-200 rounded-lg p-3 mb-3">
        <h3 class="text-[12px] font-semibold text-amber-700 mb-2">⚠ Areas to Improve</h3>
        <div class="space-y-2">
          ${improvements.map(item => `
            <div class="text-[12px] text-slate-700 p-2 border-l-2 border-amber-400">
              <div class="font-medium text-slate-900">${escapeHtml(item.area || item.title || 'Area for Growth')}</div>
              ${item.evidence ? `<div class="text-slate-500 mt-1"><strong>Evidence:</strong> ${escapeHtml(item.evidence)}</div>` : ''}
              ${item.why_it_matters ? `<div class="text-slate-500"><strong>Why it matters:</strong> ${escapeHtml(item.why_it_matters)}</div>` : ''}
              ${item.recommended_action ? `<div class="text-slate-500"><strong>Recommended action:</strong> ${escapeHtml(item.recommended_action)}</div>` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // If no categorized items, show all as generic list
  if (strengths.length === 0 && improvements.length === 0) {
    html = `
      <div class="bg-white border border-slate-200 rounded-lg p-3">
        <h3 class="text-[12px] font-semibold text-slate-900 mb-2">Coaching Feedback</h3>
        <div class="overflow-x-auto">
          <table class="w-full text-left text-[12px]">
            <thead>
              <tr class="border-b border-slate-200">
                <th class="py-1.5 px-2 text-[9px] text-slate-500 uppercase">Area</th>
                <th class="py-1.5 px-2 text-[9px] text-slate-500 uppercase">Type</th>
                <th class="py-1.5 px-2 text-[9px] text-slate-500 uppercase">Evidence</th>
                <th class="py-1.5 px-2 text-[9px] text-slate-500 uppercase">Recommended Action</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-200">
              ${coaching.map(item => `
                <tr>
                  <td class="py-1.5 px-2"><strong>${escapeHtml(item.area || item.title || '-')}</strong></td>
                  <td class="py-1.5 px-2"><span class="text-[11px] text-blue-600 font-medium">${escapeHtml(item.feedback_type || 'General')}</span></td>
                  <td class="py-1.5 px-2">${escapeHtml(item.evidence || '-')}</td>
                  <td class="py-1.5 px-2">${escapeHtml(item.recommended_action || '-')}</td>
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
      <p class="text-lg text-slate-500">🎯</p>
      <p class="text-[12px] text-slate-500 mt-2">No Coaching Feedback Available</p>
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