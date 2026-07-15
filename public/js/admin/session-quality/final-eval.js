/**
 * Final Evaluation Page
 * Displays aggregated ratings and QA team narrative summary
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
  if (pageTitle) pageTitle.textContent = 'Final Evaluation';
  if (pageDescription) pageDescription.textContent = 'Aggregated ratings and QA team narrative summary';
  
  SessionQualityFilters.onGetData((sessionId, filters) => {
    loadFinalEvaluation(sessionId);
  });

  await SessionQualityFilters.init('filters-container');
  
  // Show initial prompt
  showEmpty('Select filters and click "Get Data" to view final evaluation');
})();

async function loadFinalEvaluation(sessionId) {
  const content = document.getElementById('content');
  content.innerHTML = '<p class="text-[12px] text-slate-500">Loading final evaluation...</p>';

  try {
    const response = await apiFetch('/api/tutoring/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_internal_id: sessionId })
    });
    const data = response.data || response;
    const finalEval = data.finalEval || {};

    if (!finalEval || Object.keys(finalEval).length === 0) {
      showEmpty('No final evaluation available for this session');
      return;
    }

    renderFinalEvaluation(finalEval);
  } catch (e) {
    console.error('Failed to load final evaluation:', e);
    content.innerHTML = `<p class="text-[12px] text-red-600">Error loading final evaluation: ${e.message}</p>`;
  }
}

function renderFinalEvaluation(eval) {
  const content = document.getElementById('content');

  // Backend stores: overall_session_rating, teacher_performance, student_engagement,
  // learning_impact, parent_communication_readiness, recommended_action, summary_narrative

  const html = `
    <div class="bg-white border border-slate-200 rounded-lg p-3">
      <h3 class="text-[12px] font-semibold text-slate-900 mb-2">✓ Final Evaluation</h3>
      <div class="text-[12px] text-slate-700 leading-relaxed space-y-2">
        ${eval.overall_session_rating ? `<p><strong>Overall Rating:</strong> <span class="text-emerald-700 font-medium">${escapeHtml(eval.overall_session_rating)}</span></p>` : ''}
        ${eval.summary_narrative ? `<p><strong>QA Team Summary:</strong> ${escapeHtml(eval.summary_narrative)}</p>` : ''}
        ${eval.recommended_action ? `<p><strong>Recommendation:</strong> ${escapeHtml(eval.recommended_action)}</p>` : ''}
      </div>
    </div>

    ${eval.teacher_performance || eval.student_engagement || eval.learning_impact ? `
      <div class="bg-white border border-slate-200 rounded-lg p-3 mt-3">
        <h3 class="text-[12px] font-semibold text-slate-900 mb-2">Detailed Ratings</h3>
        <div class="overflow-x-auto">
          <table class="w-full text-left text-[12px]">
            <thead>
              <tr class="border-b border-slate-200">
                <th class="py-1.5 px-2 text-[9px] text-slate-500 uppercase">Category</th>
                <th class="py-1.5 px-2 text-[9px] text-slate-500 uppercase">Rating</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-200">
              ${eval.teacher_performance ? `<tr><td class="py-1.5 px-2"><strong>Teacher Performance</strong></td><td class="py-1.5 px-2">${escapeHtml(eval.teacher_performance)}</td></tr>` : ''}
              ${eval.student_engagement ? `<tr><td class="py-1.5 px-2"><strong>Student Engagement</strong></td><td class="py-1.5 px-2">${escapeHtml(eval.student_engagement)}</td></tr>` : ''}
              ${eval.learning_impact ? `<tr><td class="py-1.5 px-2"><strong>Learning Impact</strong></td><td class="py-1.5 px-2">${escapeHtml(eval.learning_impact)}</td></tr>` : ''}
              ${eval.parent_communication_readiness ? `<tr><td class="py-1.5 px-2"><strong>Parent Communication Readiness</strong></td><td class="py-1.5 px-2">${escapeHtml(eval.parent_communication_readiness)}</td></tr>` : ''}
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
      <p class="text-lg text-slate-500">🏆</p>
      <p class="text-[12px] text-slate-500 mt-2">No Final Evaluation Available</p>
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