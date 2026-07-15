/**
 * Session Analysis Page
 * Displays what worked well, needs improvement, and missed opportunities
 */

let currentMeetingId = null;

(async () => {
  await getMeetingId();
  if (currentMeetingId) {
    await loadAnalysisData();
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

async function loadAnalysisData() {
  const content = document.getElementById('content');
  content.innerHTML = '<div class="message message-loading">Loading session analysis...</div>';
  
  try {
    const data = await apiFetch(`/api/tutoring/report/${encodeURIComponent(currentMeetingId)}`);
    const rawAnalysis = data.analysis || {};
    
    // Backend returns a row with what_worked_well, what_needs_improvement, missed_opportunities
    // as JSON arrays. Normalize to the flat array format renderAnalysis expects.
    let analysis = [];
    if (Array.isArray(rawAnalysis)) {
      analysis = rawAnalysis;
    } else {
      const workedWell = (rawAnalysis.what_worked_well || []).map(item => ({
        ...item,
        analysis_type: 'worked_well'
      }));
      const needsImprovement = (rawAnalysis.what_needs_improvement || []).map(item => ({
        ...item,
        analysis_type: 'needs_improvement'
      }));
      const missedOpportunities = (rawAnalysis.missed_opportunities || []).map(item => ({
        ...item,
        analysis_type: 'missed_opportunity'
      }));
      analysis = [...workedWell, ...needsImprovement, ...missedOpportunities];
    }
    
    if (!analysis || analysis.length === 0) {
      showEmpty('No analysis data available for this session');
      return;
    }
    
    renderAnalysis(analysis);
  } catch (e) {
    console.error('Failed to load analysis:', e);
    content.innerHTML = `<div class="message message-error">Error loading analysis: ${e.message}</div>`;
  }
}

function renderAnalysis(analysis) {
  const content = document.getElementById('content');
  
  // Group by analysis type
  const workedWell = analysis.filter(a => a.analysis_type === 'worked_well' || a.analysis_type === 'strength');
  const needsImprovement = analysis.filter(a => a.analysis_type === 'needs_improvement' || a.analysis_type === 'weakness');
  const missedOpportunities = analysis.filter(a => a.analysis_type === 'missed_opportunity' || a.analysis_type === 'opportunity');
  
  let html = '';
  
  // What Worked Well
  if (workedWell.length > 0) {
    html += `
      <div class="card" style="border-left: 4px solid var(--success);">
        <div class="card-header">
          <h2 class="card-title" style="color: var(--success);">✓ What Worked Well</h2>
        </div>
        <div class="space-y-3">
          ${workedWell.map(item => `
            <div style="padding: 1rem; background: var(--bg-primary); border-radius: 6px;">
              <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 0.5rem;">${escapeHtml(item.description || item.title || 'Strength')}</div>
              ${item.evidence ? `<div style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 0.5rem;"><strong>Evidence:</strong> ${escapeHtml(item.evidence)}</div>` : ''}
              ${item.impact ? `<div style="font-size: 0.85rem; color: var(--text-secondary);"><strong>Impact:</strong> ${escapeHtml(item.impact)}</div>` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }
  
  // Needs Improvement
  if (needsImprovement.length > 0) {
    html += `
      <div class="card" style="border-left: 4px solid var(--warning);">
        <div class="card-header">
          <h2 class="card-title" style="color: var(--warning);">⚠ Needs Improvement</h2>
        </div>
        <div class="space-y-3">
          ${needsImprovement.map(item => `
            <div style="padding: 1rem; background: var(--bg-primary); border-radius: 6px;">
              <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 0.5rem;">${escapeHtml(item.description || item.title || 'Area for Growth')}</div>
              ${item.evidence ? `<div style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 0.5rem;"><strong>Evidence:</strong> ${escapeHtml(item.evidence)}</div>` : ''}
              ${item.recommendation ? `<div style="font-size: 0.85rem; color: var(--text-secondary);"><strong>Recommendation:</strong> ${escapeHtml(item.recommendation)}</div>` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }
  
  // Missed Opportunities
  if (missedOpportunities.length > 0) {
    html += `
      <div class="card" style="border-left: 4px solid var(--info);">
        <div class="card-header">
          <h2 class="card-title" style="color: var(--info);">ℹ Missed Opportunities</h2>
        </div>
        <div class="space-y-3">
          ${missedOpportunities.map(item => `
            <div style="padding: 1rem; background: var(--bg-primary); border-radius: 6px;">
              <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 0.5rem;">${escapeHtml(item.description || item.title || 'Opportunity')}</div>
              ${item.evidence ? `<div style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 0.5rem;"><strong>Context:</strong> ${escapeHtml(item.evidence)}</div>` : ''}
              ${item.suggested_approach ? `<div style="font-size: 0.85rem; color: var(--text-secondary);"><strong>Suggested Approach:</strong> ${escapeHtml(item.suggested_approach)}</div>` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }
  
  // If no categorized items, show all as generic list
  if (workedWell.length === 0 && needsImprovement.length === 0 && missedOpportunities.length === 0) {
    html = `
      <div class="card">
        <div class="card-header">
          <h2 class="card-title">Session Analysis</h2>
        </div>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Description</th>
                <th>Evidence</th>
              </tr>
            </thead>
            <tbody>
              ${analysis.map(item => `
                <tr>
                  <td><span class="badge badge-info">${escapeHtml(item.analysis_type || 'General')}</span></td>
                  <td>${escapeHtml(item.description || item.title || '-')}</td>
                  <td>${escapeHtml(item.evidence || '-')}</td>
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
      <div class="empty-state-icon">📝</div>
      <div class="empty-state-title">No Analysis Available</div>
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