/**
 * Reports Dashboard JS
 * Loads summary stats for the reports landing page
 */

(async () => {
  await loadDashboardStats();
})();

async function loadDashboardStats() {
  try {
    // Load meetings count
    const meetingsData = await apiFetch('/api/meetings/list?days=30');
    const meetings = meetingsData.meetings || [];
    const totalMeetingsEl = document.getElementById('totalMeetings');
    if (totalMeetingsEl) totalMeetingsEl.textContent = meetings.length;

    // Load evaluations count
    const scoresData = await apiFetch('/api/scores');
    const scores = scoresData.scores || [];
    const totalEvaluationsEl = document.getElementById('totalEvaluations');
    if (totalEvaluationsEl) totalEvaluationsEl.textContent = scores.length;

    // Load audits count
    const auditData = await apiFetch('/api/audit-reports/summary?days=30');
    const audits = auditData.audits || [];
    const totalAuditsEl = document.getElementById('totalAudits');
    if (totalAuditsEl) totalAuditsEl.textContent = audits.length;
  } catch (e) {
    console.error('Failed to load dashboard stats:', e);
  }
}