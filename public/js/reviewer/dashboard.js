/**
 * public/js/reviewer/dashboard.js
 */

async function loadDashboardData() {
  try {
    const res = await fetch('/api/reviewer/dashboard/stats', {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' }
    });
    if (!res.ok) throw new Error('Failed to fetch stats');
    const data = await res.json();
    
    document.getElementById('pendingCount').textContent = data.pending;
    document.getElementById('inProgressCount').textContent = data.inProgress;
    document.getElementById('completedCount').textContent = data.completed;
    document.getElementById('avgTime').textContent = data.avgReviewTime || 'N/A';
  } catch (err) {
    console.error('Dashboard load error:', err);
  }
}

// Fetch recent assignments
async function loadRecentAssignments() {
  try {
    const res = await fetch('/api/reviewer/dashboard/recent-assignments?limit=5', {
      credentials: 'include'
    });
    if (!res.ok) throw new Error('Failed');
    const data = await res.json();
    
    const container = document.getElementById('recentAssignments');
    if (!data.length) {
      container.innerHTML = '<p>No recent assignments</p>';
      return;
    }
    
    container.innerHTML = data.map(a => `
      <div class="flex items-center justify-between py-1.5 border-b border-emerald-200 last:border-0">
        <div class="min-w-0">
          <p class="text-emerald-950 text-xs font-bold truncate">${a.meeting_title || 'Untitled Meeting'}</p>
          <p class="text-[10px] text-emerald-800">${new Date(a.assigned_at).toLocaleDateString()}</p>
        </div>
        <span class="text-[10px] px-1.5 py-0.5 rounded ml-2 flex-shrink-0 ${a.review_status === 'completed' ? 'bg-emerald-600 text-white' : a.review_status === 'in_progress' ? 'bg-amber-500 text-white' : 'bg-emerald-200 text-emerald-900'}">${a.review_status}</span>
      </div>
    `).join('');
  } catch (err) {
    console.error('Recent assignments error:', err);
  }
}

// Fetch overdue reviews
async function loadOverdueReviews() {
  try {
    const res = await fetch('/api/reviewer/dashboard/overdue', {
      credentials: 'include'
    });
    if (!res.ok) throw new Error('Failed');
    const data = await res.json();
    
    const container = document.getElementById('overdueReviews');
    if (!data.length) {
      container.innerHTML = '<p class="text-emerald-400">No overdue reviews</p>';
      return;
    }
    
    container.innerHTML = data.map(r => `
      <div class="flex items-center justify-between py-1.5 border-b border-rose-200 last:border-0">
        <div class="min-w-0">
          <p class="text-rose-950 text-xs font-bold truncate">${r.meeting_title || 'Untitled Meeting'}</p>
          <p class="text-[10px] text-rose-800">Assigned: ${new Date(r.assigned_at).toLocaleDateString()}</p>
        </div>
        <span class="text-[10px] text-rose-700 ml-2 flex-shrink-0">⚠ Overdue</span>
      </div>
    `).join('');
  } catch (err) {
    console.error('Overdue reviews error:', err);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadDashboardData();
  loadRecentAssignments();
  loadOverdueReviews();
});