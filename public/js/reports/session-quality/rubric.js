/**
 * Rubric Evaluation Page
 * Displays full scored rubric table with domain groupings, criteria, ratings, and evidence
 */

let currentMeetingId = null;

(async () => {
  await getMeetingId();
  if (currentMeetingId) {
    await loadRubricData();
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

async function loadRubricData() {
  const content = document.getElementById('content');
  content.innerHTML = '<div class="message message-loading">Loading rubric evaluation...</div>';
  
  try {
    const data = await apiFetch(`/api/tutoring/report/${encodeURIComponent(currentMeetingId)}`);
    const report = data.report || {};
    
    if (!report || Object.keys(report).length === 0) {
      showEmpty('No rubric data available for this session');
      return;
    }
    
    renderRubric(report);
  } catch (e) {
    console.error('Failed to load rubric:', e);
    content.innerHTML = `<div class="message message-error">Error loading rubric: ${e.message}</div>`;
  }
}

function renderRubric(report) {
  const content = document.getElementById('content');
  
  // Build snapshot cards
  const snapshotHtml = `
    <div class="snapshot-grid">
      <div class="snap-card">
        <div class="snap-card-label">Overall Score</div>
        <div class="snap-card-value">${report.percentage_score || 'N/A'}%</div>
      </div>
      <div class="snap-card">
        <div class="snap-card-label">Rating</div>
        <div class="snap-card-value">${report.overall_rating || 'N/A'}</div>
      </div>
      <div class="snap-card">
        <div class="snap-card-label">Student Engagement</div>
        <div class="snap-card-value">${report.student_engagement || 'N/A'}</div>
      </div>
      <div class="snap-card">
        <div class="snap-card-label">Learning Impact</div>
        <div class="snap-card-value">${report.learning_impact || 'N/A'}</div>
      </div>
    </div>
  `;
  
  // Build rubric categories table
  let rubricHtml = '';
  if (report.rubric_categories && report.rubric_categories.length > 0) {
    rubricHtml = `
      <div class="card">
        <div class="card-header">
          <h2 class="card-title">Rubric Categories</h2>
        </div>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Score</th>
                <th>Max Score</th>
                <th>Percentage</th>
                <th>Evidence</th>
              </tr>
            </thead>
            <tbody>
              ${report.rubric_categories.map(cat => `
                <tr>
                  <td><strong>${escapeHtml(cat.category_name || cat.category)}</strong></td>
                  <td>${cat.score || 0}</td>
                  <td>${cat.max_score || 5}</td>
                  <td>
                    <span class="badge ${getScoreBadgeClass(cat.score, cat.max_score)}">
                      ${cat.max_score ? Math.round((cat.score / cat.max_score) * 100) : 0}%
                    </span>
                  </td>
                  <td>${escapeHtml(cat.evidence || cat.notes || 'No evidence')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }
  
  // Build indicators table
  let indicatorsHtml = '';
  if (report.indicators && report.indicators.length > 0) {
    indicatorsHtml = `
      <div class="card">
        <div class="card-header">
          <h2 class="card-title">Detailed Indicators</h2>
        </div>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Indicator</th>
                <th>Category</th>
                <th>Score</th>
                <th>Max</th>
                <th>Evidence</th>
              </tr>
            </thead>
            <tbody>
              ${report.indicators.map(ind => `
                <tr>
                  <td>${escapeHtml(ind.indicator_name || ind.name)}</td>
                  <td>${escapeHtml(ind.category_name || '-')}</td>
                  <td><strong>${ind.score || 0}</strong></td>
                  <td>${ind.max_score || 5}</td>
                  <td>${escapeHtml(ind.evidence || ind.notes || 'No evidence')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }
  
  // Executive summary
  const summaryHtml = report.executive_summary ? `
    <div class="card">
      <div class="card-header">
        <h2 class="card-title">Executive Summary</h2>
      </div>
      <p style="line-height: 1.7; color: var(--text-primary);">${escapeHtml(report.executive_summary)}</p>
    </div>
  ` : '';
  
  content.innerHTML = snapshotHtml + summaryHtml + rubricHtml + indicatorsHtml;
}

function showEmpty(message) {
  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="empty-state">
      <div class="empty-state-icon">📊</div>
      <div class="empty-state-title">No Data Available</div>
      <div class="empty-state-description">${escapeHtml(message)}</div>
    </div>
  `;
}

function getScoreBadgeClass(score, max) {
  if (!max) return 'badge-neutral';
  const pct = (score / max) * 100;
  if (pct >= 80) return 'badge-success';
  if (pct >= 60) return 'badge-info';
  if (pct >= 40) return 'badge-warning';
  return 'badge-danger';
}

function formatDate(d) {
  if (!d) return 'N/A';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function escapeHtml(s) {
  if (!s) return '';
  const div = document.createElement('div');
  div.textContent = String(s);
  return div.innerHTML;
}