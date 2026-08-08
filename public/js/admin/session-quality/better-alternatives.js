/**
 * Better Alternatives Page
 * Displays situation, current approach, better alternative, and purpose table
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
  if (pageTitle) pageTitle.textContent = 'Better Alternatives';
  if (pageDescription) pageDescription.textContent = 'Alternative teaching approaches and strategies';
  
  SessionQualityFilters.onGetData((sessionId, filters) => {
    loadBetterAlternatives(sessionId);
  });

  await SessionQualityFilters.init('filters-container');
  
  // Show initial prompt
  showEmpty('Select filters and click "Get Data" to view better alternatives');
})();

async function loadBetterAlternatives(sessionId) {
  const content = document.getElementById('content');
  content.innerHTML = '<p class="text-[12px] text-slate-500">Loading better alternatives...</p>';

  try {
    const response = await apiFetch('/api/admin/tutoring/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_internal_id: sessionId })
    });
    const data = response.data || response;
    const rawAlternatives = data.betterAlternatives || {};
    // Backend returns { items: [...] }, normalize to flat array
    const alternatives = Array.isArray(rawAlternatives) ? rawAlternatives : (rawAlternatives.items || []);

    if (!alternatives || alternatives.length === 0) {
      showEmpty('No better alternatives available for this session');
      return;
    }

    renderAlternatives(alternatives);
  } catch (e) {
    console.error('Failed to load better alternatives:', e);
    content.innerHTML = `<p class="text-[12px] text-red-600">Error loading better alternatives: ${e.message}</p>`;
  }
}

function renderAlternatives(alternatives) {
  const content = document.getElementById('content');

  const html = `
    <div class="bg-white border border-slate-200 rounded-lg p-3">
      <h3 class="text-[12px] font-semibold text-slate-900 mb-2">Better Teaching Alternatives</h3>
      <div class="overflow-x-auto">
        <table class="w-full text-left text-[12px]">
          <thead>
            <tr class="border-b border-slate-200">
              <th class="py-1.5 px-2 text-[9px] text-slate-500 uppercase">Situation</th>
              <th class="py-1.5 px-2 text-[9px] text-slate-500 uppercase">Current Approach</th>
              <th class="py-1.5 px-2 text-[9px] text-slate-500 uppercase">Better Alternative</th>
              <th class="py-1.5 px-2 text-[9px] text-slate-500 uppercase">Purpose</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-200">
            ${alternatives.map(item => `
              <tr>
                <td class="py-1.5 px-2"><strong>${escapeHtml(item.situation || item.transcript_situation || 'N/A')}</strong></td>
                <td class="py-1.5 px-2">${escapeHtml(item.current_approach || 'N/A')}</td>
                <td class="py-1.5 px-2 text-emerald-700 font-medium">${escapeHtml(item.better_alternative || 'N/A')}</td>
                <td class="py-1.5 px-2">${escapeHtml(item.purpose || 'N/A')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  content.innerHTML = html;
}

function showEmpty(message) {
  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="text-center py-8">
      <p class="text-lg text-slate-500">💡</p>
      <p class="text-[12px] text-slate-500 mt-2">No Better Alternatives Available</p>
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