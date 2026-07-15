/**
 * Parent Summary Page
 * Plain-language version for parent-facing view
 */

let currentMeetingId = null;

(async () => {
  await getMeetingId();
  if (currentMeetingId) {
    await loadParentSummary();
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

async function loadParentSummary() {
  const content = document.getElementById('content');
  content.innerHTML = '<div class="message message-loading">Loading parent summary...</div>';
  
  try {
    const data = await apiFetch(`/api/tutoring/report/${encodeURIComponent(currentMeetingId)}`);
    const parentSummary = data.parentSummary || {};
    
    if (!parentSummary || Object.keys(parentSummary).length === 0) {
      showEmpty('No parent summary available for this session');
      return;
    }
    
    renderParentSummary(parentSummary);
  } catch (e) {
    console.error('Failed to load parent summary:', e);
    content.innerHTML = `<div class="message message-error">Error loading parent summary: ${e.message}</div>`;
  }
}

function renderParentSummary(summary) {
  const content = document.getElementById('content');
  
  // Backend stores: covered_text, participation_text, progress_text, needs_practice_text, home_support_tips
  const homeTips = Array.isArray(summary.home_support_tips) ? summary.home_support_tips : [];
  
  const html = `
    <div class="card" style="background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border: 2px solid var(--info);">
      <div class="card-header">
        <h2 class="card-title" style="color: var(--info);">📋 Session Overview for Parents</h2>
      </div>
      <div style="line-height: 1.8; color: var(--text-primary);">
        ${summary.covered_text ? `<p style="margin-bottom: 1rem;"><strong>What We Covered:</strong> ${escapeHtml(summary.covered_text)}</p>` : ''}
        ${summary.participation_text ? `<p style="margin-bottom: 1rem;"><strong>Student Participation:</strong> ${escapeHtml(summary.participation_text)}</p>` : ''}
        ${summary.progress_text ? `<p style="margin-bottom: 1rem;"><strong>Progress Made:</strong> ${escapeHtml(summary.progress_text)}</p>` : ''}
        ${summary.needs_practice_text ? `<p style="margin-bottom: 1rem;"><strong>Areas to Practice at Home:</strong> ${escapeHtml(summary.needs_practice_text)}</p>` : ''}
      </div>
    </div>
    
    ${homeTips.length > 0 ? `
      <div class="card">
        <div class="card-header">
          <h2 class="card-title">💡 Tips for Home Support</h2>
        </div>
        <div class="space-y-2">
          ${homeTips.map(tip => `
            <div style="padding: 0.75rem; background: var(--bg-primary); border-radius: 6px; border-left: 3px solid var(--accent);">
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
    <div class="empty-state">
      <div class="empty-state-icon">👨‍👩‍👧</div>
      <div class="empty-state-title">No Parent Summary Available</div>
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