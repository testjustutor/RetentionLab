/**
 * Quality Flags Page
 * Displays flagged issues with severity, evidence, and recommended fixes
 */

let currentMeetingId = null;

(async () => {
  await getMeetingId();
  if (currentMeetingId) {
    await loadFlags();
  } else {
    showEmpty('No meeting selected');
  }
})();

async function getMeetingId() {
  const params = new URLSearchParams(window.location.search);
  currentMeetingId = params.get('meetingId');
  
  if (!currentMeetingId) {
    const select = document.getElementById('meetingSelect');
    if (select && select.value) {
      currentMeetingId = select.value;
    }
  }
}

async function loadFlags() {
  const content = document.getElementById('content');
  content.innerHTML = '<div class="message message-loading">Loading quality flags...</div>';
  
  try {
    const data = await apiFetch(`/api/tutoring/report/${encodeURIComponent(currentMeetingId)}`);
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
    content.innerHTML = `<div class="message message-error">Error loading flags: ${e.message}</div>`;
  }
}

function renderFlags(flags) {
  const content = document.getElementById('content');
  
  const html = `
    <div class="card">
      <div class="card-header">
        <h2 class="card-title">Quality Flags</h2>
      </div>
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Flag</th>
              <th>Severity</th>
              <th>Evidence</th>
              <th>Recommended Fix</th>
            </tr>
          </thead>
          <tbody>
            ${flags.map(flag => `
              <tr>
                <td><strong>${escapeHtml(flag.flag_description || flag.description || 'Flag')}</strong></td>
                <td>
                  <span class="badge ${getSeverityBadgeClass(flag.severity)}">
                    ${escapeHtml(flag.severity || 'N/A')}
                  </span>
                </td>
                <td>${escapeHtml(flag.evidence || '-')}</td>
                <td>${escapeHtml(flag.recommended_fix || flag.recommendation || '-')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
  
  content.innerHTML = html;
}

function getSeverityBadgeClass(severity) {
  if (!severity) return 'badge-neutral';
  const lower = severity.toLowerCase();
  if (lower.includes('high') || lower.includes('critical')) return 'badge-danger';
  if (lower.includes('medium') || lower.includes('moderate')) return 'badge-warning';
  if (lower.includes('low') || lower.includes('minor')) return 'badge-info';
  return 'badge-neutral';
}

function showEmpty(message) {
  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="empty-state">
      <div class="empty-state-icon">🚩</div>
      <div class="empty-state-title">No Quality Flags Available</div>
      <div class="empty-state-description">${escapeHtml(message)}</div>
    </div>
  `;
}

function escapeHtml(s) {
  if (!s) return '';
  const div = document.createElement('div');
  div.textContent = String(s);
  return div.innerHTML;
}