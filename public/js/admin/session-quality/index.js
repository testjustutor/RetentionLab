/**
 * Session Quality Dashboard
 * Professional overview with secure data handling, low-score alerts, and filtered views
 */

let scoreChart = null;
let subjectChart = null;
let avgScoreChart = null;
let gradeChart = null;
let engagementChart = null;
let curriculumChart = null;

(async () => {
  // Wait for header to be ready, then set page title
  if (globalThis.__rlHeaderReady) {
    await globalThis.__rlHeaderReady;
  }
  
  // Wait a bit more for header to finish loading from API
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Set page title in header
  const pageTitle = document.getElementById('pageTitle');
  const pageDescription = document.getElementById('pageDescription');
  if (pageTitle) pageTitle.textContent = 'Session Quality Dashboard';
  if (pageDescription) pageDescription.textContent = 'Teaching performance, student engagement, and session outcomes';
  
  await loadInstructorOptions();
  await loadDashboardData();
})();

async function loadInstructorOptions() {
  try {
    const res = await apiFetch('/api/tutoring/filters/instructors', { method: 'POST' });
    const data = res.data || res;
    const select = document.getElementById('filterInstructor');
    if (!select) return;
    
    select.innerHTML = '<option value="">All Instructors</option>' +
      data.options.map(opt => `<option value="${escapeHtml(opt.value)}">${escapeHtml(opt.label)}</option>`).join('');
  } catch (e) {
    console.error('Failed to load instructors:', e);
  }
}

async function loadMeetingOptions(instructorId) {
  try {
    const body = instructorId ? { instructor_id: instructorId } : {};
    const res = await apiFetch('/api/tutoring/filters/meetings', { 
      method: 'POST',
      body: JSON.stringify(body)
    });
    const data = res.data || res;
    const select = document.getElementById('filterMeeting');
    if (!select) return;
    
    select.innerHTML = '<option value="">All Meetings</option>' +
      data.options.map(opt => `<option value="${escapeHtml(opt.value)}">${escapeHtml(opt.label)}</option>`).join('');
    select.disabled = false;
    
    const sessionSelect = document.getElementById('filterSession');
    if (sessionSelect) {
      sessionSelect.innerHTML = '<option value="">All Sessions</option>';
      sessionSelect.disabled = true;
    }
  } catch (e) {
    console.error('Failed to load meetings:', e);
  }
}

