let companies = [], users = [], meetings = [];
let meetingTrendsChartInstance = null;
let companyChartInstance = null;

async function refreshDashboard() {
  await Promise.all([loadCompanies(), loadUsers(), loadMeetings(), loadStorage()]);
  renderStats();
  renderCharts();
  renderTable();
}

async function loadCompanies() {
  try { const d = await apiFetch('/api/companies'); companies = d.data || d.companies || []; } catch(e){}
}
async function loadUsers() {
  try { const d = await apiFetch('/api/users'); users = d.users || d.data || []; } catch(e){}
}
async function loadMeetings() {
  try { const d = await apiFetch('/api/meetings/list?days=7'); meetings = d.meetings || []; } catch(e){}
}
async function loadStorage() {
  try { const d = await apiFetch('/storage/stats'); document.getElementById('storageUsed').textContent = d.total || '-'; } catch(e){}
}

function renderStats() {
  const active = companies.filter(c => c.status === 'active').length;
  document.getElementById('activeCompanies').textContent = active;
  document.getElementById('totalUsers').textContent = users.length;
  document.getElementById('activeMeetings').textContent = meetings.filter(m => m.status === 'in_progress' || m.status === 'joining').length;
}

function renderCharts() {
  // Destroy existing charts before recreating them
  if (meetingTrendsChartInstance) {
    meetingTrendsChartInstance.destroy();
    meetingTrendsChartInstance = null;
  }
  if (companyChartInstance) {
    companyChartInstance.destroy();
    companyChartInstance = null;
  }

  const mc = document.getElementById('meetingTrendsChart');
  if (mc) {
    const byDate = {};
    meetings.forEach(m => {
      const d = m.start_time ? new Date(m.start_time).toLocaleDateString('en-US', {month:'short', day:'numeric'}) : 'Unknown';
      byDate[d] = (byDate[d]||0)+1;
    });
    meetingTrendsChartInstance = new Chart(mc, {type:'bar', data:{labels:Object.keys(byDate), datasets:[{label:'Meetings', data:Object.values(byDate), backgroundColor:'rgba(139,92,246,0.3)', borderColor:'rgba(139,92,246,1)', borderWidth:1}]}, options:{responsive:true, maintainAspectRatio:false, plugins:{legend:{labels:{color:'#e2e8f0'}}}, scales:{x:{ticks:{color:'#94a3b8'}, grid:{color:'#334155'}}, y:{beginAtZero:true, ticks:{color:'#94a3b8'}, grid:{color:'#334155'}}}}});
  }
  const cc = document.getElementById('companyChart');
  if (cc) {
    const active = companies.filter(c=>c.status==='active').length;
    const suspended = companies.filter(c=>c.status==='suspended').length;
    companyChartInstance = new Chart(cc, {type:'doughnut', data:{labels:['Active','Suspended'], datasets:[{data:[active, suspended], backgroundColor:['rgba(34,197,94,0.6)','rgba(239,68,68,0.6)'], borderColor:['rgba(34,197,94,1)','rgba(239,68,68,1)'], borderWidth:2}]}, options:{responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'bottom', labels:{color:'#e2e8f0'}}}}});
  }
}

function renderTable() {
  const tbody = document.getElementById('companyTableBody');
  if (!companies.length) { tbody.innerHTML = '<tr><td colspan="4" class="py-6 text-center text-slate-500">No companies</td></tr>'; return; }
  tbody.innerHTML = companies.slice(0,5).map(c => {
    const userCount = users.filter(u => u.company_id === c.id).length;
    return `<tr class="hover:bg-slate-800/30"><td class="py-2 px-3 ">${escapeHtml(c.company_name||c.name||'Unnamed')}</td>
      <td class="py-2 px-3"><span class="text-[10px] px-1.5 py-0.5 rounded ${c.status==='active'?'bg-emerald-500/10 text-emerald-400':'bg-red-500/10 text-red-400'}">${c.status||'unknown'}</span></td>
      <td class="py-2 px-3 ">${userCount}</td>
      <td class="py-2 px-3 text-[10px] text-slate-400">${c.created_at?new Date(c.created_at).toLocaleDateString():'-'}</td></tr>`;
  }).join('');
}

function escapeHtml(s){if(!s)return'';const d=document.createElement('div');d.textContent=String(s);return d.innerHTML;}
refreshDashboard();