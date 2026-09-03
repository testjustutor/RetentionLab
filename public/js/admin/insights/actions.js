/**
 * Action Items Insights Page
 * Displays dynamic action items from coaching feedback and better alternatives
 */
let actionsData = null;
let dateFilter = null;
let statusFilter = null;

(async () => {
  // Initialize date filter (30 days default)
  dateFilter = createDateFilter({
    days: 30,
    onFilter: () => loadActionItems()
  });

  // Initialize status filter
  statusFilter = createSelectFilter({
    containerId: 'statusFilterContainer',
    placeholder: 'All Statuses',
    dataSource: [
      { id: 'pending', name: 'Pending' },
      { id: 'in_progress', name: 'In Progress' },
      { id: 'completed', name: 'Completed' }
    ],
    onFilter: (value) => {
      loadActionItems();
    }
  });

  await loadActionItems();
})();

async function loadActionItems() {
  try {
    const { fromDate, toDate } = dateFilter.getDates();
    const statusValue = statusFilter ? statusFilter.getValue() : null;
    
    const body = {
      from_date: fromDate,
      to_date: toDate
    };

    if (statusValue) {
      body.status = statusValue;
    }

    const data = await apiFetch('/api/admin/insights/actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    actionsData = data;
    
    renderSummary(data.summary);
    renderInstructorBreakdown(data.instructor_breakdown);
    renderRecentActions(data.recent_actions);
    
    showToast('Action items loaded successfully');
  } catch (e) {
    console.error('Failed to load action items:', e);
    showToast('Failed to load data: ' + e.message, true);
  }
}

function renderSummary(summary) {
  document.getElementById('totalActions').textContent = summary.total_actions || 0;
  document.getElementById('pendingActions').textContent = summary.pending || 0;
  document.getElementById('inProgressActions').textContent = summary.in_progress || 0;
  document.getElementById('completedActions').textContent = summary.completed || 0;

  // Priority distribution
  const priority = summary.priority_distribution || { high: 0, medium: 0, low: 0 };
  document.getElementById('highPriority').textContent = priority.high || 0;
  document.getElementById('mediumPriority').textContent = priority.medium || 0;
  document.getElementById('lowPriority').textContent = priority.low || 0;
}

function renderInstructorBreakdown(instructors) {
  const tbody = document.getElementById('instructorTable');
  if (!tbody) return;

  if (!instructors || instructors.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="py-2 px-2 text-center text-indigo-800 font-medium">No instructor data available</td></tr>';
    return;
  }

  tbody.innerHTML = instructors.map(inst => {
    const completionRate = inst.total_actions > 0
      ? Math.round((inst.completed / inst.total_actions) * 100)
      : 0;
    const rateColor = completionRate >= 70 ? 'text-emerald-700' : completionRate >= 40 ? 'text-amber-700' : 'text-red-600';

    return `
      <tr class="border-b border-indigo-200 hover:bg-indigo-100/70 transition-colors">
        <td class="py-2 px-2 text-[11px] font-semibold text-indigo-950">${escapeHtml(inst.instructor_name)}</td>
        <td class="py-2 px-2 text-[11px] font-bold text-indigo-900 text-right">${inst.total_actions}</td>
        <td class="py-2 px-2 text-[11px] font-bold text-amber-700 text-right">${inst.pending}</td>
        <td class="py-2 px-2 text-[11px] font-bold text-blue-700 text-right">${inst.in_progress}</td>
        <td class="py-2 px-2 text-[11px] font-bold text-emerald-700 text-right">${inst.completed}</td>
        <td class="py-2 px-2 text-[11px] font-bold ${rateColor} text-right">${completionRate}%</td>
      </tr>`;
  }).join('');
}
function renderRecentActions(actions) {
  const tbody = document.getElementById('recentActionsTable');
  if (!tbody) return;

  if (!actions || actions.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="py-2 px-2 text-center text-violet-800 font-medium">No action items available</td></tr>';
    return;
  }

  const statusColors = {
    'pending': 'bg-amber-100 text-amber-800',
    'in_progress': 'bg-blue-100 text-blue-700',
    'completed': 'bg-emerald-100 text-emerald-700'
  };
  const priorityColors = {
    'high': 'bg-red-100 text-red-700',
    'medium': 'bg-amber-100 text-amber-700',
    'low': 'bg-slate-100 text-slate-600'
  };

  tbody.innerHTML = actions.map(action => `
    <tr class="border-b border-violet-200 hover:bg-violet-100/70 transition-colors">
      <td class="py-2 px-2 text-[11px]">
        <span class="text-[10px] px-1.5 py-0.5 rounded font-bold ${priorityColors[action.priority] || priorityColors.medium}">${escapeHtml(action.priority || 'medium')}</span>
      </td>
      <td class="py-2 px-2 text-[11px]">
        <span class="text-[10px] px-1.5 py-0.5 rounded font-bold ${statusColors[action.status] || statusColors.pending}">${escapeHtml(action.status || 'pending')}</span>
      </td>
      <td class="py-2 px-2 text-[11px]">
        <span class="text-[10px] px-1.5 py-0.5 rounded font-bold bg-violet-100 text-violet-700">${action.type === 'coaching_feedback' ? 'Coaching' : 'Alternative'}</span>
      </td>
      <td class="py-2 px-2 text-[11px] font-semibold text-violet-950">
        <div>${escapeHtml(action.action_text)}</div>
        <div class="text-[10px] text-slate-500 mt-0.5">${escapeHtml(action.instructor_name)}</div>
      </td>
      <td class="py-2 px-2 text-[11px] text-slate-600 text-right whitespace-nowrap">${formatDate(action.meeting_date)}</td>
    </tr>`).join('');
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