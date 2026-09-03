/**
 * public/js/super_admin/reports/meeting-ai-evaluation-report.js
 */

let allRecords = [];
let dateFilter = null;
let instructorFilter = null;

(async () => {
  // Date filter (default 30 days). autoLoad:false - data loads on page load and on Get Data click.
  dateFilter = createDateFilter({
    days: 30,
    autoLoad: false,
    onFilter: () => loadRecords()
  });

  loadInstructors();
  await loadRecords();
})();

async function loadInstructors() {
  try {
    instructorFilter = createSearchableSelect({
      containerId: 'instructorFilterContainer',
      placeholder: 'All instructors',
      dataSource: async () => {
        const json = await apiFetch('/api/super_admin/reports/meeting-ai-evaluation/instructors');
        return json.instructors || [];
      },
      displayField: 'name',
      valueField: 'id'
    });
  } catch (e) {
    console.error('Failed to load instructors:', e);
  }
}

async function loadRecords() {
  const body = document.getElementById('sessionsBody');
  body.innerHTML = '<tr><td colspan="6" class="py-6 px-2 text-blue-800 text-center">Loading meeting sessions...</td></tr>';
  try {
    const { fromDate, toDate } = dateFilter.getDates();
    const instructorId = instructorFilter ? instructorFilter.getValue() : null;

    const payload = {};
    if (fromDate) payload.from_date = fromDate;
    if (toDate) payload.to_date = toDate;
    if (instructorId) payload.instructor_id = instructorId;

    const data = await apiFetch('/api/super_admin/reports/meeting-ai-evaluation/summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    allRecords = data.records || [];
    updateStats(data.stats || {});
    renderTable();
    showToast('Meeting AI evaluation data loaded');
  } catch (e) {
    console.error('loadRecords:', e);
    allRecords = [];
    updateStats({});
    body.innerHTML = '<tr><td colspan="6" class="py-6 px-2 text-red-700 text-center">Failed to load data: ' + escHtml(e.message) + '</td></tr>';
    showToast('Failed to load data: ' + e.message, true);
  }
}
function updateStats(stats) {
  document.getElementById('statTotalMeetings').textContent = stats.totalMeetings || 0;
  document.getElementById('statTotalSessions').textContent = stats.totalSessions || 0;
  document.getElementById('statWithReport').textContent = stats.withReport || 0;
  document.getElementById('statWithoutReport').textContent = stats.withoutReport || 0;
}

function renderTable() {
  const body = document.getElementById('sessionsBody');
  if (!allRecords.length) {
    body.innerHTML = '<tr><td colspan="6" class="py-6 px-2 text-blue-800 text-center">No sessions found for this period / instructor</td></tr>';
    return;
  }

  let currentMeeting = null;
  let html = '';
  allRecords.forEach((r) => {
    if (currentMeeting !== r.meeting_id) {
      currentMeeting = r.meeting_id;
      html += `<tr class="bg-blue-100/80"><td colspan="6" class="py-1.5 px-2 text-[11px] font-bold text-blue-950">
        ${escHtml(r.meeting_title || 'Untitled Meeting')}
        <span class="text-blue-700"> - ${escHtml(r.meeting_date ? formatDateTime(r.meeting_date) : '')}</span>
        <span class="text-blue-500"> (${escHtml(r.platform || '')} - ${escHtml(r.meeting_status || '')})</span>
      </td></tr>`;
    }

    const statusColor = r.session_status === 'completed' ? 'bg-emerald-100 text-emerald-700'
      : r.session_status === 'active' || r.session_status === 'joining' ? 'bg-blue-100 text-blue-700'
      : r.session_status === 'scheduled' ? 'bg-amber-100 text-amber-700'
      : 'bg-slate-100 text-slate-600';

    let scoreCell = '<span class="text-slate-400">--</span>';
    if (r.has_ai_report) {
      const pct = Number(r.ai_avg_score_pct) || 0;
      const color = pct >= 70 ? 'text-emerald-700' : pct >= 50 ? 'text-amber-700' : 'text-red-700';
      scoreCell = `<span class="font-bold ${color}">${pct}%</span> <span class="text-slate-400">(${r.ai_indicator_count})</span>`;
    }

    let reportCell = '<span class="text-slate-400">No report</span>';
    if (r.has_ai_report) {
      reportCell = `<a class="inline-block px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-semibold"
        href="/super_admin/reports/meeting-ai-session-report?session_id=${encodeURIComponent(r.session_id)}" target="_blank">View AI Report</a>`;
    }

    html += `<tr class="border-b border-blue-200 hover:bg-blue-100/70 transition-colors">
      <td class="py-2 px-2 text-[11px] text-blue-800">${escHtml(r.meeting_title || '-')}</td>
      <td class="py-2 px-2 text-[11px] text-blue-800">${escHtml(r.instructor_name || r.instructor_email || '-')}</td>
      <td class="py-2 px-2 text-[11px] text-blue-800 whitespace-nowrap">
        #${escHtml(r.session_id)}<br><span class="text-[10px] text-blue-600">${formatDateTime(r.session_start)} &rarr; ${formatTime(r.session_end)}</span>
      </td>
      <td class="py-2 px-2 text-[11px] text-right"><span class="text-[10px] px-1.5 py-0.5 rounded font-bold ${statusColor}">${escHtml(r.session_status || 'unknown')}</span></td>
      <td class="py-2 px-2 text-[11px] text-right">${scoreCell}</td>
      <td class="py-2 px-2 text-[11px]">${reportCell}</td>
    </tr>`;
  });
  body.innerHTML = html;
}
function exportCsv() {
  if (!allRecords.length) { showToast('No data to export', true); return; }
  const NL = String.fromCharCode(10);
  const headers = ['Meeting', 'Meeting Date', 'Instructor', 'Session Id', 'Session Start', 'Session End',
    'Session Status', 'AI Score %', 'AI Indicator Count', 'AI Report Url'];
  const rows = allRecords.map((r) => [
    csvEscape(r.meeting_title || ''),
    csvEscape(formatDateOnly(r.meeting_date)),
    csvEscape(r.instructor_name || r.instructor_email || ''),
    r.session_id,
    csvEscape(formatDateTime(r.session_start)),
    csvEscape(formatDateTime(r.session_end)),
    csvEscape(r.session_status || ''),
    r.ai_avg_score_pct || 0,
    r.ai_indicator_count || 0,
    r.has_ai_report ? `/super_admin/reports/meeting-ai-session-report?session_id=${encodeURIComponent(r.session_id)}` : ''
  ]);
  const csv = [headers.join(',')].concat(rows.map((row) => row.join(','))).join(NL);
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'meeting-ai-evaluation-report-' + new Date().toISOString().split('T')[0] + '.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast('Report exported');
}

function csvEscape(v) {
  let s = String(v == null ? '' : v);
  const DQ = String.fromCharCode(34);
  const C = String.fromCharCode(44);
  const NLc = String.fromCharCode(10);
  const CR = String.fromCharCode(13);
  if (s.indexOf(DQ) >= 0 || s.indexOf(C) >= 0 || s.indexOf(NLc) >= 0 || s.indexOf(CR) >= 0) {
    s = DQ + s.split(DQ).join(DQ + DQ) + DQ;
  }
  return s;
}

function formatDateTime(d) {
  if (!d) return 'N/A';
  const dt = new Date(d);
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' ' + dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function formatDateOnly(d) { if (!d) return ''; return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
function formatTime(d) { if (!d) return ''; return new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }); }