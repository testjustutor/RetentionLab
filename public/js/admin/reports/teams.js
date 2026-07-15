let allUsers = [];
let allScores = [];
let departments = [];
let teamChart = null;

(async () => {
  await Promise.all([loadUsers(), loadScores(), loadDepartments()]);
  updateStats();
  renderTeamCards();
  initChart();
  populateTeamFilter();
})();

async function loadUsers() {
  try {
    const data = await apiFetch('/api/users');
    allUsers = data.users || data.data || [];
  } catch(e) { console.error('Failed to load users:', e); }
}

async function loadScores() {
  try {
    const data = await apiFetch('/api/scores');
    allScores = data.scores || [];
  } catch(e) { console.error('Failed to load scores:', e); }
}

async function loadDepartments() {
  try {
    const data = await apiFetch('/api/departments');
    departments = data.data || data.departments || [];
    if (!departments.length) {
      // Fallback: derive from users
      const deptSet = new Set(allUsers.map(u => u.department || u.team || 'Ungrouped').filter(Boolean));
      departments = Array.from(deptSet).map(name => ({ id: name, name }));
    }
  } catch(e) { console.error('Failed to load departments:', e); }
}

function populateTeamFilter() {
  const filter = document.getElementById('teamFilter');
  filter.innerHTML = '<option value="">All Teams</option>';
  departments.forEach(d => {
    filter.innerHTML += `<option value="${escapeHtml(d.name||d.id)}">${escapeHtml(d.name||d.id)}</option>`;
  });
  filter.addEventListener('change', renderTeamCards);
}

function updateStats() {
  document.getElementById('totalTeams').textContent = departments.length;
  document.getElementById('totalMembers').textContent = allUsers.length;

  const avgPerf = allScores.length ? (allScores.reduce((sum, s) => sum + (+s.score || 0), 0) / allScores.length).toFixed(1) : '0.0';
  document.getElementById('avgPerformance').textContent = avgPerf;
  document.getElementById('growthRate').textContent = '+0.0'; // placeholder until historical comparison is added
}

function renderTeamCards() {
  const container = document.getElementById('teamCards');
  const selectedTeam = document.getElementById('teamFilter').value;
  
  const filteredDepts = selectedTeam ? departments.filter(d => (d.name||d.id) === selectedTeam) : departments;
  
  if (!filteredDepts.length) {
    container.innerHTML = '<p class="text-slate-500 text-center py-16 col-span-2">No teams found</p>';
    return;
  }

  let html = '';
  filteredDepts.forEach(dept => {
    const deptName = dept.name || dept.id;
    const members = allUsers.filter(u => (u.department || u.team || 'Ungrouped') === deptName);
    const memberIds = members.map(m => m.id);
    
    const deptScores = allScores.filter(s => memberIds.includes(s.reviewer_id || s.user_id));
    const avgScore = deptScores.length ? (deptScores.reduce((sum, s) => sum + (+s.score || 0), 0) / deptScores.length).toFixed(1) : '0.0';
    const participationRate = members.length > 0 ? Math.round((deptScores.length / Math.max(members.length, 1)) * 100) : 0;
    
    // Calculate score distribution
    const scoreBins = { high: 0, medium: 0, low: 0 };
    deptScores.forEach(s => {
      const v = +s.score || 0;
      if (v >= 4) scoreBins.high++;
      else if (v >= 3) scoreBins.medium++;
      else scoreBins.low++;
    });

    html += `<div class="bg-slate-900 border border-slate-800 rounded-lg p-3 hover:border-violet-500/30 transition-colors">
      <div class="flex items-center justify-between mb-3">
        <div>
          <h3 class="text-sm font-semibold ">${escapeHtml(deptName)}</h3>
          <p class="text-[10px] text-slate-500">${members.length} member${members.length !== 1 ? 's' : ''}</p>
        </div>
        <div class="text-right">
          <p class="text-xl font-bold ">${avgScore}</p>
          <p class="text-[10px] text-slate-500">Avg Score</p>
        </div>
      </div>
      
      <div class="grid grid-cols-3 gap-2 mb-3">
        <div class="bg-slate-800/30 rounded-md p-1.5 text-center">
          <p class="text-base font-bold text-emerald-600">${scoreBins.high}</p>
          <p class="text-[10px] text-slate-500">High (4+)</p>
        </div>
        <div class="bg-slate-800/30 rounded-md p-1.5 text-center">
          <p class="text-base font-bold text-blue-400">${scoreBins.medium}</p>
          <p class="text-[10px] text-slate-500">Med (3-4)</p>
        </div>
        <div class="bg-slate-800/30 rounded-md p-1.5 text-center">
          <p class="text-base font-bold text-amber-800">${scoreBins.low}</p>
          <p class="text-[10px] text-slate-500">Low (<3)</p>
        </div>
      </div>

      <div class="flex items-center justify-between text-xs">
        <span class="text-slate-400">Participation: <span class=" font-medium">${participationRate}%</span></span>
        <span class="text-slate-400">Sessions: <span class=" font-medium">${deptScores.length}</span></span>
      </div>

      ${members.length > 0 ? `
      <details class="mt-4">
        <summary class="text-xs text-slate-400 cursor-pointer hover:text-white transition-colors">View Members</summary>
        <div class="mt-2 space-y-1">
          ${members.slice(0, 10).map(m => {
            const memberScores = allScores.filter(s => (s.reviewer_id || s.user_id) === m.id);
            const memberAvg = memberScores.length ? (memberScores.reduce((sum, s) => sum + (+s.score || 0), 0) / memberScores.length).toFixed(1) : '-';
            return `<div class="flex items-center justify-between py-1 px-2 rounded bg-slate-800/20">
              <span class="text-xs text-slate-300">${escapeHtml(m.first_name)} ${escapeHtml(m.last_name || '')}</span>
              <span class="text-xs font-medium text-violet-400">${memberAvg}</span>
            </div>`;
          }).join('')}
          ${members.length > 10 ? `<p class="text-xs text-slate-500 pt-1">+${members.length - 10} more</p>` : ''}
        </div>
      </details>` : ''}
    </div>`;
  });

  container.innerHTML = html;
}

