/**
 * Session Quality Report Hub
 * Entry point - shows session snapshot and navigation to 9 section pages
 */

let currentMeetingId = null;
let reportData = null;

(async () => {
  await loadMeetings();
  await checkUrlParams();
})();

async function loadMeetings() {
  try {
    const data = await apiFetch('/api/meetings/list?days=90');
    const meetings = data.meetings || [];
    const select = document.getElementById('meetingSelect');
    
    select.innerHTML = '<option value="">Select a meeting...</option>' +
      meetings.map(m => `<option value="${m.id}">${escapeHtml(m.title || 'Untitled')} - ${formatDate(m.start_time)}</option>`).join('');
    
    select.addEventListener('change', () => {
      if (select.value) {
        currentMeetingId = select.value;
        loadReportData();
      }
    });
  } catch (e) {
    console.error('Failed to load meetings:', e);
    document.getElementById('meetingSelect').innerHTML = '<option value="">Failed to load meetings</option>';
  }
}

async function checkUrlParams() {
  const params = new URLSearchParams(window.location.search);
  const meetingId = params.get('meetingId');
  
  if (meetingId) {
    document.getElementById('meetingSelect').value = meetingId;
    currentMeetingId = meetingId;
    await loadReportData();
  }
}

async function loadReportData() {
  if (!currentMeetingId) return;
  
  showMessage('Loading report data...', 'info');
  
  try {
    const response = await apiFetch(`/api/tutoring/report/${encodeURIComponent(currentMeetingId)}`);
    reportData = response;
    
    updateStatusIndicator(response);
    updateSnapshot(response);
    updateNavigationStatus(response);
    
    showMessage('Report loaded successfully', 'success');
  } catch (e) {
    console.error('Failed to load report:', e);
    showMessage(`Failed to load report: ${e.message}`, 'error');
  }
}

function updateStatusIndicator(data) {
  const indicator = document.getElementById('statusIndicator');
  const statusText = document.getElementById('statusText');
  
  const sections = ['metadata', 'report', 'analysis', 'impact', 'parentSummary', 'coaching', 'betterAlternatives', 'nextPlan', 'flags', 'finalEval'];
  const filledSections = sections.filter(section => {
    const sectionData = data[section];
    if (Array.isArray(sectionData)) return sectionData.length > 0;
    if (typeof sectionData === 'object') return Object.keys(sectionData).length > 0;
    return false;
  });
  
  const total = sections.length;
  const filled = filledSections.length;
  
  indicator.className = 'status-indicator';
  
  if (filled === total) {
    indicator.classList.add('complete');
    statusText.textContent = `Complete (${filled}/${total} sections)`;
  } else if (filled > 0) {
    indicator.classList.add('partial');
    statusText.textContent = `Partial (${filled}/${total} sections)`;
  } else {
    indicator.classList.add('pending');
    statusText.textContent = `Pending (0/${total} sections)`;
  }
}

function updateSnapshot(data) {
  const metadata = data.metadata || {};
  const report = data.report || {};
  
  document.getElementById('snapshotMeetingId').textContent = metadata.meeting_id || currentMeetingId || '-';
  document.getElementById('snapshotStudent').textContent = metadata.student_name || 'N/A';
  document.getElementById('snapshotSubject').textContent = metadata.subject || 'N/A';
  document.getElementById('snapshotScore').textContent = report.percentage_score ? report.percentage_score + '%' : 'N/A';
}

function updateNavigationStatus(data) {
  const sections = {
    rubric: data.report,
    analysis: data.analysis,
    impact: data.impact,
    parentSummary: data.parentSummary,
    coaching: data.coaching,
    betterAlternatives: data.betterAlternatives,
    nextPlan: data.nextPlan,
    flags: data.flags,
    finalEval: data.finalEval
  };
  
  Object.entries(sections).forEach(([section, sectionData]) => {
    const link = document.querySelector(`[data-section="${section}"]`);
    if (!link) return;
    
    const hasData = Array.isArray(sectionData) ? sectionData.length > 0 : (sectionData && Object.keys(sectionData).length > 0);
    
    if (hasData) {
      link.classList.remove('disabled');
      link.title = 'Data available';
    } else {
      link.classList.add('disabled');
      link.title = 'No data yet';
    }
  });
}

function showMessage(message, type = 'info') {
  const messageEl = document.getElementById('message');
  messageEl.textContent = message;
  messageEl.className = `message message-${type}`;
  messageEl.style.display = 'flex';
  
  setTimeout(() => {
    messageEl.style.display = 'none';
  }, 5000);
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