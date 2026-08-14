/**
 * Decisions Insights Page
 * Displays dynamic decisions and recommendations from session evaluations
 */
let decisionsData = null;
let dateFilter = null;
let typeFilter = null;
let instructorFilter = null;

(async () => {
  // Initialize date filter (30 days default)
  dateFilter = createDateFilter({
    days: 30,
    onFilter: () => loadDecisions()
  });

  // Initialize decision type filter
  typeFilter = createSelectFilter({
    containerId: 'typeFilterContainer',
    placeholder: 'All Types',
    dataSource: [
      { id: 'positive', name: 'Positive Decisions' },
      { id: 'improvement', name: 'Improvement Needed' }
    ],
    onFilter: (value) => {
      loadDecisions();
    }
  });

  // Initialize instructor filter (shared insights endpoint)
  loadInstructors();

  await loadDecisions();
})();

async function loadInstructors() {
  try {
    instructorFilter = createSearchableSelect({
      containerId: 'instructorFilterContainer',
      placeholder: 'All instructors',
      dataSource: async () => {
        const json = await apiFetch('/api/admin/insights/instructors');
        return json.instructors || [];
      },
      displayField: 'name',
      valueField: 'id',
      onSelect: () => loadDecisions()
    });
  } catch (e) {
    console.error('Failed to load instructors:', e);
  }
}

async function loadDecisions() {
  try {
    const { fromDate, toDate } = dateFilter.getDates();
    const typeValue = typeFilter ? typeFilter.getValue() : null;
    const instructorId = instructorFilter ? instructorFilter.getValue() : null;
    
    const body = {
      from_date: fromDate,
      to_date: toDate,
      instructor_id: instructorId
    };

    if (typeValue) {
      body.decision_type = typeValue;
    }

    const data = await apiFetch('/api/admin/insights/decisions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    decisionsData = data;
    
    renderSummary(data.summary);
    renderInstructorTable(data.instructor_breakdown);
    renderRecentDecisions(data.recent_decisions);
    
    showToast('Decisions loaded successfully');
  } catch (e) {
    console.error('Failed to load decisions:', e);
    showToast('Failed to load data: ' + e.message, true);
  }
}

function renderSummary(summary) {
  document.getElementById('totalDecisions').textContent = summary.total_decisions || 0;
  document.getElementById('evaluationDecisions').textContent = summary.evaluation_decisions || 0;
  document.getElementById('coachingDecisions').textContent = summary.coaching_decisions || 0;

  // Performance metrics table
  const perfTbody = document.getElementById('performanceMetricsTable');
  if (perfTbody) {
    const metrics = [
      { label: 'Avg Teacher Performance', value: summary.avg_teacher_performance || 0, color: 'text-cyan-800' },
      { label: 'Avg Student Engagement', value: summary.avg_student_engagement || 0, color: 'text-emerald-700' },
      { label: 'Avg Learning Impact', value: summary.avg_learning_impact || 0, color: 'text-blue-700' }
    ];
    perfTbody.innerHTML = metrics.map(m => `
      <tr class="border-b border-cyan-200 hover:bg-cyan-100 transition-colors">
        <td class="py-2 px-2 text-[11px] font-semibold text-cyan-950">${escapeHtml(m.label)}</td>
        <td class="py-2 px-2 text-[11px] font-bold ${m.color} text-right">${m.value}</td>
      </tr>`).join('');
  }

  // Rating distribution
  const ratings = summary.rating_distribution || {};
  document.getElementById('excellentRating').textContent = ratings['Excellent'] || 0;
  document.getElementById('goodRating').textContent = ratings['Good'] || 0;
  document.getElementById('averageRating').textContent = ratings['Average'] || 0;
  document.getElementById('needsImprovementRating').textContent = ratings['Needs Improvement'] || 0;
}

function renderInstructorTable(instructors) {
  const tbody = document.getElementById('instructorTable');
  if (!tbody) return;

  if (!instructors || instructors.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="py-2 px-2 text-center text-blue-800 font-medium">No instructor data available</td></tr>';
    return;
  }

  tbody.innerHTML = instructors.map(inst => {
    const total = (inst.evaluation_count || 0) + (inst.coaching_count || 0);
    return `
      <tr class="border-b border-blue-200 hover:bg-blue-100/70 transition-colors">
        <td class="py-2 px-2 text-[11px] font-semibold text-blue-950">${escapeHtml(inst.instructor_name)}</td>
        <td class="py-2 px-2 text-[11px] font-bold text-blue-700 text-right">${total}</td>
        <td class="py-2 px-2 text-[11px] font-bold text-cyan-700 text-right">${inst.evaluation_count || 0}</td>
        <td class="py-2 px-2 text-[11px] font-bold text-amber-700 text-right">${inst.coaching_count || 0}</td>
      </tr>`;
  }).join('');
}

function renderRecentDecisions(decisions) {
  const tbody = document.getElementById('recentDecisionsTable');
  if (!tbody) return;

  if (!decisions || decisions.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="py-2 px-2 text-center text-violet-800 font-medium">No decisions available</td></tr>';
    return;
  }

  const ratingColors = {
    'Excellent': 'text-emerald-700',
    'Good': 'text-blue-700',
    'Average': 'text-amber-700',
    'Needs Improvement': 'text-red-600'
  };

  tbody.innerHTML = decisions.map(decision => {
    const rating = decision.overall_rating || 'N/A';
    const ratingColor = ratingColors[rating] || 'text-slate-600';
    const context = decision.context
      ? `<div class="mt-0.5 text-[10px] text-slate-500 line-clamp-2">${escapeHtml(decision.context)}</div>`
      : '';

    return `
      <tr class="border-b border-violet-200 hover:bg-violet-100/70 transition-colors">
        <td class="py-2 px-2 text-[11px] font-semibold text-violet-950">
          <div>${escapeHtml(decision.decision_text)}</div>
          ${context}
        </td>
        <td class="py-2 px-2 text-[11px] font-bold text-violet-700">${escapeHtml(decision.source)}</td>
        <td class="py-2 px-2 text-[11px] font-bold ${ratingColor}">${escapeHtml(rating)}</td>
        <td class="py-2 px-2 text-[11px] text-slate-700">${escapeHtml(decision.instructor_name)}</td>
        <td class="py-2 px-2 text-[11px] text-slate-600 text-right whitespace-nowrap">${formatDate(decision.meeting_date)}</td>
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