function initChart() {
  const ctx = document.getElementById('teamChart').getContext('2d');
  
  const labels = departments.map(d => d.name || d.id);
  const scores = departments.map(dept => {
    const deptName = dept.name || dept.id;
    const members = allUsers.filter(u => (u.department || u.team || 'Ungrouped') === deptName);
    const memberIds = members.map(m => m.id);
    const deptScores = allScores.filter(s => memberIds.includes(s.reviewer_id || s.user_id));
    return deptScores.length ? (deptScores.reduce((sum, s) => sum + (+s.score || 0), 0) / deptScores.length).toFixed(1) : 0;
  });
  
  const members = departments.map(dept => {
    const deptName = dept.name || dept.id;
    return allUsers.filter(u => (u.department || u.team || 'Ungrouped') === deptName).length;
  });

  teamChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Average Score',
          data: scores,
          backgroundColor: 'rgba(139, 92, 246, 0.3)',
          borderColor: 'rgba(139, 92, 246, 1)',
          borderWidth: 1,
          yAxisID: 'y'
        },
        {
          label: 'Members',
          data: members,
          backgroundColor: 'rgba(34, 197, 94, 0.3)',
          borderColor: 'rgba(34, 197, 94, 1)',
          borderWidth: 1,
          yAxisID: 'y1'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { labels: { color: '#e2e8f0' } }
      },
      scales: {
        x: { ticks: { color: '#94a3b8' }, grid: { color: '#334155' } },
        y: {
          beginAtZero: true,
          ticks: { color: '#94a3b8' },
          grid: { color: '#334155' },
          position: 'left'
        },
        y1: {
          beginAtZero: true,
          ticks: { color: '#94a3b8' },
          grid: { display: false },
          position: 'right'
        }
      }
    }
  });
}

async function exportTeamReport() {
  try {
    const rows = departments.map(dept => {
      const deptName = dept.name || dept.id;
      const members = allUsers.filter(u => (u.department || u.team || 'Ungrouped') === deptName);
      const memberIds = members.map(m => m.id);
      const deptScores = allScores.filter(s => memberIds.includes(s.reviewer_id || s.user_id));
      const avgScore = deptScores.length ? (deptScores.reduce((sum, s) => sum + (+s.score || 0), 0) / deptScores.length).toFixed(1) : '0.0';
      return {
        team: deptName,
        members: members.length,
        avgScore,
        totalScores: deptScores.length
      };
    });

    if (!rows.length) { showToast('No data to export', true); return; }
    const headers = Object.keys(rows[0]);
    const csv = [headers.join(',')].concat(rows.map(r => headers.map(k => `"${String(r[k]).replace(/"/g,'""')}"`).join(','))).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `team-report-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast('Report exported');
  } catch(e) { showToast('Export failed: ' + e.message, true); }
}

function escapeHtml(s) {
  if (!s) return '';
  const div = document.createElement('div');
  div.textContent = String(s);
  return div.innerHTML;
}