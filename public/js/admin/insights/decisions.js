/**
 * Decisions Insights Page
 * Displays dynamic decisions and recommendations from session evaluations
 */
let decisionsData = null;
let dateFilter = null;
let typeFilter = null;

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

  await loadDecisions();
})();

async function loadDecisions() {
  try {
    const { fromDate, toDate } = dateFilter.getDates();
    const typeValue = typeFilter ? typeFilter.getValue() : null;
    
    const body = {
      from_date: fromDate,
      to_date: toDate
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
    renderInstructorBreakdown(data.instructor_breakdown);
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

  // Performance metrics
  document.getElementById('avgTeacherPerformance').textContent = summary.avg_teacher_performance || 0;
  document.getElementById('avgStudentEngagement').textContent = summary.avg_student_engagement || 0;
  document.getElementById('avgLearningImpact').textContent = summary.avg_learning_impact || 0;

  // Rating distribution
  const ratings = summary.rating_distribution || {};
  document.getElementById('excellentRating').textContent = ratings['Excellent'] || 0;
  document.getElementById('goodRating').textContent = ratings['Good'] || 0;
  document.getElementById('averageRating').textContent = ratings['Average'] || 0;
  document.getElementById('needsImprovementRating').textContent = ratings['Needs Improvement'] || 0;
}

function renderInstructorBreakdown(instructors) {
  const container = document.getElementById('instructorBreakdown');
  
  if (!instructors || instructors.length === 0) {
    container.innerHTML = '<p class="text-slate-500 text-center py-8">No instructor data available</p>';
    return;
  }

  const html = instructors.map(inst => {
    const total = inst.evaluation_count + inst.coaching_count;
    
    return `
    <div class="bg-slate-800/30 border border-slate-700/50 rounded-md p-3 hover:bg-slate-800/50 transition-colors">
      <div class="flex items-center justify-between">
        <div class="flex-1">
          <p class="text-xs font-semibold text-slate-100">${escapeHtml(inst.instructor_name)}</p>
          <p class="text-[10px] text-slate-400 mt-0.5">${total} decision${total !== 1 ? 's' : ''}</p>
        </div>
        <div class="flex gap-3">
          <div class="text-right">
            <p class="text-sm font-bold text-violet-400">${inst.evaluation_count}</p>
            <p class="text-[10px] text-slate-500">Evaluations</p>
          </div>
          <div class="text-right">
            <p class="text-sm font-bold text-amber-800">${inst.coaching_count}</p>
            <p class="text-[10px] text-slate-500">Coaching</p>
          </div>
        </div>
      </div>
    </div>
  `;
  }).join('');

  container.innerHTML = html;
}

function renderRecentDecisions(decisions) {
  const container = document.getElementById('recentDecisions');
  
  if (!decisions || decisions.length === 0) {
    container.innerHTML = '<p class="text-slate-500 text-center py-8">No decisions available</p>';
    return;
  }

  const html = decisions.map(decision => {
    const typeColors = {
      'evaluation': 'bg-violet-500/10 text-violet-400',
      'coaching': 'bg-amber-500/10 text-amber-800'
    };
    const ratingColors = {
      'Excellent': 'text-emerald-600',
      'Good': 'text-blue-400',
      'Average': 'text-amber-800',
      'Needs Improvement': 'text-red-400'
    };
    
    return `
    <div class="bg-slate-800/30 border border-slate-700/50 rounded-md p-3 hover:bg-slate-800/50 transition-colors">
      <div class="flex items-start justify-between">
        <div class="flex-1">
          <div class="flex items-center gap-2 mb-1.5">
            <span class="text-[10px] px-1.5 py-0.5 rounded ${typeColors[decision.decision_type] || typeColors.evaluation}">${decision.source}</span>
            ${decision.overall_rating ? `<span class="text-[10px] px-1.5 py-0.5 rounded bg-slate-500/10 ${ratingColors[decision.overall_rating] || 'text-slate-400'}">${decision.overall_rating}</span>` : ''}
          </div>
          <p class="text-xs font-semibold text-slate-100 mb-1">${escapeHtml(decision.decision_text)}</p>
          ${decision.context ? `<p class="text-[10px] text-slate-400 mb-1.5 line-clamp-2">${escapeHtml(decision.context)}</p>` : ''}
          <p class="text-[10px] text-slate-500">${formatDate(decision.meeting_date)} • ${escapeHtml(decision.instructor_name)}</p>
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