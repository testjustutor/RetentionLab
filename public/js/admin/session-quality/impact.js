/**
 * Learning Impact Page
 * Displays impact areas with evidence and learning level assessment
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
  if (pageTitle) pageTitle.textContent = 'Learning Impact';
  if (pageDescription) pageDescription.textContent = 'Impact areas with evidence and learning level assessment';
  
  SessionQualityFilters.onGetData((sessionId, filters) => {
    loadImpactData(sessionId);
  });

  await SessionQualityFilters.init('filters-container');
  
  // Show initial prompt
  showEmpty('Select filters and click "Get Data" to view learning impact');
})();

async function loadImpactData(sessionId) {
  const content = document.getElementById('content');
  content.innerHTML = '<p class="text-[12px] text-slate-500">Loading learning impact data...</p>';

  try {
    const response = await apiFetch('/api/tutoring/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_internal_id: sessionId })
    });
    const data = response.data || response;
    const rawImpact = data.impact || {};
    // Backend returns { impact_areas: [...] }, normalize to flat array
    const impact = Array.isArray(rawImpact) ? rawImpact : (rawImpact.impact_areas || []);

    if (!impact || impact.length === 0) {
      showEmpty('No learning impact data available for this session');
      return;
    }

    renderImpact(impact);
  } catch (e) {
    console.error('Failed to load impact:', e);
    content.innerHTML = `<p class="text-[12px] text-red-600">Error loading impact: ${e.message}</p>`;
  }
}

function renderImpact(impact) {
  const content = document.getElementById('content');

  const html = `
    <div class="bg-white border border-slate-200 rounded-lg p-3">
      <h3 class="text-[12px] font-semibold text-slate-900 mb-2">Learning Impact Areas</h3>
      <div class="overflow-x-auto">
        <table class="w-full text-left text-[12px]">
          <thead>
            <tr class="border-b border-slate-200">
              <th class="py-1.5 px-2 text-[9px] text-slate-500 uppercase">Impact Area</th>
              <th class="py-1.5 px-2 text-[9px] text-slate-500 uppercase">Level</th>
              <th class="py-1.5 px-2 text-[9px] text-slate-500 uppercase">Observation</th>
              <th class="py-1.5 px-2 text-[9px] text-slate-500 uppercase">Evidence</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-200">
            ${impact.map(item => `
              <tr>
                <td class="py-1.5 px-2"><strong>${escapeHtml(item.impact_area || item.area || 'General')}</strong></td>
                <td class="py-1.5 px-2">
                  <span class="text-[11px] font-medium ${getLevelColorClass(item.impact_level || item.level)}">
                    ${escapeHtml(item.impact_level || item.level || 'N/A')}
                  </span>
                </td>
                <td class="py-1.5 px-2">${escapeHtml(item.observation || item.description || '-')}</td>
                <td class="py-1.5 px-2">${escapeHtml(item.evidence || '-')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  content.innerHTML = html;
}

function getLevelColorClass(level) {
  if (!level) return 'text-slate-500';
  const lower = level.toLowerCase();
  if (lower.includes('high') || lower.includes('strong') || lower.includes('excellent')) return 'text-emerald-700';
  if (lower.includes('medium') || lower.includes('moderate') || lower.includes('partial')) return 'text-amber-700';
  if (lower.includes('low') || lower.includes('weak') || lower.includes('poor')) return 'text-red-600';
  return 'text-blue-600';
}

function showEmpty(message) {
  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="text-center py-8">
      <p class="text-lg text-slate-500">🎯</p>
      <p class="text-[12px] text-slate-500 mt-2">No Impact Data Available</p>
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