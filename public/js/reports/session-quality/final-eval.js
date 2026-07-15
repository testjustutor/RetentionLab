/**
 * Final Evaluation Page
 * Displays aggregated ratings and QA team narrative summary
 */

let currentMeetingId = null;

(async () => {
  await getMeetingId();
  if (currentMeetingId) {
    await loadFinalEvaluation();
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

async function loadFinalEvaluation() {
  const content = document.getElementById('content');
  content.innerHTML = '<div class="message message-loading">Loading final evaluation...</div>';
  
  try {
    const data = await apiFetch(`/api/tutoring/report/${encodeURIComponent(currentMeetingId)}`);
    const finalEval = data.finalEval || {};
    
    if (!finalEval || Object.keys(finalEval).length === 0) {
      showEmpty('No final evaluation available for this session');
      return;
    }
    
    renderFinalEvaluation(finalEval);
  } catch (e) {
    console.error('Failed to load final evaluation:', e);
    content.innerHTML = `<div class="message message-error">Error loading final evaluation: ${e.message}</div>`;
  }
}

function renderFinalEvaluation(eval) {
  const content = document.getElementById('content');
  
  // Backend stores: overall_session_rating, teacher_performance, student_engagement,
  // learning_impact, parent_communication_readiness, recommended_action, summary_narrative
  
  const html = `
    <div class="card" style="border-left: 4px solid var(--success);">
      <div class="card-header">
        <h2 class="card-title" style="color: var(--success);">✓ Final Evaluation Summary</h2>
      </div>
      <div style="line-height: 1.8; color: var(--text-primary);">
        ${eval.overall_session_rating ? `<p style="margin-bottom: 1rem;"><strong>Overall Rating:</strong> <span class="badge badge-success">${escapeHtml(eval.overall_session_rating)}</span></p>` : ''}
        ${eval.summary_narrative ? `<p style="margin-bottom: 1rem;"><strong>QA Team Summary:</strong> ${escapeHtml(eval.summary_narrative)}</p>` : ''}
        ${eval.recommended_action ? `<p style="margin-bottom: 1rem;"><strong>Recommendation:</strong> ${escapeHtml(eval.recommended_action)}</p>` : ''}
      </div>
    </div>
    
    ${eval.teacher_performance || eval.student_engagement || eval.learning_impact ? `
      <div class="card">
        <div class="card-header">
          <h2 class="card-title">Detailed Ratings</h2>
        </div>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Rating</th>
              </tr>
            </thead>
            <tbody>
              ${eval.teacher_performance ? `<tr><td><strong>Teacher Performance</strong></td><td>${escapeHtml(eval.teacher_performance)}</td></tr>` : ''}
              ${eval.student_engagement ? `<tr><td><strong>Student Engagement</strong></td><td>${escapeHtml(eval.student_engagement)}</td></tr>` : ''}
              ${eval.learning_impact ? `<tr><td><strong>Learning Impact</strong></td><td>${escapeHtml(eval.learning_impact)}</td></tr>` : ''}
              ${eval.parent_communication_readiness ? `<tr><td><strong>Parent Communication Readiness</strong></td><td>${escapeHtml(eval.parent_communication_readiness)}</td></tr>` : ''}
            </tbody>
          </table>
        </div>
      </div>
    ` : ''}
  `;
  
  content.innerHTML = html;
}

function getRatingBadgeClass(score, max) {
  if (!max) return 'badge-neutral';
  const pct = (score / max) * 100;
  if (pct >= 80) return 'badge-success';
  if (pct >= 60) return 'badge-info';
  if (pct >= 40) return 'badge-warning';
  return 'badge-danger';
}

function showEmpty(message) {
  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="empty-state">
      <div class="empty-state-icon">🏆</div>
      <div class="empty-state-title">No Final Evaluation Available</div>
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