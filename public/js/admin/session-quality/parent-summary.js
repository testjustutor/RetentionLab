/**
 * public/js/admin/session-quality/parent-summary.js
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
  if (pageTitle) pageTitle.textContent = 'Parent Summary';
  if (pageDescription) pageDescription.textContent = 'Plain-language session overview for parents';
  
  SessionQualityFilters.onGetData((sessionId, filters) => {
    loadParentSummary(sessionId);
  });

  await SessionQualityFilters.init('filters-container');
  
  // Show initial prompt
  showEmpty('Select filters and click "Get Data" to view parent summary');
})();

async function loadParentSummary(sessionId) {
  const content = document.getElementById('content');
  content.innerHTML = '<p class="text-[12px] text-slate-500">Loading parent summary...</p>';

  try {
    const response = await apiFetch('/api/admin/tutoring/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_internal_id: sessionId })
    });
    const data = response.data || response;
    const parentSummary = data.parentSummary || {};

    if (!parentSummary || Object.keys(parentSummary).length === 0) {
      showEmpty('No parent summary available for this session');
      return;
    }

    renderParentSummary(parentSummary);
  } catch (e) {
    console.error('Failed to load parent summary:', e);
    content.innerHTML = `<p class="text-[12px] text-red-600">Error loading parent summary: ${e.message}</p>`;
  }
}

function renderParentSummary(summary) {
  const content = document.getElementById('content');

  // Backend stores: covered_text, participation_text, progress_text, needs_practice_text, home_support_tips
  const homeTips = Array.isArray(summary.home_support_tips) ? summary.home_support_tips : [];

  const html = `
    <div class="bg-white border border-slate-200 rounded-lg p-3">
      <h3 class="text-[12px] font-semibold text-slate-900 mb-2">📋 Session Overview for Parents</h3>
      <div class="text-[12px] text-slate-700 leading-relaxed space-y-2">
        ${summary.covered_text ? `<p><strong>What We Covered:</strong> ${escapeHtml(summary.covered_text)}</p>` : ''}
        ${summary.participation_text ? `<p><strong>Student Participation:</strong> ${escapeHtml(summary.participation_text)}</p>` : ''}
        ${summary.progress_text ? `<p><strong>Progress Made:</strong> ${escapeHtml(summary.progress_text)}</p>` : ''}
        ${summary.needs_practice_text ? `<p><strong>Areas to Practice at Home:</strong> ${escapeHtml(summary.needs_practice_text)}</p>` : ''}
      </div>
    </div>

    ${homeTips.length > 0 ? `
      <div class="bg-white border border-slate-200 rounded-lg p-3 mt-3">
        <h3 class="text-[12px] font-semibold text-slate-900 mb-2">💡 Tips for Home Support</h3>
        <div class="space-y-2">
          ${homeTips.map(tip => `
            <div class="text-[12px] text-slate-700 p-2 border-l-2 border-blue-400">
              ${escapeHtml(tip)}
            </div>
          `).join('')}
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
      <p class="text-lg text-slate-500">👨‍👩‍👧</p>
      <p class="text-[12px] text-slate-500 mt-2">No Parent Summary Available</p>
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