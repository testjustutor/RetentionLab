let currentFilter = '';
let allReviews = [];
let allInstructors = [];
let allReviewers = [];
let instructorDropdown = null;
let meetingDropdown = null;
let reviewerDropdown = null;

(async () => {
  await loadData();
  updateStats();
  renderReviews();
  await loadInstructorsAndReviewers();
})();

async function loadData() {
  try {
    const data = await apiFetch('/api/admin/reviews/queue' + (currentFilter ? `?status=${currentFilter}` : ''));
    allReviews = data.reviews || [];
  } catch(e) {
    document.getElementById('reviewsRoot').innerHTML = `<p class="text-red-400">Failed to load reviews: ${e.message}</p>`;
  }
}

async function loadInstructorsAndReviewers() {
  try {
    const [instructorsData, reviewersData] = await Promise.all([
      apiFetch('/api/admin/reviews/instructors'),
      apiFetch('/api/admin/reviews/reviewers')
    ]);
    allInstructors = instructorsData.instructors || [];
    allReviewers = reviewersData.reviewers || [];
    
    // Custom instructor dropdown
    const instructorData = allInstructors.map(i => ({ id: i.id, name: i.name + ' (' + i.email + ')' }));
    instructorDropdown = createDarkSearchableSelect({
      containerId: 'instructorSelectContainer',
      placeholder: 'Choose an instructor...',
      dataSource: instructorData,
      displayField: 'name',
      valueField: 'id',
      onSelect: (value) => {
        loadMeetingsByInstructor(value);
      }
    });

    // Custom meeting dropdown (initially empty)
    meetingDropdown = createDarkSearchableSelect({
      containerId: 'meetingSelectContainer',
      placeholder: 'Select instructor first...',
      dataSource: [],
      displayField: 'name',
      valueField: 'id',
      onSelect: () => {}
    });

    // Custom reviewer dropdown
    const reviewerData = allReviewers.map(r => ({ id: r.id, name: r.first_name + ' ' + (r.last_name || '') + ' (' + r.email + ')' }));
    reviewerDropdown = createDarkSearchableSelect({
      containerId: 'reviewerSelectContainer',
      placeholder: 'Choose a reviewer...',
      dataSource: reviewerData,
      displayField: 'name',
      valueField: 'id',
      onSelect: () => {}
    });
  } catch(e) {
    console.error('Failed to load instructors/reviewers:', e);
    showToast('Failed to load data. Please refresh the page.', true);
  }
}

async function loadMeetingsByInstructor(instructorId) {
  if (!instructorId) {
    // Reset meeting dropdown
    meetingDropdown = createDarkSearchableSelect({
      containerId: 'meetingSelectContainer',
      placeholder: 'Select instructor first...',
      dataSource: [],
      displayField: 'name',
      valueField: 'id',
      onSelect: () => {}
    });
    return;
  }

  // Show loading state
  meetingDropdown = createDarkSearchableSelect({
    containerId: 'meetingSelectContainer',
    placeholder: 'Loading meetings...',
    dataSource: [],
    displayField: 'name',
    valueField: 'id',
    onSelect: () => {}
  });

  try {
    const data = await apiFetch(`/api/admin/reviews/meetings/${instructorId}`);
    const meetings = data.meetings || [];
    
    const meetingData = meetings.length > 0 
      ? meetings.map(m => ({ 
          id: m.meeting_id, 
          name: m.title + ' - ' + (m.scheduled_start_time ? formatDate(m.scheduled_start_time) : 'No date') 
        }))
      : [{ id: '', name: 'No meetings found' }];

    meetingDropdown = createDarkSearchableSelect({
      containerId: 'meetingSelectContainer',
      placeholder: 'Select meeting...',
      dataSource: meetingData,
      displayField: 'name',
      valueField: 'id',
      onSelect: () => {}
    });
  } catch(e) {
    console.error('Failed to load meetings:', e);
    showToast('Failed to load meetings', true);
    meetingDropdown = createDarkSearchableSelect({
      containerId: 'meetingSelectContainer',
      placeholder: 'Failed to load meetings',
      dataSource: [],
      displayField: 'name',
      valueField: 'id',
      onSelect: () => {}
    });
  }
}

function updateStats() {
  const pending = allReviews.filter(r => r.review_status === 'pending').length;
  const inProgress = allReviews.filter(r => r.review_status === 'in_progress' || r.review_status === 'in-progress').length;
  const completed = allReviews.filter(r => r.review_status === 'completed').length;
  
  document.getElementById('pendingCount').textContent = pending;
  document.getElementById('inProgressCount').textContent = inProgress;
  document.getElementById('completedCount').textContent = completed;
  document.getElementById('totalCount').textContent = allReviews.length;
}

