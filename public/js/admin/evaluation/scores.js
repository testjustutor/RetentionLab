let allCategories = [];
let currentFilter = '';
let filterState = {
  instructorId: '',
  sessionId: '',
  reviewerId: ''
};
let instructorDropdown = null;
let sessionDropdown = null;
let reviewerDropdown = null;
let dateFilter = null;
let scoresTable = null;

(async () => {
  // Initialize centralized date filter (30 days default).
  // "Get Data" button fetches scores with the selected filters/dates.
  dateFilter = createDateFilter({
    days: 30,
    onFilter: () => loadData(1)
  });

  // Load filter dropdowns, then fetch data by default using the default dates.
  await loadFilters();
  await loadData(1);
})();


async function loadFilters() {
  try {
    const [instructorsData, reviewersData] = await Promise.all([
      apiFetch('/api/admin/scores/evaluation/instructors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      }),
      apiFetch('/api/admin/scores/evaluation/reviewers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })
    ]);

    const instructors = instructorsData.instructors || [];
    const reviewers = reviewersData.reviewers || [];

    // Custom instructor dropdown
    const instructorData = instructors.map(i => ({ id: i.id, name: (i.first_name || '') + ' ' + (i.last_name || '') + ' (' + i.email + ')' }));
    instructorDropdown = createSearchableSelect({
      containerId: 'instructorFilterContainer',
      placeholder: 'All Instructors',
      dataSource: instructorData,
      displayField: 'name',
      valueField: 'id',
      onSelect: (value) => {
        filterState.instructorId = value || '';
        if (value) {
          loadSessions(value);
        } else {
          initSessionsDropdown('All Sessions', []);
        }
      }
    });

    // Custom session dropdown (initially empty)
    initSessionsDropdown('All Sessions', []);

    // Custom reviewer dropdown
    const reviewerData = reviewers.map(r => ({ id: r.id, name: r.first_name + ' ' + (r.last_name || '') + ' (' + r.email + ')' }));
    reviewerDropdown = createSearchableSelect({
      containerId: 'reviewerFilterContainer',
      placeholder: 'All Reviewers',
      dataSource: reviewerData,
      displayField: 'name',
      valueField: 'id',
      onSelect: (value) => {
        filterState.reviewerId = value || '';
      }
    });
  } catch(e) {
    console.error('Failed to load filters:', e);
    showToast('Failed to load filters', true);
  }
}

function initSessionsDropdown(placeholder, dataSource) {
  sessionDropdown = createSearchableSelect({
    containerId: 'sessionFilterContainer',
    placeholder,
    dataSource,
    displayField: 'name',
    valueField: 'id',
    onSelect: (value) => {
      filterState.sessionId = value || '';
    }
  });
}

async function loadSessions(instructorId) {
  if (!instructorId) {
    initSessionsDropdown('All Sessions', []);
    return;
  }

  // Loading state
  initSessionsDropdown('Loading sessions...', []);

  try {
    const data = await apiFetch(`/api/admin/scores/sessions/${instructorId}`);
    const sessions = data.sessions || [];

    const sessionData = sessions.length > 0
      ? sessions.map(s => ({ id: s.session_id, name: s.meeting_title + ' - ' + (s.start_time ? formatDate(s.start_time) : 'No date') }))
      : [{ id: '', name: 'No sessions found' }];

    initSessionsDropdown('All Sessions', sessionData);
  } catch(e) {
    console.error('Failed to load sessions:', e);
    initSessionsDropdown('Failed to load', []);
  }
}

async function loadData(page = 1) {
  try {
    // Get dates from centralized date filter
    const { fromDate, toDate } = dateFilter.getDates();
    
    const body = {
      from_date: fromDate,
      to_date: toDate,
      page: page,
      per_page: 10
    };
    
    if (filterState.instructorId) body.instructor_id = filterState.instructorId;
    if (filterState.sessionId) body.session_id = filterState.sessionId;
    if (filterState.reviewerId) body.reviewer_id = filterState.reviewerId;

    const data = await apiFetch('/api/admin/scores/filtered', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    
    // Store the entire response including message and totalCount
    allCategories = data.categories || [];
    allCategories.message = data.message || 'No data available';
    allCategories.totalCount = data.totalCount || 0;
    allCategories.totalPages = data.totalPages || 1;
    allCategories.currentPage = data.currentPage || 1;
    
    // Update stats and render
    updateStats();
    renderScores(page);
    
    showToast(data.message || 'Data loaded successfully');
  } catch(e) {
    console.error('Failed to load scores:', e);
    showToast('Failed to load data: ' + e.message, true);
    allCategories = [];
    updateStats();
    renderScores(1);
  }
}

function updateStats() {
  let totalScores = 0;
  let totalScoreValue = 0;
  let aiCount = 0;
  let humanCount = 0;

  allCategories.forEach(cat => {
    Object.values(cat.indicators).forEach(ind => {
      ind.scores.forEach(score => {
        totalScores++;
        totalScoreValue += (+score.score || 0);
        if (score.score_type === 'AI') aiCount++;
        else humanCount++;
      });
    });
  });

  const avgScore = totalScores > 0 ? (totalScoreValue / totalScores).toFixed(1) : '0.0';
  
  document.getElementById('totalScores').textContent = totalScores;
  document.getElementById('avgScore').textContent = avgScore;
  document.getElementById('aiScores').textContent = aiCount;
  document.getElementById('humanScores').textContent = humanCount;
}

function renderScores(page = 1) {
  // Flatten all categories into a simple array for the table
  let flatScores = [];
  allCategories.forEach(cat => {
    Object.values(cat.indicators || {}).forEach(ind => {
      ind.scores.forEach(score => {
        flatScores.push({
          ...score,
          category_name: cat.category_name,
          indicator_name: ind.indicator_name
        });
      });
    });
  });

  const headers = [
    { label: 'Category', key: 'category_name' },
    { label: 'Indicator', key: 'indicator_name' },
    { label: 'Meeting', key: 'meeting_title' },
    { label: 'Date', key: 'meeting_date', render: (v) => formatDate(v) },
    { label: 'Type', key: 'score_type', render: (v) => v === 'AI' ? '<span class="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-700">AI</span>' : '<span class="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-700">HUMAN</span>' },
    { label: 'Score', key: 'score', render: (v) => `<span class="font-bold ${getScoreColorClass(+v || 0)}">${(+v || 0).toFixed(1)}</span>`, width: '80px' },
    { label: 'Reviewer', key: 'reviewer_name' }
  ];

  // Server-side pagination: tell the table the true total from the API so the
  // footer ("Showing X to Y of Z") and page controls reflect the real dataset.
  const totalCount = allCategories.totalCount || flatScores.length;

  if (!scoresTable) {
    scoresTable = createTable({
      containerId: 'scoresRoot',
      headers,
      data: flatScores,
      emptyMessage: allCategories.message || 'No scores available. Try adjusting your filters or date range.',
      pagination: {
        perPage: 10,
        currentPage: page,
        totalCount: totalCount,
        onPageChange: (newPage) => loadData(newPage)
      }
    });
  } else {
    scoresTable.setData(flatScores);
    scoresTable.setPaginationTotal(totalCount);
    scoresTable.setPaginationPage(page);
  }
}

function toggleCategory(categoryId) {
  const content = document.getElementById(categoryId);
  const chevron = document.getElementById(`chevron-${categoryId}`);
  
  if (content.classList.contains('hidden')) {
    content.classList.remove('hidden');
    chevron.style.transform = 'rotate(0deg)';
  } else {
    content.classList.add('hidden');
    chevron.style.transform = 'rotate(-90deg)';
  }
}

function getScoreColorClass(score) {
  if (score >= 4.0) return 'text-emerald-700';
  if (score >= 3.0) return 'text-blue-700';
  if (score >= 2.0) return 'text-amber-700';
  return 'text-red-600';
}

async function exportScores() {
  try {
    // Flatten all categories into a single array for export
    let allScoresFlat = [];
    allCategories.forEach(cat => {
      Object.values(cat.indicators || {}).forEach(ind => {
        ind.scores.forEach(score => {
          allScoresFlat.push(score);
        });
      });
    });

    const filtered = currentFilter ? allScoresFlat.filter(s => s.score_type === currentFilter) : allScoresFlat;
    
    if (!filtered.length) {
      showToast('No scores to export', true);
      return;
    }

    // Create CSV content
    const headers = ['Meeting Title', 'Meeting Date', 'Category', 'Indicator', 'Score Type', 'Score', 'Reviewer', 'Date'];
    const csvContent = [
      headers.join(','),
      ...filtered.map(score => [
        `"${(score.meeting_title || 'Untitled Meeting').replace(/"/g, '""')}"`,
        formatDate(score.meeting_date),
        `"${(score.category_name || 'Unknown').replace(/"/g, '""')}"`,
        `"${(score.indicator_name || 'Unknown').replace(/"/g, '""')}"`,
        score.score_type || 'HUMAN',
        (+score.score || 0).toFixed(1),
        `"${(score.reviewer_name || 'System').replace(/"/g, '""')}"`,
        formatDate(score.created_at)
      ].join(','))
    ].join('\n');

    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `session-scores-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    showToast('Scores exported successfully');
  } catch(e) {
    showToast('Export failed: ' + e.message, true);
  }
}

function getScoreColor(score) {
  if (score >= 4.0) return 'text-emerald-700';
  if (score >= 3.0) return 'text-blue-700';
  if (score >= 2.0) return 'text-amber-700';
  return 'text-red-600';
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

