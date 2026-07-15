/**
 * Quality Flags Page
 * Displays flagged issues with severity, evidence, and recommended fixes
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
  if (pageTitle) pageTitle.textContent = 'Quality Flags';
  if (pageDescription) pageDescription.textContent = 'Flagged issues with severity, evidence, and recommended fixes';
  
  SessionQualityFilters.onGetData((sessionId, filters) => {
    loadFlags(sessionId);
  });

  await SessionQualityFilters.init('filters-container');
  
  // Show initial prompt
  showEmpty('Select filters and click "Get Data" to view quality flags');
})();

async function loadFlags(sessionId) {
  const content = document.getElementById('content');
  content.innerHTML = '<p class="text-[12px] text-slate-500">Loading quality flags...</p>';

  try {
    const response = await apiFetch('/api/tutoring/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_internal_id: sessionId })
    });
    const data = response.data || response;
    const rawFlags = data.flags || {};
    // Backend returns { flags: [...] }, normalize to flat array
    const flags = Array.isArray(rawFlags) ? rawFlags : (rawFlags.flags || []);

    if (!flags || flags.length === 0) {
      showEmpty('No quality flags available for this session');
      return;
    }

    renderFlags(flags);
  } catch (e) {
    console.error('Failed to load flags:', e);
    content.innerHTML = `<p class="text-[12px] text-red-600">Error loading flags: ${e.message}</p>`;
  }
}

function renderFlags(flags) {
  const content = document.getElementById('content');

  const html = `
    <div class="bg-white border border-slate-200 rounded-lg p-3">
      <h3 class="text-[12px] font-semibold text-slate-900 mb-2">Quality Flags</h3>
      <div class="overflow-x-auto">
        <table class="w-full text-left text-[12px]">
          <thead>
            <tr class="border-b border-slate-200">
              <th class="py-1.5 px-2 text-[9px] text-slate-500 uppercase">Flag</th>
              <th class="py-1.5 px-2 text-[9px] text-slate-500 uppercase">Severity</th>
              <th class="py-1.5 px-2 text-[9px] text-slate-500 uppercase">Evidence</th>
              <th class="py-1.5 px-2 text-[9px] text-slate-500 uppercase">Recommended Fix</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-200">
            ${flags.map(flag => `
              <tr>
                <td class="py-1.5 px-2"><strong>${escapeHtml(flag.flag_description || flag.description || 'Flag')}</strong></td>
                <td class="py-1.5 px-2">
                  <span class="text-[11px] font-medium ${getSeverityColorClass(flag.severity)}">
                    ${escapeHtml(flag.severity || 'N/A')}
                  </span>
                </td>
                <td class="py-1.5 px-2">${escapeHtml(flag.evidence || '-')}</td>
                <td class="py-1.5 px-2">${escapeHtml(flag.recommended_fix || flag.recommendation || '-')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  content.innerHTML = html;
}

function getSeverityColorClass(severity) {
  if (!severity) return 'text-slate-500';
  const lower = severity.toLowerCase();
  if (lower.includes('high') || lower.includes('critical')) return 'text-red-600';
  if (lower.includes('medium') || lower.includes('moderate')) return 'text-amber-700';
  if (lower.includes('low') || lower.includes('minor')) return 'text-blue-600';
  return 'text-slate-500';
}

function showEmpty(message) {
  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="text-center py-8">
      <p class="text-lg text-slate-500">🚩</p>
      <p class="text-[12px] text-slate-500 mt-2">No Quality Flags Available</p>
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