function renderReviews() {
  const root = document.getElementById('reviewsRoot');
  const filtered = currentFilter ? allReviews.filter(r => r.review_status === currentFilter) : allReviews;

  if (!filtered.length) {
    root.innerHTML = '<p class="text-slate-500 text-center py-16">No reviews found</p>';
    return;
  }

  let html = '<div class="space-y-4">';
  filtered.forEach(review => {
    const statusColor = getStatusColor(review.review_status);
    const statusText = getStatusText(review.review_status);
    
    html += `<div class="bg-slate-900 border border-slate-800 rounded-lg p-3">
      <div class="flex items-start justify-between mb-2">
        <div class="flex-1">
          <h3 class="text-sm font-semibold text-slate-100">${escapeHtml(review.meeting_title || 'Untitled Meeting')}</h3>
          <p class="text-xs text-slate-400 mt-0.5">${formatDate(review.start_time)} • ${review.platform || 'Unknown Platform'}</p>
        </div>
        <span class="px-1.5 py-0.5 rounded text-[10px] font-medium ${statusColor}">${statusText}</span>
      </div>
      
      <div class="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
        <div>
          <p class="text-[10px] text-slate-500">Reviewer</p>
          <p class="text-slate-100">${escapeHtml(review.reviewer_name || 'Unknown')}</p>
          <p class="text-[10px] text-slate-400">${escapeHtml(review.reviewer_email || '')}</p>
        </div>
        <div>
          <p class="text-[10px] text-slate-500">Assigned By</p>
          <p class="text-slate-100">${escapeHtml(review.assigned_by_name || 'System')}</p>
          <p class="text-[10px] text-slate-400">${formatDate(review.assigned_at)}</p>
        </div>
        <div>
          <p class="text-[10px] text-slate-500">Progress</p>
          <p class="text-slate-100">${review.score_count || 0} scores</p>
          ${review.reviewed_at ? `<p class="text-[10px] text-slate-400">Completed: ${formatDate(review.reviewed_at)}</p>` : ''}
        </div>
      </div>

      <div class="flex gap-1.5 mt-2">
        ${review.review_status === 'pending' ? `
          <button onclick="updateReviewStatus(${review.id}, 'in_progress')" class="px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-slate-100 text-xs transition-colors">Start Review</button>
        ` : ''}
        ${review.review_status === 'in_progress' ? `
          <button onclick="updateReviewStatus(${review.id}, 'completed')" class="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-slate-100 text-xs transition-colors">Mark Complete</button>
        ` : ''}
        ${review.review_status !== 'completed' ? `
          <button onclick="updateReviewStatus(${review.id}, 'rejected')" class="px-3 py-1 rounded bg-red-600 hover:bg-red-500 text-slate-100 text-xs transition-colors">Reject</button>
        ` : ''}
      </div>
    </div>`;
  });
  html += '</div>';
  root.innerHTML = html;
}

function setFilter(filter) {
  currentFilter = filter;
  document.querySelectorAll('.filter-tab').forEach(tab => {
    if (tab.dataset.filter === filter) {
      tab.classList.add('bg-violet-600', 'text-slate-100');
      tab.classList.remove('text-slate-400', 'hover:text-slate-100');
    } else {
      tab.classList.remove('bg-violet-600', 'text-slate-100');
      tab.classList.add('text-slate-400', 'hover:text-slate-100');
    }
  });
  renderReviews();
}

async function updateReviewStatus(reviewId, status) {
  try {
    await apiFetch(`/api/admin/reviews/${reviewId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    showToast('Review status updated');
    await loadData();
    updateStats();
    renderReviews();
  } catch(e) {
    showToast(e.message, true);
  }
}

function showAssignModal() {
  document.getElementById('assignModal').classList.remove('hidden');
  // Reset custom dropdowns
  if (instructorDropdown) instructorDropdown.clear();
  if (reviewerDropdown) reviewerDropdown.clear();
  meetingDropdown = createDarkSearchableSelect({
    containerId: 'meetingSelectContainer',
    placeholder: 'Select instructor first...',
    dataSource: [],
    displayField: 'name',
    valueField: 'id',
    onSelect: () => {}
  });
  document.getElementById('bulkAssign').checked = false;
}

function hideAssignModal() {
  document.getElementById('assignModal').classList.add('hidden');
}

async function assignReviewer() {
  const instructorId = instructorDropdown ? instructorDropdown.getValue() : null;
  const meetingId = meetingDropdown ? meetingDropdown.getValue() : null;
  const reviewerId = reviewerDropdown ? reviewerDropdown.getValue() : null;
  const isBulk = document.getElementById('bulkAssign').checked;

  if (!instructorId) {
    showToast('Please select an instructor', true);
    return;
  }

  if (!reviewerId) {
    showToast('Please select a reviewer', true);
    return;
  }

  if (!isBulk && !meetingId) {
    showToast('Please select a meeting or enable bulk assignment', true);
    return;
  }

  try {
    if (isBulk) {
      const data = await apiFetch('/api/admin/reviews/assign-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instructor_id: instructorId, reviewer_id: reviewerId })
      });
      showToast(data.message || `Assigned ${data.assigned} meetings successfully`);
    } else {
      await apiFetch('/api/admin/reviews/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meeting_id: meetingId, reviewer_id: reviewerId })
      });
      showToast('Reviewer assigned successfully');
    }
    
    hideAssignModal();
    await loadData();
    updateStats();
    renderReviews();
  } catch(e) {
    showToast(e.message, true);
  }
}

function getStatusColor(status) {
  switch(status) {
    case 'pending': return 'bg-amber-500/10 text-amber-800 border border-amber-500/20';
    case 'in_progress': 
    case 'in-progress': return 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
    case 'completed': return 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20';
    case 'rejected': return 'bg-red-500/10 text-red-400 border border-red-500/20';
    default: return 'bg-slate-500/10 text-slate-400 border border-slate-500/20';
  }
}

function getStatusText(status) {
  switch(status) {
    case 'pending': return 'Pending';
    case 'in_progress': 
    case 'in-progress': return 'In Progress';
    case 'completed': return 'Completed';
    case 'rejected': return 'Rejected';
    default: return 'Unknown';
  }
}

function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-US', { 
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function escapeHtml(s) {
  if (!s) return '';
  const div = document.createElement('div');
  div.textContent = String(s);
  return div.innerHTML;
}

// Initialize filter
setFilter('');