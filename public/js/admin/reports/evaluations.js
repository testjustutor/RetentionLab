/**
 * Evaluation Reports dashboard (admin).
 * Light theme + scrollable tables; filter bar (From/To + Active + Instructor + Get Data).
 * No Chart.js - score trends render as a lightweight table.
 */
let allScores = [];
let allMeetings = [];
let dateFilter = null;
let instructorFilter = null;

(async () => {
  // Date filter (30 days default). autoLoad:false => data is fetched only when Get Data is clicked.
  dateFilter = createDateFilter({
    days: 30,
    autoLoad: false,
    onFilter: (fromDate, toDate) => loadScores(fromDate, toDate)
  });

  // Instructor dropdown (Select2 via centralized component).
  loadInstructors();

  // Load initial data using the default (30-day) range.
  loadScores();
})();

async function loadInstructors() {
  try {
    instructorFilter = createSearchableSelect({
      containerId: 'instructorFilterContainer',
      placeholder: 'All instructors',
      dataSource: async () => {
        const json = await apiFetch('/api/admin/evaluations/reports/instructors');
        return json.instructors || [];
      },
      displayField: 'name',
      valueField: 'id'
    });
  } catch (e) {
    console.error('Failed to load instructors:', e);
  }
}

async function loadScores(fromDate, toDate) {
  try {
    if (!fromDate || !toDate) {
      const dates = dateFilter.getDates();
      fromDate = dates.fromDate;
      toDate = dates.toDate;
    }

    const payload = { from_date: fromDate, to_date: toDate };
    const instructorId = instructorFilter ? instructorFilter.getValue() : null;
    if (instructorId) payload.instructor_id = instructorId;
    const activeEl = document.getElementById('activeFilter');
    if (activeEl && activeEl.checked) payload.active = '1';

    showLoadingRows();

    const data = await apiFetch('/api/admin/evaluations/reports/summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    allScores = data.scores || [];
    allMeetings = data.meetings || [];

    const stats = data.stats || {};
    document.getElementById('totalMeetings').textContent = stats.totalMeetings || 0;
    document.getElementById('avgAiScore').textContent = stats.avgAiScore || '0.0';
    document.getElementById('avgHumanScore').textContent = stats.avgHumanScore || '0.0';
    document.getElementById('totalRubrics').textContent = stats.totalRubrics || 0;
    document.getElementById('totalReviewers').textContent = stats.totalReviewers || 0;

    renderScoreTrendTable();
    renderEvaluationTable();
    showToast('Evaluation data loaded successfully');
  } catch (e) {
    console.error('loadScores:', e);
    allScores = [];
    allMeetings = [];
    renderScoreTrendTable();
    renderEvaluationTable();
    showToast('Failed to load evaluation data: ' + e.message, true);
  }
}

function showLoadingRows() {
  const eBody = document.getElementById('evaluationBody');
  const tBody = document.getElementById('scoreTrendBody');
  if (eBody) eBody.innerHTML = `<tr><td class='py-6 px-2 text-blue-800 text-center' colspan='7'>Loading evaluation data...</td></tr>`;
  if (tBody) tBody.innerHTML = `<tr><td colspan='3' class='py-2 text-center text-indigo-800 font-medium'>Loading...</td></tr>`;
}

function groupScoresByMeeting() {
  const byMeeting = {};
  allScores.forEach((score) => {
    const mid = score.meeting_id || 'unknown';
    if (!byMeeting[mid]) byMeeting[mid] = { ai: [], human: [] };
    if (score.score_type === 'AI') byMeeting[mid].ai.push(+score.score || 0);
    else byMeeting[mid].human.push(+score.score || 0);
  });
  return byMeeting;
}

function getRubricsForMeeting(meetingId) {
  const meetingScores = allScores.filter((s) => (s.meeting_id || '') === (meetingId || ''));
  const rubricIds = new Set(meetingScores.map((s) => s.indicator_id || s.rubric_id || s.category_id).filter(Boolean));
  return Array.from(rubricIds);
}

function computeScores(ms) {
  if (!ms) return { ai: '-', human: '-', final: '-' };
  const ai = ms.ai.length ? ms.ai.reduce((a, b) => a + b, 0) / ms.ai.length : null;
  const human = ms.human.length ? ms.human.reduce((a, b) => a + b, 0) / ms.human.length : null;
  const finals = [ai, human].filter((v) => v !== null);
  return {
    ai: ai === null ? '-' : ai.toFixed(1),
    human: human === null ? '-' : human.toFixed(1),
    final: finals.length ? (finals.reduce((a, b) => a + b, 0) / finals.length).toFixed(1) : '-'
  };
}

function scoreColor(value) {
  const v = parseFloat(value);
  if (!value || value === '-' || isNaN(v)) return 'text-slate-600';
  if (v >= 4) return 'text-emerald-700';
  if (v >= 3) return 'text-blue-700';
  return 'text-slate-600';
}

function renderScoreTrendTable() {
  const tbody = document.getElementById('scoreTrendBody');
  if (!tbody) return;
  if (!allScores.length) {
    tbody.innerHTML = `<tr><td colspan='3' class='py-2 text-center text-indigo-800 font-medium'>No trend data available</td></tr>`;
    return;
  }
  const byDate = {};
  allScores.forEach((s) => {
    const iso = s.scored_at ? new Date(s.scored_at).toISOString().slice(0, 10) : 'unknown';
    if (!byDate[iso]) {
      byDate[iso] = {
        label: s.scored_at ? new Date(s.scored_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Unknown',
        ai: [],
        human: []
      };
    }
    if (s.score_type === 'AI') byDate[iso].ai.push(+s.score || 0);
    else byDate[iso].human.push(+s.score || 0);
  });
  const entries = Object.entries(byDate).sort((a, b) => {
    if (a[0] === 'unknown') return 1;
    if (b[0] === 'unknown') return -1;
    return a[0].localeCompare(b[0]);
  });
  let html = '';
  entries.forEach((entry) => {
    const group = entry[1];
    const aiAvg = group.ai.length ? (group.ai.reduce((x, y) => x + y, 0) / group.ai.length).toFixed(1) : '-';
    const hAvg = group.human.length ? (group.human.reduce((x, y) => x + y, 0) / group.human.length).toFixed(1) : '-';
    html += `<tr class='border-b border-indigo-200 hover:bg-indigo-100/70 transition-colors'>`;
    html += `<td class='py-2 px-2 text-[11px] font-bold text-indigo-950'>${escapeHtml(group.label)}</td>`;
    html += `<td class='py-2 px-2 text-[11px] font-medium ${scoreColor(aiAvg)} text-right'>${aiAvg}</td>`;
    html += `<td class='py-2 px-2 text-[11px] font-medium ${scoreColor(hAvg)} text-right'>${hAvg}</td>`;
    html += `</tr>`;
  });
  tbody.innerHTML = html;
}

function renderEvaluationTable() {
  const tbody = document.getElementById('evaluationBody');
  if (!tbody) return;
  const typeEl = document.getElementById('scoreTypeFilter');
  const filterType = typeEl ? typeEl.value : '';
  const byMeeting = groupScoresByMeeting();
  const meetings = allMeetings.filter((m) => {
    const mid = String(m.id || "");
    return !filterType || byMeeting[mid];
  });
  if (!meetings.length) {
    tbody.innerHTML = `<tr><td class='py-6 px-2 text-blue-800 text-center' colspan='7'>No evaluation data found</td></tr>`;
    return;
  }
  let html = '';
  meetings.forEach((m) => {
    const mid = String(m.id || "");
    const comp = computeScores(byMeeting[mid]);
    const rubrics = getRubricsForMeeting(mid);
    const ms = byMeeting[mid];
    const totalReviews = (ms && ms.ai ? ms.ai.length : 0) + (ms && ms.human ? ms.human.length : 0);
    const meetDate = m.scheduled_start_time || m.start_time || m.actual_start_time;
    const title = escapeHtml(m.title || 'Untitled');
    html += `<tr class='border-b border-blue-200 hover:bg-blue-100/70 transition-colors'>`;
    html += `<td class='py-2 px-2 text-[11px] font-semibold text-blue-950' title='${title}'>${title}</td>`;
    html += `<td class='py-2 px-2 text-[11px] text-blue-800'>${rubrics.length} rubric${rubrics.length !== 1 ? 's' : ''}</td>`;
    html += `<td class='py-2 px-2 text-[11px] font-medium ${scoreColor(comp.ai)} text-right'>${comp.ai}</td>`;
    html += `<td class='py-2 px-2 text-[11px] font-medium ${scoreColor(comp.human)} text-right'>${comp.human}</td>`;
    html += `<td class='py-2 px-2 text-[11px] font-bold ${scoreColor(comp.final)} text-right'>${comp.final}</td>`;
    html += `<td class='py-2 px-2 text-[11px] text-blue-800 text-right'>${totalReviews}</td>`;
    html += `<td class='py-2 px-2 text-[11px] text-blue-800 whitespace-nowrap'>${formatDate(meetDate)}</td>`;
    html += `</tr>`;
  });
  tbody.innerHTML = html;
}

function exportCsv() {
  if (!allScores.length && !allMeetings.length) { showToast('No data to export', true); return; }
  const NL = String.fromCharCode(10);
  const DQ = String.fromCharCode(34);
  const headers = ['Meeting', 'Rubric', 'AI Avg', 'Human Avg', 'Final Score', 'Reviews', 'Date'];
  const byMeeting = groupScoresByMeeting();
  const rows = allMeetings.map((m) => {
    const mid = String(m.id || "");
    const comp = computeScores(byMeeting[mid]);
    const rubrics = getRubricsForMeeting(mid);
    const ms = byMeeting[mid];
    const totalReviews = (ms && ms.ai ? ms.ai.length : 0) + (ms && ms.human ? ms.human.length : 0);
    return [
      m.title || '',
      rubrics.length,
      comp.ai === '-' ? '' : comp.ai,
      comp.human === '-' ? '' : comp.human,
      comp.final === '-' ? '' : comp.final,
      totalReviews,
      formatDate(m.scheduled_start_time || m.start_time)
    ];
  });
  const csv = [headers.join(',')].concat(rows.map((r) => r.map((v) => csvEscape(v, DQ)).join(','))).join(NL);
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'evaluation-report-' + new Date().toISOString().split('T')[0] + '.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast('Report exported');
}

function csvEscape(v, DQ) {
  let s = String(v == null ? '' : v);
  const C = String.fromCharCode(44);
  const NL = String.fromCharCode(10);
  const CR = String.fromCharCode(13);
  if (s.indexOf(DQ) >= 0 || s.indexOf(C) >= 0 || s.indexOf(NL) >= 0 || s.indexOf(CR) >= 0) {
    s = DQ + s.split(DQ).join(DQ + DQ) + DQ;
  }
  return s;
}

// Re-render evaluation table when score-type filter changes (no refetch).
document.addEventListener('change', (e) => {
  if (e.target.id === 'scoreTypeFilter') renderEvaluationTable();
  if (e.target.id === 'activeFilter') loadScores();
});

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

