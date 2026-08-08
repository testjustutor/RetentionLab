/**
 * Next Session Plan Page
 * Displays time-blocked plan with priority focus and gaps to address
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
  if (pageTitle) pageTitle.textContent = 'Next Session Plan';
  if (pageDescription) pageDescription.textContent = 'Time-blocked plan with priority focus and gaps to address';
  
  SessionQualityFilters.onGetData((sessionId, filters) => {
    loadNextPlan(sessionId);
  });

  await SessionQualityFilters.init('filters-container');
  
  // Show initial prompt
  showEmpty('Select filters and click "Get Data" to view next session plan');
})();

async function loadNextPlan(sessionId) {
  const content = document.getElementById('content');
  content.innerHTML = '<p class="text-[12px] text-slate-500">Loading next session plan...</p>';

  try {
    const response = await apiFetch('/api/admin/tutoring/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_internal_id: sessionId })
    });
    const data = response.data || response;
    const nextPlan = data.nextPlan || {};

    if (!nextPlan || Object.keys(nextPlan).length === 0) {
      showEmpty('No next session plan available for this session');
      return;
    }

    renderNextPlan(nextPlan);
  } catch (e) {
    console.error('Failed to load next plan:', e);
    content.innerHTML = `<p class="text-[12px] text-red-600">Error loading next plan: ${e.message}</p>`;
  }
}

function renderNextPlan(plan) {
  const content = document.getElementById('content');

  // Backend stores: segments [{segment, duration, plan}], priority_focus [...], gaps_to_address [...]
  const segments = Array.isArray(plan.segments) ? plan.segments : [];
  const priorityFocus = Array.isArray(plan.priority_focus) ? plan.priority_focus : [];
  const gapsToAddress = Array.isArray(plan.gaps_to_address) ? plan.gaps_to_address : [];

  const html = `
    <div class="bg-white border border-slate-200 rounded-lg p-3">
      <h3 class="text-[12px] font-semibold text-slate-900 mb-2">📅 Next Session Plan</h3>

      ${priorityFocus.length > 0 ? `
        <div class="mb-3">
          <h4 class="text-[11px] font-semibold text-slate-700 mb-1">Priority Focus Areas</h4>
          <ul class="list-disc list-inside text-[12px] text-slate-700 space-y-0.5">
            ${priorityFocus.map(item => `<li>${escapeHtml(item)}</li>`).join('')}
          </ul>
        </div>
      ` : ''}

      ${gapsToAddress.length > 0 ? `
        <div class="mb-3">
          <h4 class="text-[11px] font-semibold text-slate-700 mb-1">Gaps to Address</h4>
          <ul class="list-disc list-inside text-[12px] text-slate-700 space-y-0.5">
            ${gapsToAddress.map(item => `<li>${escapeHtml(item)}</li>`).join('')}
          </ul>
        </div>
      ` : ''}
    </div>

    ${segments.length > 0 ? `
      <div class="bg-white border border-slate-200 rounded-lg p-3 mt-3">
        <h3 class="text-[12px] font-semibold text-slate-900 mb-2">⏱ Session Segments</h3>
        <div class="overflow-x-auto">
          <table class="w-full text-left text-[12px]">
            <thead>
              <tr class="border-b border-slate-200">
                <th class="py-1.5 px-2 text-[9px] text-slate-500 uppercase">Segment</th>
                <th class="py-1.5 px-2 text-[9px] text-slate-500 uppercase">Duration</th>
                <th class="py-1.5 px-2 text-[9px] text-slate-500 uppercase">Plan</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-200">
              ${segments.map(seg => `
                <tr>
                  <td class="py-1.5 px-2"><strong>${escapeHtml(seg.segment || 'N/A')}</strong></td>
                  <td class="py-1.5 px-2">${escapeHtml(seg.duration || '-')}</td>
                  <td class="py-1.5 px-2">${escapeHtml(seg.plan || '-')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    ` : ''}
  `;

  content.innerHTML = html;
}

function showEmpty(message) {
  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="text-center py-8">
      <p class="text-lg text-slate-500">📋</p>
      <p class="text-[12px] text-slate-500 mt-2">No Next Session Plan Available</p>
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