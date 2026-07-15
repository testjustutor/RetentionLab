/**
 * Next Session Plan Page
 * Displays time-blocked plan with priority focus and gaps to address
 */

let currentMeetingId = null;

(async () => {
  await getMeetingId();
  if (currentMeetingId) {
    await loadNextPlan();
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

async function loadNextPlan() {
  const content = document.getElementById('content');
  content.innerHTML = '<div class="message message-loading">Loading next session plan...</div>';
  
  try {
    const data = await apiFetch(`/api/tutoring/report/${encodeURIComponent(currentMeetingId)}`);
    const nextPlan = data.nextPlan || {};
    
    if (!nextPlan || Object.keys(nextPlan).length === 0) {
      showEmpty('No next session plan available for this session');
      return;
    }
    
    renderNextPlan(nextPlan);
  } catch (e) {
    console.error('Failed to load next plan:', e);
    content.innerHTML = `<div class="message message-error">Error loading next plan: ${e.message}</div>`;
  }
}

function renderNextPlan(plan) {
  const content = document.getElementById('content');
  
  // Backend stores: segments [{segment, duration, plan}], priority_focus [...], gaps_to_address [...]
  const segments = Array.isArray(plan.segments) ? plan.segments : [];
  const priorityFocus = Array.isArray(plan.priority_focus) ? plan.priority_focus : [];
  const gapsToAddress = Array.isArray(plan.gaps_to_address) ? plan.gaps_to_address : [];
  
  const html = `
    <div class="card" style="border-left: 4px solid var(--info);">
      <div class="card-header">
        <h2 class="card-title" style="color: var(--info);">📅 Next Session Plan</h2>
      </div>
      
      ${priorityFocus.length > 0 ? `
        <div style="margin-bottom: 1rem;">
          <h4 style="font-size: 0.9rem; font-weight: 600; color: var(--text-primary); margin-bottom: 0.5rem;">Priority Focus Areas</h4>
          <ul style="margin: 0; padding-left: 1.5rem; color: var(--text-secondary); line-height: 1.8;">
            ${priorityFocus.map(item => `<li>${escapeHtml(item)}</li>`).join('')}
          </ul>
        </div>
      ` : ''}
      
      ${gapsToAddress.length > 0 ? `
        <div style="margin-bottom: 1rem;">
          <h4 style="font-size: 0.9rem; font-weight: 600; color: var(--text-primary); margin-bottom: 0.5rem;">Gaps to Address</h4>
          <ul style="margin: 0; padding-left: 1.5rem; color: var(--text-secondary); line-height: 1.8;">
            ${gapsToAddress.map(item => `<li>${escapeHtml(item)}</li>`).join('')}
          </ul>
        </div>
      ` : ''}
    </div>
    
    ${segments.length > 0 ? `
      <div class="card">
        <div class="card-header">
          <h2 class="card-title">⏱ Session Segments</h2>
        </div>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Segment</th>
                <th>Duration</th>
                <th>Plan</th>
              </tr>
            </thead>
            <tbody>
              ${segments.map(seg => `
                <tr>
                  <td><strong>${escapeHtml(seg.segment || 'N/A')}</strong></td>
                  <td>${escapeHtml(seg.duration || '-')}</td>
                  <td>${escapeHtml(seg.plan || '-')}</td>
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
    <div class="empty-state">
      <div class="empty-state-icon">📋</div>
      <div class="empty-state-title">No Next Session Plan Available</div>
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