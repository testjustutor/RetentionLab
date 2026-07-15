/**
 * Learning Impact Page
 * Displays impact areas with evidence and learning level assessment
 */

let currentMeetingId = null;

(async () => {
  await getMeetingId();
  if (currentMeetingId) {
    await loadImpactData();
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

async function loadImpactData() {
  const content = document.getElementById('content');
  content.innerHTML = '<div class="message message-loading">Loading learning impact data...</div>';
  
  try {
    const data = await apiFetch(`/api/tutoring/report/${encodeURIComponent(currentMeetingId)}`);
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
    content.innerHTML = `<div class="message message-error">Error loading impact: ${e.message}</div>`;
  }
}

function renderImpact(impact) {
  const content = document.getElementById('content');
  
  const html = `
    <div class="card">
      <div class="card-header">
        <h2 class="card-title">Learning Impact Areas</h2>
      </div>
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Impact Area</th>
              <th>Level</th>
              <th>Observation</th>
              <th>Evidence</th>
            </tr>
          </thead>
          <tbody>
            ${impact.map(item => `
              <tr>
                <td><strong>${escapeHtml(item.impact_area || item.area || 'General')}</strong></td>
                <td>
                  <span class="badge ${getLevelBadgeClass(item.impact_level || item.level)}">
                    ${escapeHtml(item.impact_level || item.level || 'N/A')}
                  </span>
                </td>
                <td>${escapeHtml(item.observation || item.description || '-')}</td>
                <td>${escapeHtml(item.evidence || '-')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
  
  content.innerHTML = html;
}

function getLevelBadgeClass(level) {
  if (!level) return 'badge-neutral';
  const lower = level.toLowerCase();
  if (lower.includes('high') || lower.includes('strong') || lower.includes('excellent')) return 'badge-success';
  if (lower.includes('medium') || lower.includes('moderate') || lower.includes('partial')) return 'badge-warning';
  if (lower.includes('low') || lower.includes('weak') || lower.includes('poor')) return 'badge-danger';
  return 'badge-info';
}

function showEmpty(message) {
  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="empty-state">
      <div class="empty-state-icon">🎯</div>
      <div class="empty-state-title">No Impact Data Available</div>
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