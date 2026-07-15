let currentFilter = '';
let allReviews = [];
let allMeetings = [];
let allReviewers = [];

(async () => {
  await loadData();
  updateStats();
  renderReviews();
  await loadMeetingsAndReviewers();
})();

async function loadData() {
  try {
    const data = await apiFetch('/api/reviews/queue' + (currentFilter ? `?status=${currentFilter}` : ''));
    allReviews = data.reviews || [];
  } catch(e) {
    document.getElementById('reviewsRoot').innerHTML = `<p class="text-red-400">Failed to load reviews: ${e.message}</p>`;
  }
}

async function loadMeetingsAndReviewers() {
  try {
    const [meetingsData, reviewersData] = await Promise.all([
      apiFetch('/api/meetings/list'),
      apiFetch('/api/reviews/reviewers')
    ]);
    allMeetings = meetingsData.meetings || [];
    allReviewers = reviewersData.reviewers || [];
    
    // Populate meeting select
    const meetingSelect = document.getElementById('meetingSelect');
    meetingSelect.innerHTML = '<option value="">Select meeting...</option>';
    allMeetings.forEach(m => {
      meetingSelect.innerHTML += `<option value="${m.meeting_id}">${escapeHtml(m.title)} - ${formatDate(m.start_time)}</option>`;
    });

    // Populate reviewer select
    const reviewerSelect = document.getElementById('reviewerSelect');
    reviewerSelect.innerHTML = '<option value="">Select reviewer...</option>';
    allReviewers.forEach(r => {
      reviewerSelect.innerHTML += `<option value="${r.id}">${escapeHtml(r.first_name)} ${escapeHtml(r.last_name || '')} (${escapeHtml(r.email)})</option>`;
    });
  } catch(e) {
    console.error('Failed to load meetings/reviewers:', e);
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
          <h3 class="text-sm font-semibold text-white">${escapeHtml(review.meeting_title || 'Untitled Meeting')}</h3>
          <p class="text-xs text-slate-400 mt-0.5">${formatDate(review.start_time)} • ${review.platform || 'Unknown Platform'}</p>
        </div>
        <span class="px-1.5 py-0.5 rounded text-[10px] font-medium ${statusColor}">${statusText}</span>
      </div>
      
      <div class="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
        <div>
          <p class="text-[10px] text-slate-500">Reviewer</p>
          <p class="text-white">${escapeHtml(review.reviewer_name || 'Unknown')}</p>
          <p class="text-[10px] text-slate-400">${escapeHtml(review.reviewer_email || '')}</p>
        </div>
        <div>
          <p class="text-[10px] text-slate-500">Assigned By</p>
          <p class="text-white">${escapeHtml(review.assigned_by_name || 'System')}</p>
          <p class="text-[10px] text-slate-400">${formatDate(review.assigned_at)}</p>
        </div>
        <div>
          <p class="text-[10px] text-slate-500">Progress</p>
          <p class="text-white">${review.score_count || 0} scores</p>
          ${review.reviewed_at ? `<p class="text-[10px] text-slate-400">Completed: ${formatDate(review.reviewed_at)}</p>` : ''}
        </div>
      </div>

      <div class="flex gap-1.5 mt-2">
        ${review.review_status === 'pending' ? `
          <button onclick="updateReviewStatus(${review.id}, 'in_progress')" class="px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs transition-colors">Start Review</button>
        ` : ''}
        ${review.review_status === 'in_progress' ? `
          <button onclick="updateReviewStatus(${review.id}, 'completed')" class="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs transition-colors">Mark Complete</button>
        ` : ''}
        ${review.review_status !== 'completed' ? `
          <button onclick="updateReviewStatus(${review.id}, 'rejected')" class="px-3 py-1 rounded bg-red-600 hover:bg-red-500 text-white text-xs transition-colors">Reject</button>
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
      tab.classList.add('bg-violet-600', 'text-white');
      tab.classList.remove('text-slate-400', 'hover:text-white');
    } else {
      tab.classList.remove('bg-violet-600', 'text-white');
      tab.classList.add('text-slate-400', 'hover:text-white');
    }
  });
  renderReviews();
}

async function updateReviewStatus(reviewId, status) {
  try {
    await apiFetch(`/api/reviews/${reviewId}/status`, {
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
}

function hideAssignModal() {
  document.getElementById('assignModal').classList.add('hidden');
  document.getElementById('meetingSelect').value = '';
  document.getElementById('reviewerSelect').value = '';
}

async function assignReviewer() {
  const meetingId = document.getElementById('meetingSelect').value;
  const reviewerId = document.getElementById('reviewerSelect').value;
  
  if (!meetingId || !reviewerId) {
    showToast('Please select both meeting and reviewer', true);
    return;
  }

  try {
    await apiFetch('/api/reviews/assign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ meeting_id: meetingId, reviewer_id: reviewerId })
    });
    showToast('Reviewer assigned successfully');
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