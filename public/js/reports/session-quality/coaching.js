/**
 * Coaching Feedback Page
 * Displays strengths and areas to improve for tutor/coach audience
 */

let currentMeetingId = null;

(async () => {
  await getMeetingId();
  if (currentMeetingId) {
    await loadCoachingData();
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

async function loadCoachingData() {
  const content = document.getElementById('content');
  content.innerHTML = '<div class="message message-loading">Loading coaching feedback...</div>';
  
  try {
    const data = await apiFetch(`/api/tutoring/report/${encodeURIComponent(currentMeetingId)}`);
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
    content.innerHTML = `<div class="message message-error">Error loading coaching: ${e.message}</div>`;
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
      <div class="card" style="border-left: 4px solid var(--success);">
        <div class="card-header">
          <h2 class="card-title" style="color: var(--success);">✓ Strengths</h2>
        </div>
        <div class="space-y-3">
          ${strengths.map(item => `
            <div style="padding: 1rem; background: var(--bg-primary); border-radius: 6px;">
              <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 0.5rem;">${escapeHtml(item.area || item.title || 'Strength')}</div>
              ${item.evidence ? `<div style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 0.5rem;"><strong>Evidence:</strong> ${escapeHtml(item.evidence)}</div>` : ''}
              ${item.why_it_matters ? `<div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.5rem;"><strong>Why it matters:</strong> ${escapeHtml(item.why_it_matters)}</div>` : ''}
              ${item.recommended_action ? `<div style="font-size: 0.85rem; color: var(--success);"><strong>Recommended action:</strong> ${escapeHtml(item.recommended_action)}</div>` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }
  
  // Areas to Improve
  if (improvements.length > 0) {
    html += `
      <div class="card" style="border-left: 4px solid var(--warning);">
        <div class="card-header">
          <h2 class="card-title" style="color: var(--warning);">⚠ Areas to Improve</h2>
        </div>
        <div class="space-y-3">
          ${improvements.map(item => `
            <div style="padding: 1rem; background: var(--bg-primary); border-radius: 6px;">
              <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 0.5rem;">${escapeHtml(item.area || item.title || 'Area for Growth')}</div>
              ${item.evidence ? `<div style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 0.5rem;"><strong>Evidence:</strong> ${escapeHtml(item.evidence)}</div>` : ''}
              ${item.why_it_matters ? `<div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.5rem;"><strong>Why it matters:</strong> ${escapeHtml(item.why_it_matters)}</div>` : ''}
              ${item.recommended_action ? `<div style="font-size: 0.85rem; color: var(--warning);"><strong>Recommended action:</strong> ${escapeHtml(item.recommended_action)}</div>` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }
  
  // If no categorized items, show all as generic list
  if (strengths.length === 0 && improvements.length === 0) {
    html = `
      <div class="card">
        <div class="card-header">
          <h2 class="card-title">Coaching Feedback</h2>
        </div>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Area</th>
                <th>Type</th>
                <th>Evidence</th>
                <th>Recommended Action</th>
              </tr>
            </thead>
            <tbody>
              ${coaching.map(item => `
                <tr>
                  <td><strong>${escapeHtml(item.area || item.title || '-')}</strong></td>
                  <td><span class="badge badge-info">${escapeHtml(item.feedback_type || 'General')}</span></td>
                  <td>${escapeHtml(item.evidence || '-')}</td>
                  <td>${escapeHtml(item.recommended_action || '-')}</td>
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
    <div class="empty-state">
      <div class="empty-state-icon">🎯</div>
      <div class="empty-state-title">No Coaching Feedback Available</div>
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