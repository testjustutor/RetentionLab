/**
 * public/js/admin/reports/session-quality.js
 */

let currentMeetingId = new URLSearchParams(window.location.search).get('meeting_id');
const reportSections = [
  { id: 'rubric', title: 'Rubric-Based Evaluation' },
  { id: 'analysis', title: 'Evidence-Based Analysis' },
  { id: 'impact', title: 'Student Learning Impact' },
  { id: 'parentSummary', title: 'Parent-Friendly Summary' },
  { id: 'coaching', title: 'Teacher Coaching Feedback' },
  { id: 'betterAlternatives', title: 'Better Alternatives' },
  { id: 'nextPlan', title: 'Next Session Plan' },
  { id: 'qualityFlags', title: 'Quality Flags' },
  { id: 'finalEval', title: 'Final Evaluation' }
];

const messageEl = document.getElementById('pageMessage');
const snapshotEl = document.getElementById('snapshotSection');
const summaryEl = document.getElementById('summarySection');
const metadataEl = document.getElementById('metadataSection');
const sectionsEl = document.getElementById('reportSections');
const refreshBtn = document.getElementById('refreshBtn');
const downloadBtn = document.getElementById('downloadBtn');
const meetingSelect = document.getElementById('meetingSelect');

async function loadMeetings() {
  try {
    const data = await apiFetch('/api/admin/meetings/list?days=90');
    const meetings = data.meetings || [];
    meetingSelect.innerHTML = '<option value="">Select a meeting...</option>' +
      meetings.map(m => `<option value="${escapeAttr(m.id)}">${escapeAttr(m.title || 'Untitled')} - ${escapeAttr(m.start_time ? new Date(m.start_time).toLocaleDateString() : 'No date')}</option>`).join('');
    
    if (currentMeetingId) {
      meetingSelect.value = currentMeetingId;
    }
  } catch (e) {
    console.error('Failed to load meetings:', e);
    meetingSelect.innerHTML = '<option value="">Failed to load meetings</option>';
  }
}

meetingSelect?.addEventListener('change', () => {
  const selected = meetingSelect.value;
  if (selected) {
    currentMeetingId = selected;
    init();
  }
});

