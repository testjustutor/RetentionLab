/**
 * Risks Insights Page
 * Displays dynamic risks and issues from session quality flags and low scores
 */
let risksData = null;
let dateFilter = null;
let severityFilter = null;

(async () => {
  // Initialize date filter (30 days default)
  dateFilter = createDateFilter({
    days: 30,
    onFilter: () => loadRisks()
  });

  // Initialize severity filter
  severityFilter = createSelectFilter({
    containerId: 'severityFilterContainer',
    placeholder: 'All Severities',
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
    renderInstructorBreakdown(data.instructor_breakdown);
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

  // Risk type distribution
  const types = summary.risk_type_distribution || { quality_flag: 0, quality_score: 0 };
  document.getElementById('qualityFlagRisks').textContent = types.quality_flag || 0;
  document.getElementById('qualityScoreRisks').textContent = types.quality_score || 0;
}

function renderInstructorBreakdown(instructors) {
  const container = document.getElementById('instructorBreakdown');
  
  if (!instructors || instructors.length === 0) {
    container.innerHTML = '<p class="text-slate-500 text-center py-8">No instructor data available</p>';
    return;
  }

  const html = instructors.map(inst => {
    const riskScore = inst.total_risks > 0 
      ? Math.round(((inst.high_risks * 3 + inst.medium_risks * 2 + inst.low_risks) / (inst.total_risks * 3)) * 100)
      : 0;
    
    return `
    <div class="bg-slate-800/30 border border-slate-700/50 rounded-md p-3 hover:bg-slate-800/50 transition-colors">
      <div class="flex items-center justify-between">
        <div class="flex-1">
          <p class="text-xs font-semibold text-slate-100">${escapeHtml(inst.instructor_name)}</p>
          <p class="text-[10px] text-slate-400 mt-0.5">${inst.total_risks} risk${inst.total_risks !== 1 ? 's' : ''}</p>
        </div>
        <div class="flex gap-3">
          <div class="text-right">
            <p class="text-sm font-bold text-red-400">${inst.high_risks}</p>
            <p class="text-[10px] text-slate-500">High</p>
          </div>
          <div class="text-right">
            <p class="text-sm font-bold text-amber-800">${inst.medium_risks}</p>
            <p class="text-[10px] text-slate-500">Medium</p>
          </div>
          <div class="text-right">
            <p class="text-sm font-bold text-slate-400">${inst.low_risks}</p>
            <p class="text-[10px] text-slate-500">Low</p>
          </div>
        </div>
      </div>
      <div class="mt-2 pt-2 border-t border-slate-700/50">
        <div class="flex items-center justify-between">
          <span class="text-[10px] text-slate-400">Risk Score</span>
          <span class="text-xs font-bold ${riskScore >= 60 ? 'text-red-400' : riskScore >= 30 ? 'text-amber-800' : 'text-emerald-600'}">${riskScore}%</span>
        </div>
        <div class="mt-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
          <div class="h-full ${riskScore >= 60 ? 'bg-red-500' : riskScore >= 30 ? 'bg-amber-800' : 'bg-emerald-600'}" style="width: ${riskScore}%"></div>
        </div>
      </div>
    </div>
  `;
  }).join('');

  container.innerHTML = html;
}

function renderRecentRisks(risks) {
  const container = document.getElementById('recentRisks');
  
  if (!risks || risks.length === 0) {
    container.innerHTML = '<p class="text-slate-500 text-center py-8">No risks identified</p>';
    return;
  }

  const html = risks.map(risk => {
    const severityColors = {
      'high': 'border-red-500/30 bg-red-500/5',
      'medium': 'border-amber-500/30 bg-amber-500/5',
      'low': 'border-slate-500/30 bg-slate-500/5'
    };
    const severityBadgeColors = {
      'high': 'bg-red-500/10 text-red-400',
      'medium': 'bg-amber-500/10 text-amber-800',
      'low': 'bg-slate-500/10 text-slate-400'
    };
    const typeBadgeColors = {
      'quality_flag': 'bg-violet-500/10 text-violet-400',
      'quality_score': 'bg-cyan-500/10 text-cyan-400'
    };
    
    return `
    <div class="border ${severityColors[risk.severity] || severityColors.medium} rounded-md p-3 hover:bg-slate-800/30 transition-colors">
      <div class="flex items-start gap-2">
        <div class="flex-shrink-0 mt-0.5">
          <span class="text-base font-bold ${risk.severity === 'high' ? 'text-red-400' : risk.severity === 'medium' ? 'text-amber-800' : 'text-slate-400'}">!</span>
        </div>
        <div class="flex-1">
          <div class="flex items-center gap-2 mb-1.5">
            <span class="text-[10px] px-1.5 py-0.5 rounded ${severityBadgeColors[risk.severity] || severityBadgeColors.medium}">${risk.severity || 'medium'}</span>
            <span class="text-[10px] px-1.5 py-0.5 rounded ${typeBadgeColors[risk.risk_type] || typeBadgeColors.quality_flag}">${risk.risk_type === 'quality_score' ? 'Low Score' : 'Quality Flag'}</span>
          </div>
          <p class="text-xs font-semibold text-slate-100 mb-1">${escapeHtml(risk.risk_description)}</p>
          ${risk.evidence ? `<p class="text-[10px] text-slate-400 mb-1.5 line-clamp-2">${escapeHtml(risk.evidence)}</p>` : ''}
          ${risk.recommended_fix ? `<p class="text-[10px] text-emerald-400 mb-1.5">Fix: ${escapeHtml(risk.recommended_fix)}</p>` : ''}
          <p class="text-[10px] text-slate-500">${formatDate(risk.meeting_date)} • ${escapeHtml(risk.instructor_name)}</p>
        </div>
      </div>
    </div>
  `;
  }).join('');

  container.innerHTML = html;
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