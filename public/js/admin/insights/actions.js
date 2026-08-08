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
  const container = document.getElementById('instructorBreakdown');
  
  if (!instructors || instructors.length === 0) {
    container.innerHTML = '<p class="text-slate-500 text-center py-8">No instructor data available</p>';
    return;
  }

  const html = instructors.map(inst => {
    const completionRate = inst.total_actions > 0 
      ? Math.round((inst.completed / inst.total_actions) * 100) 
      : 0;
    
    return `
    <div class="bg-slate-800/30 border border-slate-700/50 rounded-md p-3 hover:bg-slate-800/50 transition-colors">
      <div class="flex items-center justify-between">
        <div class="flex-1">
          <p class="text-xs font-semibold text-slate-100">${escapeHtml(inst.instructor_name)}</p>
          <p class="text-[10px] text-slate-400 mt-0.5">${inst.total_actions} action item${inst.total_actions !== 1 ? 's' : ''}</p>
        </div>
        <div class="flex gap-3">
          <div class="text-right">
            <p class="text-sm font-bold text-amber-800">${inst.pending}</p>
            <p class="text-[10px] text-slate-500">Pending</p>
          </div>
          <div class="text-right">
            <p class="text-sm font-bold text-blue-400">${inst.in_progress}</p>
            <p class="text-[10px] text-slate-500">In Progress</p>
          </div>
          <div class="text-right">
            <p class="text-sm font-bold text-emerald-600">${inst.completed}</p>
            <p class="text-[10px] text-slate-500">Completed</p>
          </div>
        </div>
      </div>
      <div class="mt-2 pt-2 border-t border-slate-700/50">
        <div class="flex items-center justify-between">
          <span class="text-[10px] text-slate-400">Completion Rate</span>
          <span class="text-xs font-bold ${completionRate >= 70 ? 'text-emerald-600' : completionRate >= 40 ? 'text-amber-800' : 'text-red-400'}">${completionRate}%</span>
        </div>
        <div class="mt-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
          <div class="h-full ${completionRate >= 70 ? 'bg-emerald-600' : completionRate >= 40 ? 'bg-amber-800' : 'bg-red-400'}" style="width: ${completionRate}%"></div>
        </div>
      </div>
    </div>
  `;
  }).join('');

  container.innerHTML = html;
}

function renderRecentActions(actions) {
  const container = document.getElementById('recentActions');
  
  if (!actions || actions.length === 0) {
    container.innerHTML = '<p class="text-slate-500 text-center py-8">No action items available</p>';
    return;
  }

  const html = actions.map(action => {
    const statusColors = {
      'pending': 'bg-amber-500/10 text-amber-800',
      'in_progress': 'bg-blue-500/10 text-blue-400',
      'completed': 'bg-emerald-500/10 text-emerald-600'
    };
    const priorityColors = {
      'high': 'bg-red-500/10 text-red-400',
      'medium': 'bg-amber-500/10 text-amber-800',
      'low': 'bg-slate-500/10 text-slate-400'
    };
    
    return `
    <div class="bg-slate-800/30 border border-slate-700/50 rounded-md p-3 hover:bg-slate-800/50 transition-colors">
      <div class="flex items-start justify-between">
        <div class="flex-1">
          <div class="flex items-center gap-2 mb-1">
            <span class="text-[10px] px-1.5 py-0.5 rounded ${priorityColors[action.priority] || priorityColors.medium}">${action.priority || 'medium'}</span>
            <span class="text-[10px] px-1.5 py-0.5 rounded ${statusColors[action.status] || statusColors.pending}">${action.status || 'pending'}</span>
            <span class="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-400">${action.type === 'coaching_feedback' ? 'Coaching' : 'Alternative'}</span>
          </div>
          <p class="text-xs font-semibold text-slate-100">${escapeHtml(action.action_text)}</p>
          <p class="text-[10px] text-slate-400 mt-1">${formatDate(action.meeting_date)} • ${escapeHtml(action.instructor_name)}</p>
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