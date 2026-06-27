// Frontend for admin/reports/meetings.html
(async function() {
  const adminSelect = document.getElementById('adminSelect');
  const meetingSelect = document.getElementById('meetingSelect');
  const loadReportBtn = document.getElementById('loadReportBtn');
  const weightedScoreBtn = document.getElementById('weightedScoreBtn');
  const exportCsvBtn = document.getElementById('exportCsvBtn');
  const reportBody = document.getElementById('reportBody');

  let lastRows = [];

  function toOptionLabel(u) {
    if (!u) return '';
    const name = u.first_name || u.name || u.email || String(u.id || '');
    const role = u.role_name ? ` (${u.role_name})` : '';
    return `${name}${role}`;
  }

  async function loadAdmins() {
    try {
      const json = await apiFetch('/api/users');
      const users = json.data || json; // support different shapes
      adminSelect.innerHTML = '<option value="">(master/default)</option>';
      (users || []).forEach(u => {
        const opt = document.createElement('option');
        opt.value = u.id;
        opt.textContent = toOptionLabel(u);
        adminSelect.appendChild(opt);
      });
    } catch (err) {
      console.error('loadAdmins', err);
      showToast('Failed to load users: ' + err.message, true);
    }
  }

  async function loadMeetings() {
    try {
      // Use completed meetings (historical) so reports can be generated
      const hours = 24 * 30; // last 30 days by default
      const json = await apiFetch(`/api/meeting-schedule/completed?hours=${hours}`);
      const payload = json.users || json.data || json;
      const users = payload || [];
      const events = [];
      users.forEach(u => {
        (u.events || []).forEach(e => events.push(Object.assign({}, e, { owner: u.email, role_name: u.role_name })));
      });
      meetingSelect.innerHTML = '<option value="">Select meeting</option>';
      events.forEach(m => {
        const id = m.id || m.meetingId || m.meeting_id || m.meetingId || m.meeting_id || m.meeting_id;
        const label = (m.title || m.name || id) + (m.start ? (' — ' + new Date(m.start).toLocaleString()) : '');
        const opt = document.createElement('option');
        opt.value = id;
        opt.textContent = label;
        meetingSelect.appendChild(opt);
      });
      if (events.length) {
        meetingSelect.selectedIndex = 1; // select first real meeting
      }
    } catch (err) {
      console.error('loadMeetings', err);
      showToast('Failed to load meetings: ' + err.message, true);
    }
  }

  function renderReportRows(rows) {
    lastRows = rows || [];
    reportBody.innerHTML = '';
    if (!rows || rows.length === 0) {
      reportBody.innerHTML = '<tr><td class="py-4 px-4 text-slate-400" colspan="4">No results</td></tr>';
      return;
    }
    rows.forEach(r => {
      const tr = document.createElement('tr');
      tr.className = 'hover:bg-slate-800/30';
      const cat = r.category_name || r.category || r.group || '';
      const ind = r.indicator_name || r.indicator || r.name || '';
      const reviewer = (r.reviewer_name || r.reviewer || r.performed_by_name || r.performed_by) || '';
      const score = (r.score !== undefined) ? String(r.score) : (r.value !== undefined ? String(r.value) : '');
      tr.innerHTML = `<td class="py-3 px-4 text-sm text-white">${escHtml(cat)}</td><td class="py-3 px-4 text-xs text-slate-400">${escHtml(ind)}</td><td class="py-3 px-4 text-xs text-slate-400">${escHtml(reviewer)}</td><td class="py-3 px-4 text-xs text-slate-400">${escHtml(score)}</td>`;
      reportBody.appendChild(tr);
    });
  }

  async function loadReport() {
    const meetingId = meetingSelect.value;
    if (!meetingId) return showToast('Select a meeting first', true);
    const adminId = adminSelect.value;
    try {
      const q = adminId ? `?admin_id=${adminId}` : '';
      const json = await apiFetch(`/api/rubric-admin/meeting-report/${encodeURIComponent(meetingId)}${q}`);
      const rows = json.data || json.rows || json;
      renderReportRows(rows);
      showToast('Report loaded');
    } catch (err) {
      console.error('loadReport', err);
      showToast('Failed to load report: ' + err.message, true);
    }
  }

  async function getWeightedScore() {
    const meetingId = meetingSelect.value;
    if (!meetingId) return showToast('Select a meeting first', true);
    const adminId = adminSelect.value;
    if (!adminId) return showToast('Weighted score requires selecting an admin', true);
    try {
      const json = await apiFetch(`/api/rubric-admin/weighted-score/${encodeURIComponent(meetingId)}?admin_id=${adminId}`);
      const score = json.score || json.total_score || json;
      showToast('Weighted score: ' + (typeof score === 'object' ? JSON.stringify(score) : String(score)));
    } catch (err) {
      console.error('getWeightedScore', err);
      showToast('Failed to calculate weighted score: ' + err.message, true);
    }
  }

  function downloadCsv(filename, rows) {
    if (!rows || rows.length === 0) return showToast('No data to export', true);
    const keys = Object.keys(rows[0]);
    const csv = [keys.join(',')].concat(rows.map(r => keys.map(k => `"${String(r[k] === undefined ? '' : r[k]).replace(/"/g,'""')}"`).join(','))).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // Wire events
  loadReportBtn.addEventListener('click', loadReport);
  weightedScoreBtn.addEventListener('click', getWeightedScore);
  exportCsvBtn.addEventListener('click', () => downloadCsv('meeting-report.csv', lastRows));

  // Init
  await Promise.all([loadAdmins(), loadMeetings()]);

})();