refreshBtn?.addEventListener('click', () => {
  if (currentMeetingId) init();
  else showMessage('Please select a meeting first', 'error');
});
downloadBtn?.addEventListener('click', () => {
  const html = document.documentElement.outerHTML;
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `session-quality-report-${currentMeetingId}.html`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

async function init() {
  showMessage('Loading session quality report...', 'info');
  snapshotEl.innerHTML = 'Fetching...';
  summaryEl.innerHTML = 'Fetching...';
  metadataEl.innerHTML = 'Fetching...';
  sectionsEl.innerHTML = '';

  try {
    const response = await apiFetch(`/api/admin/tutoring/report/${encodeURIComponent(currentMeetingId)}`);
    if (!response || response.error) {
      throw new Error(response?.error || 'No response');
    }

    renderReport(response);
    showMessage('Report loaded successfully.', 'success');
  } catch (err) {
    console.error('Failed to load report:', err);
    showMessage(`Unable to load report: ${err.message}`, 'error');
    snapshotEl.textContent = 'Unable to load session snapshot.';
    summaryEl.textContent = '';
    metadataEl.textContent = '';
  }
}

function renderReport(data) {
  const metadata = data.metadata || {};
  const report = data.report || {};

  snapshotEl.innerHTML = `
    <div class="space-y-2">
      <div><strong class="text-slate-100">Session ID</strong>: ${escape(metadata.meeting_id)}</div>
      <div><strong class="text-slate-100">Student</strong>: ${escape(metadata.student_name || 'N/A')}</div>
      <div><strong class="text-slate-100">Teacher</strong>: ${escape(metadata.teacher_user_id || 'N/A')}</div>
      <div><strong class="text-slate-100">Subject</strong>: ${escape(metadata.subject || 'N/A')}</div>
      <div><strong class="text-slate-100">Grade</strong>: ${escape(metadata.student_grade || 'N/A')}</div>
      <div><strong class="text-slate-100">Curriculum</strong>: ${escape(metadata.curriculum || 'N/A')}</div>
      <div><strong class="text-slate-100">Topic</strong>: ${escape(metadata.topic || 'N/A')}</div>
    </div>
  `;

  summaryEl.innerHTML = `
    <div class="space-y-2">
      <div><strong class="text-slate-100">Overall Score</strong>: ${escape(report.percentage_score ?? 'N/A')}%</div>
      <div><strong class="text-slate-100">Rating</strong>: ${escape(report.overall_rating || 'N/A')}</div>
      <div><strong class="text-slate-100">Student Engagement</strong>: ${escape(report.student_engagement || 'N/A')}</div>
      <div><strong class="text-slate-100">Learning Impact</strong>: ${escape(report.learning_impact || 'N/A')}</div>
      <div><strong class="text-slate-100">Parent Shareability</strong>: ${escape(report.parent_shareability || 'N/A')}</div>
      <div><strong class="text-slate-100">Confidence</strong>: ${escape(report.confidence_level || 'N/A')}</div>
    </div>
  `;

  metadataEl.innerHTML = `
    <div class="space-y-2">
      <div><strong class="text-slate-100">Generated By</strong>: ${escape(report.generated_by || 'N/A')}</div>
      <div><strong class="text-slate-100">Generated At</strong>: ${escape(report.generated_at || 'N/A')}</div>
      <div><strong class="text-slate-100">Executive Summary</strong>: ${escape(report.executive_summary || 'N/A')}</div>
    </div>
  `;

  const sections = [
    { id: 'rubric', title: 'Rubric-Based Evaluation', content: buildRubricSection(data.rubric) },
    { id: 'analysis', title: 'Evidence-Based Analysis', content: buildListSection(data.analysis, ['analysis_type', 'description', 'evidence']) },
    { id: 'impact', title: 'Student Learning Impact', content: buildListSection(data.impact, ['impact_area', 'impact_level', 'observation', 'evidence']) },
    { id: 'parentSummary', title: 'Parent-Friendly Summary', content: buildKeyValueSection(data.parentSummary) },
    { id: 'coaching', title: 'Teacher Coaching Feedback', content: buildFeedbackSection(data.coaching) },
    { id: 'betterAlternatives', title: 'Better Alternatives', content: buildAlternativesSection(data.betterAlternatives) },
    { id: 'nextPlan', title: 'Next Session Plan', content: buildKeyValueSection(data.nextPlan) },
    { id: 'qualityFlags', title: 'Quality Flags', content: buildFlagsSection(data.flags) },
    { id: 'finalEval', title: 'Final Evaluation', content: buildKeyValueSection(data.finalEval) }
  ];

  sectionsEl.innerHTML = sections.map(section => `
    <section class="bg-slate-900 border border-slate-800 rounded-lg p-4">
      <h2 class="text-sm font-semibold text-slate-200 mb-3">${escape(section.title)}</h2>
      ${section.content}
    </section>
  `).join('');
}

function buildRubricSection(rubricData) {
  if (!rubricData || !rubricData.length) return `<p class="text-slate-400">No rubric data found.</p>`;

  return rubricData.map(category => `
    <div class="mb-4">
      <div class="mb-2 text-slate-100 font-semibold">${escape(category.category_name || category.category)}</div>
      <div class="text-slate-400 text-xs mb-2">Score: ${escape(category.score ?? 'N/A')} / ${escape(category.max_score ?? 'N/A')}</div>
      <div class="space-y-2">
        ${Object.entries(category.indicators || {}).map(([indicatorName, payload]) => `
          <div class="rounded-lg border border-slate-800 bg-slate-950 p-3 text-slate-300">
            <div class="flex justify-between items-start gap-3">
              <div class="font-medium text-slate-100">${escape(indicatorName)}</div>
              <div class="text-slate-400 text-xs">${escape(payload.score ?? 'N/A')} / ${escape(payload.max_score ?? 'N/A')}</div>
            </div>
            <p class="text-slate-500 text-xs mt-2">${escape(payload.evidence || payload.reason || 'No evidence provided.')}</p>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');
}

function buildListSection(items, fields) {
  if (!Array.isArray(items) || items.length === 0) return `<p class="text-slate-400">No items available.</p>`;
  return items.map(item => `
    <div class="mb-3 rounded-lg border border-slate-800 bg-slate-950 p-3 text-slate-300">
      ${fields.map(field => `<div><strong class="text-slate-100">${escape(formatField(field))}</strong>: ${escape(item[field] || 'N/A')}</div>`).join('')}
    </div>
  `).join('');
}

function buildKeyValueSection(data) {
  if (!data || Object.keys(data).length === 0) return `<p class="text-slate-400">No content available.</p>`;
  return Object.entries(data).map(([key, value]) => `
    <div class="mb-2 text-slate-300"><strong class="text-slate-100">${escape(formatField(key))}</strong>: ${escape(value || 'N/A')}</div>
  `).join('');
}

function buildFeedbackSection(items) {
  if (!Array.isArray(items) || items.length === 0) return `<p class="text-slate-400">No coaching feedback available.</p>`;
  return items.map(item => `
    <div class="mb-3 rounded-lg border border-slate-800 bg-slate-950 p-3 text-slate-300">
      <div class="mb-2 text-slate-100 font-medium">${escape(item.area || item.feedback_type || 'Feedback')}</div>
      <div class="text-slate-400 text-xs mb-2">${escape(item.feedback_type ? `Type: ${item.feedback_type}` : '')}</div>
      <div><strong class="text-slate-100">Evidence</strong>: ${escape(item.evidence || 'N/A')}</div>
      <div><strong class="text-slate-100">Why it matters</strong>: ${escape(item.why_it_matters || 'N/A')}</div>
      <div><strong class="text-slate-100">Recommended action</strong>: ${escape(item.recommended_action || 'N/A')}</div>
    </div>
  `).join('');
}

function buildAlternativesSection(items) {
  if (!Array.isArray(items) || items.length === 0) return `<p class="text-slate-400">No better alternatives available.</p>`;
  return items.map(item => `
    <div class="mb-3 rounded-lg border border-slate-800 bg-slate-950 p-3 text-slate-300">
      <div><strong class="text-slate-100">Situation</strong>: ${escape(item.transcript_situation || 'N/A')}</div>
      <div><strong class="text-slate-100">Current Approach</strong>: ${escape(item.current_approach || 'N/A')}</div>
      <div><strong class="text-slate-100">Better Alternative</strong>: ${escape(item.better_alternative || 'N/A')}</div>
      <div><strong class="text-slate-100">Purpose</strong>: ${escape(item.purpose || 'N/A')}</div>
    </div>
  `).join('');
}

function buildFlagsSection(items) {
  if (!Array.isArray(items) || items.length === 0) return `<p class="text-slate-400">No quality flags available.</p>`;
  return items.map(item => `
    <div class="mb-3 rounded-lg border border-slate-800 bg-slate-950 p-3 text-slate-300">
      <div class="flex items-center justify-between gap-3 mb-2">
        <div class="font-medium text-slate-100">${escape(item.flag_description || 'Flag')}</div>
        <span class="px-2 py-0.5 rounded text-[10px] uppercase ${getSeverityClass(item.severity)}">${escape(item.severity || 'N/A')}</span>
      </div>
      <div><strong class="text-slate-100">Evidence</strong>: ${escape(item.evidence || 'N/A')}</div>
      <div><strong class="text-slate-100">Recommended Fix</strong>: ${escape(item.recommended_fix || 'N/A')}</div>
    </div>
  `).join('');
}

function getSeverityClass(severity) {
  if (!severity) return 'bg-slate-700 text-slate-200';
  const value = severity.toLowerCase();
  if (value === 'high') return 'bg-red-500/10 text-red-300';
  if (value === 'medium') return 'bg-amber-500/10 text-amber-300';
  if (value === 'low') return 'bg-emerald-500/10 text-emerald-300';
  return 'bg-slate-700 text-slate-200';
}

function formatField(key) {
  return String(key).replace(/_|-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function showMessage(message, type = 'info') {
  if (!messageEl) return;
  messageEl.textContent = message;
  messageEl.className = 'mb-4 px-4 py-3 rounded-lg';
  if (type === 'error') {
    messageEl.classList.add('bg-rose-500/10', 'text-rose-100');
  } else if (type === 'success') {
    messageEl.classList.add('bg-emerald-500/10', 'text-emerald-100');
  } else {
    messageEl.classList.add('bg-sky-500/10', 'text-sky-100');
  }
  messageEl.classList.remove('hidden');
}

function escape(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, '&#39;');
}

function escapeAttr(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&')
    .replace(/"/g, '"')
    .replace(/'/g, '&#39;')
    .replace(/</g, '<')
    .replace(/>/g, '>');
}

// Initialize on load
(async () => {
  await loadMeetings();
  if (currentMeetingId) {
    init();
  } else {
    snapshotEl.textContent = 'Please select a meeting to view the report.';
    summaryEl.textContent = '';
    metadataEl.textContent = '';
  }
})();