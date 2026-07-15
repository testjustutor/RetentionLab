/**
 * Better Alternatives Page
 * Displays situation → current approach → better alternative → purpose table
 */

let currentMeetingId = null;

(async () => {
  await getMeetingId();
  if (currentMeetingId) {
    await loadBetterAlternatives();
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

async function loadBetterAlternatives() {
  const content = document.getElementById('content');
  content.innerHTML = '<div class="message message-loading">Loading better alternatives...</div>';
  
  try {
    const data = await apiFetch(`/api/tutoring/report/${encodeURIComponent(currentMeetingId)}`);
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
    content.innerHTML = `<div class="message message-error">Error loading better alternatives: ${e.message}</div>`;
  }
}

function renderAlternatives(alternatives) {
  const content = document.getElementById('content');
  
  const html = `
    <div class="card">
      <div class="card-header">
        <h2 class="card-title">Better Teaching Alternatives</h2>
      </div>
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Situation</th>
              <th>Current Approach</th>
              <th>Better Alternative</th>
              <th>Purpose</th>
            </tr>
          </thead>
          <tbody>
            ${alternatives.map(item => `
              <tr>
                <td><strong>${escapeHtml(item.transcript_situation || item.situation || 'N/A')}</strong></td>
                <td>${escapeHtml(item.current_approach || 'N/A')}</td>
                <td style="color: var(--success); font-weight: 500;">${escapeHtml(item.better_alternative || 'N/A')}</td>
                <td>${escapeHtml(item.purpose || 'N/A')}</td>
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
    <div class="empty-state">
      <div class="empty-state-icon">💡</div>
      <div class="empty-state-title">No Better Alternatives Available</div>
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