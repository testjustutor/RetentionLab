/**
 * public/js/admin/insights/risks.js
 */

let risksData = null;
let dateFilter = null;
let severityFilter = null;

(async () => {
  // Initialize date filter (30 days default)
  dateFilter = createDateFilter({
    days: 30,
    autoLoad: false, // only fetch when Get Data is clicked (no auto-load on date change)
    onFilter: () => loadRisks()
  });

  // Initialize severity filter
  severityFilter = createSelectFilter({
    containerId: 'severityFilterContainer',
    placeholder: 'All Severities',
    showButton: false,
    dataSource: [
      { id: 'high', name: 'High Risk' },
      { id: 'medium', name: 'Medium Risk' },
      { id: 'low', name: 'Low Risk' }
    ],
    onFilter: (value) => {
      loadRisks();
    }
  });

  await loadRisks();
})();

async function loadRisks() {
  try {
    const { fromDate, toDate } = dateFilter.getDates();
    const severityValue = severityFilter ? severityFilter.getValue() : null;

    const body = {
      from_date: fromDate,
      to_date: toDate
    };

    if (severityValue) {
      body.severity = severityValue;
    }

    const data = await apiFetch('/api/admin/insights/risks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    risksData = data;

    renderSummary(data.summary);
    renderInstructorTable(data.instructor_breakdown);
    renderRecentRisks(data.recent_risks);

    showToast('Risks data loaded successfully');
  } catch (e) {
    console.error('Failed to load risks:', e);
    showToast('Failed to load data: ' + e.message, true);
  }
}

function renderSummary(summary) {
  document.getElementById('totalRisks').textContent = summary.total_risks || 0;
  document.getElementById('highRisks').textContent = summary.high_risks || 0;
  document.getElementById('mediumRisks').textContent = summary.medium_risks || 0;
  document.getElementById('lowRisks').textContent = summary.low_risks || 0;

  renderRiskTypeDistribution(summary.risk_type_distribution);
}

function renderRiskTypeDistribution(distribution) {
  const tbody = document.getElementById('riskTypeTableBody');
  if (!tbody) return;

  const types = distribution || { quality_flag: 0, quality_score: 0 };
  const rows = [
    { label: 'Quality Flag', count: types.quality_flag || 0, color: 'text-violet-700' },
    { label: 'Low Quality Score', count: types.quality_score || 0, color: 'text-cyan-700' }
  ];

  const total = rows.reduce((sum, r) => sum + r.count, 0);

  if (total === 0) {
    tbody.innerHTML = '<tr><td colspan="3" class="py-2 px-2 text-center text-violet-800 font-medium">No data available</td></tr>';
    return;
  }

  tbody.innerHTML = rows.map(r => {
    const pct = total > 0 ? ((r.count / total) * 100).toFixed(1) : '0.0';
    return `
      <tr class="border-b border-violet-200 hover:bg-violet-100/70 transition-colors">
        <td class="py-2 px-2 text-[11px] font-semibold text-violet-950">${escapeHtml(r.label)}</td>
        <td class="py-2 px-2 text-[11px] font-bold ${r.color} text-right">${r.count}</td>
        <td class="py-2 px-2 text-[11px] font-semibold text-violet-800 text-right">${pct}%</td>
      </tr>`;
  }).join('');
}

function getSeverityColor(severity) {
  switch (severity) {
    case 'high': return 'text-red-600';
    case 'low': return 'text-slate-600';
    case 'medium':
    default: return 'text-amber-700';
  }
}

function getRiskTypeLabel(riskType) {
  return riskType === 'quality_score' ? 'Low Score' : 'Quality Flag';
}

function getRiskTypeColor(riskType) {
  return riskType === 'quality_score' ? 'text-cyan-700' : 'text-violet-700';
}

function renderInstructorTable(instructors) {
  const tbody = document.getElementById('instructorTable');
  if (!tbody) return;

  if (!instructors || instructors.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="py-2 px-2 text-center text-red-800 font-medium">No instructor data available</td></tr>';
    return;
  }

  tbody.innerHTML = instructors.map(inst => {
    const total = inst.total_risks || 0;
    const riskPct = total > 0
      ? Math.round(((inst.high_risks * 3 + inst.medium_risks * 2 + inst.low_risks) / (total * 3)) * 100)
      : 0;
    return `
      <tr class="border-b border-red-200 hover:bg-red-100/70 transition-colors">
        <td class="py-2 px-2 text-[11px] font-semibold text-red-950">${escapeHtml(inst.instructor_name)}</td>
        <td class="py-2 px-2 text-[11px] font-bold text-red-700 text-right">${total}</td>
        <td class="py-2 px-2 text-[11px] font-bold text-red-600 text-right">${inst.high_risks || 0}</td>
        <td class="py-2 px-2 text-[11px] font-bold text-amber-700 text-right">${inst.medium_risks || 0}</td>
        <td class="py-2 px-2 text-[11px] font-bold text-slate-600 text-right">${inst.low_risks || 0}</td>
        <td class="py-2 px-2 text-[11px] font-bold text-red-700 text-right">${riskPct}%</td>
      </tr>`;
  }).join('');
}

function renderRecentRisks(risks) {
  const tbody = document.getElementById('recentRisksTable');
  if (!tbody) return;

  if (!risks || risks.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="py-2 px-2 text-center text-amber-800 font-medium">No risks identified</td></tr>';
    return;
  }

  tbody.innerHTML = risks.map(risk => {
    const sev = risk.severity || 'medium';
    const sevColor = getSeverityColor(sev);
    const typeLabel = getRiskTypeLabel(risk.risk_type);
    const typeColor = getRiskTypeColor(risk.risk_type);
    const evidence = risk.evidence ? `<div class="mt-0.5 text-[10px] text-slate-500 line-clamp-2">${escapeHtml(risk.evidence)}</div>` : '';
    const fix = risk.recommended_fix ? `<div class="mt-0.5 text-[10px] text-emerald-600 line-clamp-2">Fix: ${escapeHtml(risk.recommended_fix)}</div>` : '';

    return `
      <tr class="border-b border-amber-200 hover:bg-amber-100/70 transition-colors">
        <td class="py-2 px-2 text-[11px] font-semibold text-amber-950">
          <div>${escapeHtml(risk.risk_description)}</div>
          ${evidence}
          ${fix}
        </td>
        <td class="py-2 px-2 text-[11px] font-bold ${sevColor}">${escapeHtml(sev)}</td>
        <td class="py-2 px-2 text-[11px] font-bold ${typeColor}">${escapeHtml(typeLabel)}</td>
        <td class="py-2 px-2 text-[11px] text-slate-700">${escapeHtml(risk.instructor_name)}</td>
        <td class="py-2 px-2 text-[11px] text-slate-600 text-right whitespace-nowrap">${formatDate(risk.meeting_date)}</td>
      </tr>`;
  }).join('');
}

function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function escapeHtml(s) {
  if (!s) return '';
  const div = document.createElement('div');
  div.textContent = String(s);
  return div.innerHTML;
}