async function loadSessionOptions(internalMeetingId) {
  try {
    const body = internalMeetingId ? { meeting_internal_id: internalMeetingId } : {};
    const res = await apiFetch('/api/tutoring/filters/sessions', { 
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = res.data || res;
    const select = document.getElementById('filterSession');
    if (!select) return;
    
    select.innerHTML = '<option value="">All Sessions</option>' +
      data.options.map(opt => `<option value="${escapeHtml(opt.value)}">${escapeHtml(opt.label)}</option>`).join('');
    select.disabled = false;
    document.getElementById('btnGetData').disabled = true;
  } catch (e) {
    console.error('Failed to load sessions:', e);
  }
}

async function loadDashboardData() {
  const instructorId = document.getElementById('filterInstructor')?.value || '';
  const meetingId = document.getElementById('filterMeeting')?.value || '';

  try {
    const body = {};
    if (instructorId) body.instructor_id = instructorId;
    if (meetingId) body.meeting_id = meetingId;

    const response = await apiFetch('/api/tutoring/dashboard', { 
      method: 'POST',
      body: JSON.stringify(body)
    });
    const data = response.data || response;

    updateStats(data.stats);
    updateLowPerformingTable(data.low_performing_sessions);
    updateSessionsTable(data.sessions);
    updateCharts(data.charts);
  } catch (e) {
    console.error('Failed to load dashboard data:', e);
    showError('Failed to load dashboard data: ' + e.message);
  }
}

function updateStats(stats) {
  document.getElementById('statTotalSessions').textContent = stats.total_sessions || 0;
  document.getElementById('statAvgScore').textContent = (stats.avg_score || 0) + '%';
  document.getElementById('statCompleteReports').textContent = stats.complete_reports || 0;
  document.getElementById('statPendingReports').textContent = stats.pending_reports || 0;
}

function updateLowPerformingTable(sessions) {
  const tbody = document.getElementById('lowPerformingTableBody');
  if (!sessions || sessions.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="py-2 text-center text-slate-500">No sessions requiring attention</td></tr>';
    return;
  }
  tbody.innerHTML = sessions.map(session => `
    <tr class="bg-red-50">
      <td class="py-1 px-2"><strong>${escapeHtml(session.session_ref)}</strong></td>
      <td class="py-1 px-2">${escapeHtml(session.instructor_name)}</td>
      <td class="py-1 px-2">${escapeHtml(session.student_name)}</td>
      <td class="py-1 px-2">${escapeHtml(session.subject || 'N/A')}</td>
      <td class="py-1 px-2">${escapeHtml(session.student_grade || 'N/A')}</td>
      <td class="py-1 px-2">${formatDate(session.start_time)}</td>
      <td class="py-1 px-2"><span class="text-[11px] font-medium text-red-600">${session.overall_score_pct ? session.overall_score_pct + '%' : 'N/A'}</span></td>
      <td class="py-1 px-2"><a href="/admin/session-quality/rubric?meetingId=${session.meeting_id}" class="text-[11px] px-2 py-0.5 bg-red-600 text-white rounded hover:bg-red-700">Review</a></td>
    </tr>
  `).join('');
}

function updateSessionsTable(sessions) {
  const tbody = document.getElementById('sessionsTableBody');
  if (!sessions || sessions.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="py-2 text-center text-slate-500">No sessions found</td></tr>';
    return;
  }
  tbody.innerHTML = sessions.map(session => `
    <tr>
      <td class="py-1 px-2"><strong>${escapeHtml(session.session_ref)}</strong></td>
      <td class="py-1 px-2">${escapeHtml(session.instructor_name)}</td>
      <td class="py-1 px-2">${escapeHtml(session.student_name)}</td>
      <td class="py-1 px-2">${escapeHtml(session.subject || 'N/A')}</td>
      <td class="py-1 px-2">${escapeHtml(session.student_grade || 'N/A')}</td>
      <td class="py-1 px-2">${formatDate(session.start_time)}</td>
      <td class="py-1 px-2"><span class="text-[11px] font-medium ${getScoreColorClass(session.overall_score_pct)}">${session.overall_score_pct ? session.overall_score_pct + '%' : 'N/A'}</span></td>
      <td class="py-1 px-2">${escapeHtml(session.overall_rating || 'N/A')}</td>
      <td class="py-1 px-2"><a href="/admin/session-quality/rubric?meetingId=${session.meeting_id}" class="text-[11px] px-2 py-0.5 bg-slate-900 text-white rounded hover:bg-slate-800">View Report</a></td>
    </tr>
  `).join('');
}

function getScoreColorClass(score) {
  if (!score) return 'text-slate-500';
  if (score >= 80) return 'text-emerald-700';
  if (score >= 60) return 'text-blue-600';
  if (score >= 40) return 'text-amber-700';
  return 'text-red-600';
}

function updateCharts(chartData) {
  const chartColors = ['#2563eb', '#7c3aed', '#db2777', '#dc2626', '#ea580c', '#ca8a04', '#16a34a', '#0891b2'];

  // 1. Score Distribution (Bar)
  if (scoreChart) scoreChart.destroy();
  scoreChart = new ApexCharts(document.querySelector('#scoreChart'), {
    series: [{ name: 'Sessions', data: chartData.score_distribution || [0,0,0,0,0] }],
    chart: { type: 'bar', height: 130, fontFamily: 'inherit', toolbar: { show: false } },
    plotOptions: { bar: { borderRadius: 4, columnWidth: '60%' } },
    xaxis: { categories: ['0-20', '21-40', '41-60', '61-80', '81-100'], labels: { style: { fontSize: '9px' } } },
    yaxis: { show: false },
    colors: ['#2563eb'],
    grid: { show: false }
  });
  scoreChart.render();

  // 2. Sessions by Subject (Donut)
  if (subjectChart) subjectChart.destroy();
  const subjectData = chartData.subject_distribution || [];
  subjectChart = new ApexCharts(document.querySelector('#subjectChart'), {
    series: subjectData.map(s => s.count),
    labels: subjectData.map(s => s.subject),
    chart: { type: 'donut', height: 130, fontFamily: 'inherit' },
    plotOptions: { pie: { donut: { size: '60%' } } },
    colors: chartColors.slice(0, subjectData.length),
    dataLabels: { enabled: false },
    legend: { show: false }
  });
  subjectChart.render();

  // 3. Avg Score by Subject (Bar)
  if (avgScoreChart) avgScoreChart.destroy();
  avgScoreChart = new ApexCharts(document.querySelector('#avgScoreChart'), {
    series: [{ name: 'Avg Score', data: subjectData.map(s => s.avg_score || 0) }],
    chart: { type: 'bar', height: 130, fontFamily: 'inherit', toolbar: { show: false } },
    plotOptions: { bar: { borderRadius: 4, columnWidth: '60%' } },
    xaxis: { categories: subjectData.map(s => s.subject), labels: { style: { fontSize: '9px' } } },
    yaxis: { show: false, max: 100 },
    colors: ['#7c3aed'],
    grid: { show: false }
  });
  avgScoreChart.render();

  // 4. Sessions by Grade (Bar)
  if (gradeChart) gradeChart.destroy();
  const gradeData = chartData.grade_distribution || [];
  gradeChart = new ApexCharts(document.querySelector('#gradeChart'), {
    series: [{ name: 'Sessions', data: gradeData.map(g => g.count) }],
    chart: { type: 'bar', height: 130, fontFamily: 'inherit', toolbar: { show: false } },
    plotOptions: { bar: { borderRadius: 4, columnWidth: '60%' } },
    xaxis: { categories: gradeData.map(g => g.grade), labels: { style: { fontSize: '9px' } } },
    yaxis: { show: false },
    colors: ['#db2777'],
    grid: { show: false }
  });
  gradeChart.render();

  // 5. Engagement vs Impact (Radar/Bar)
  if (engagementChart) engagementChart.destroy();
  engagementChart = new ApexCharts(document.querySelector('#engagementChart'), {
    series: [
      { name: 'Engagement', data: [chartData.avg_engagement || 0] },
      { name: 'Impact', data: [chartData.avg_impact || 0] }
    ],
    chart: { type: 'bar', height: 130, fontFamily: 'inherit', toolbar: { show: false } },
    plotOptions: { bar: { borderRadius: 4, columnWidth: '60%' } },
    xaxis: { categories: ['Avg Score'], labels: { style: { fontSize: '9px' } } },
    yaxis: { show: false, max: 100 },
    colors: ['#0891b2', '#16a34a'],
    grid: { show: false },
    legend: { position: 'top', fontSize: '9px' }
  });
  engagementChart.render();

  // 6. Score by Curriculum (Bar)
  if (curriculumChart) curriculumChart.destroy();
  const curriculumData = chartData.curriculum_distribution || [];
  curriculumChart = new ApexCharts(document.querySelector('#curriculumChart'), {
    series: [{ name: 'Avg Score', data: curriculumData.map(c => c.avg_score || 0) }],
    chart: { type: 'bar', height: 130, fontFamily: 'inherit', toolbar: { show: false } },
    plotOptions: { bar: { borderRadius: 4, columnWidth: '60%' } },
    xaxis: { categories: curriculumData.map(c => c.curriculum), labels: { style: { fontSize: '9px' } } },
    yaxis: { show: false, max: 100 },
    colors: ['#ea580c'],
    grid: { show: false }
  });
  curriculumChart.render();
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

function showError(message) {
  const tbody = document.getElementById('sessionsTableBody');
  tbody.innerHTML = `<tr><td colspan="9" class="py-2 text-center text-red-600">${escapeHtml(message)}</td></tr>`;
}

// Event Listeners
document.getElementById('filterInstructor')?.addEventListener('change', async (e) => {
  const instructorId = e.target.value;
  if (instructorId) {
    await loadMeetingOptions(instructorId);
  } else {
    await loadMeetingOptions('');
  }
});

document.getElementById('filterMeeting')?.addEventListener('change', async (e) => {
  const internalMeetingId = e.target.value;
  if (internalMeetingId) {
    await loadSessionOptions(internalMeetingId);
  } else {
    const sessionSelect = document.getElementById('filterSession');
    if (sessionSelect) {
      sessionSelect.innerHTML = '<option value="">All Sessions</option>';
      sessionSelect.disabled = true;
    }
    document.getElementById('btnGetData').disabled = true;
  }
});

document.getElementById('filterSession')?.addEventListener('change', async (e) => {
  const sessionId = e.target.value;
  document.getElementById('btnGetData').disabled = !sessionId;
});

document.getElementById('btnGetData')?.addEventListener('click', () => {
  loadDashboardData();
});

document.getElementById('btnReset')?.addEventListener('click', async () => {
  document.getElementById('filterInstructor').value = '';
  await loadMeetingOptions('');
  await loadDashboardData();
});