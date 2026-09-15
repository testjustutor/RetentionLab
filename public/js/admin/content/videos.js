/**
 * public/js/admin/content/videos.js
 */

var PLAT = { 'google-meet':'Google Meet','zoom':'Zoom','teams':'Teams' };
var allVideos = [];
var videosTable = null;

function fmtTime(iso){if(!iso)return'--';var d=new Date(iso);return d.toLocaleDateString([],{month:'short',day:'numeric'})+' '+d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});}
function fmtDuration(s,e){if(!s||!e)return'--';var m=Math.round((new Date(e)-new Date(s))/60000);if(m<60)return m+'m';var h=Math.floor(m/60);m=m%60;return h+'h'+(m>0?' '+m+'m':'');}

function setDefaultDateRange() {
  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const fromEl = document.getElementById("filterFromDate");
  const toEl = document.getElementById("filterToDate");
  if (fromEl && !fromEl.value) fromEl.value = weekAgo.toISOString().split("T")[0];
  if (toEl && !toEl.value) toEl.value = now.toISOString().split("T")[0];
}
function getOqiColorClass(score) {
  if (score >= 90) return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
  if (score >= 80) return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
  if (score >= 70) return 'bg-amber-500/10 text-amber-800 border-amber-500/20';
  return 'bg-red-500/10 text-red-600 border-red-500/20';
}

async function loadInstructors() {
  const instructorFilter = createSearchableSelect({
    containerId: 'instructorFilterContainer',
    placeholder: 'Select instructor...',
    dataSource: async (searchTerm) => {
      try {
        const json = await apiFetch('/api/admin/content/instructors');
        let instructors = json.instructors || [];
        if (searchTerm) {
          const term = searchTerm.toLowerCase();
          instructors = instructors.filter(inst => 
            (inst.name || '').toLowerCase().includes(term) ||
            (inst.email || '').toLowerCase().includes(term)
          );
        }
        return instructors;
      } catch { return []; }
    },
    displayField: 'name',
    valueField: 'uuid',
    onSelect: (selectedId) => {
      window.selectedInstructorId = selectedId || null;
    }
  });
  window.instructorFilter = instructorFilter;
}

async function fetchVideos() {
  try {
    const instructorId = window.instructorFilter ? window.instructorFilter.getValue() : null;
    const fromDate = document.getElementById('filterFromDate')?.value || '';
    const toDate = document.getElementById('filterToDate')?.value || '';

    const json = await apiFetch('/api/admin/content/videos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        startDate: fromDate || undefined,
        endDate: toDate || undefined,
        instructorId: instructorId || undefined
      })
    });
    allVideos = json.recordings || [];
  } catch (err) {
    console.error('Failed to fetch videos:', err);
    allVideos = [];
  }
}

function applySearchFilter() {
  const searchTerm = (document.getElementById('searchInput')?.value || '').toLowerCase();
  var filtered = allVideos;
  if (searchTerm) {
    filtered = allVideos.filter(function(v) {
      return (v.title || '').toLowerCase().includes(searchTerm) ||
             (v.instructor_name || '').toLowerCase().includes(searchTerm);
    });
  }

  if (!videosTable) {
    videosTable = createTable({
      containerId: 'videosContainer',
      headers: [
        { label: 'Title', key: 'title', render: function(value, row) {
          return '<p class="font-medium truncate max-w-[200px] text-slate-900">' + escHtml(value || 'Untitled') + '</p>' +
            (row.description ? '<p class="text-[10px] text-slate-500">' + escHtml(row.description) + '</p>' : '');
        }},
        { label: 'Instructor', key: 'instructor_name', render: function(value, row) {
          return '<p class="text-xs text-slate-900">' + escHtml(value || '--') + '</p>' +
            '<p class="text-[10px] text-slate-500">' + escHtml(row.instructor_email || '') + '</p>';
        }},
        { label: 'Platform', key: 'platform', render: function(value) {
          return '<span class="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">' + escHtml(PLAT[value] || value || 'Unknown') + '</span>';
        }},
        { label: 'Date', key: 'scheduled_start_time', render: function(value) {
          return '<span class="text-xs text-slate-500">' + fmtTime(value) + '</span>';
        }},
        { label: 'Duration', key: 'session_start_time', render: function(value, row) {
          return '<span class="text-xs text-slate-500">' + fmtDuration(value, row.session_end_time) + '</span>';
        }},
        { label: 'OQI Score', key: 'oqi_score', render: function(value) {
          if (!value) return '<span class="text-slate-600">N/A</span>';
          return '<span class="inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-medium ' + getOqiColorClass(parseFloat(value)) + '">' + parseFloat(value).toFixed(1) + '</span>';
        }},
        { label: 'Actions', key: 'has_video', render: function(value, row) {
          return value ? '<button onclick="playVideo(' + row.meeting_id + ')" class="px-3 py-1.5 rounded-md bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium transition-colors">Play</button>'
            : '<span class="text-[10px] text-slate-600">No video</span>';
        }}
      ],
      data: filtered,
      emptyMessage: 'No videos found',
      pagination: { perPage: 10 }
    });
    videosTable.render();
  } else {
    videosTable.setData(filtered);
  }
}

async function loadVideos() {
  if (videosTable) videosTable.setLoading(true);
  await fetchVideos();
  if (videosTable) videosTable.setLoading(false);
  applySearchFilter();
}

// Play video
window.playVideo = async function(meetingId) {
  try {
    const json = await apiFetch('/api/admin/content/videos/' + meetingId);
    if (json.success && json.recording) {
      const rec = json.recording;
      document.getElementById('modal-title').textContent = rec.title;
      document.getElementById('modal-instructor').textContent = rec.instructor_name;
      document.getElementById('modal-platform').textContent = rec.platform || 'unknown';
      document.getElementById('modal-date').textContent = fmtTime(rec.scheduled_start_time);
      document.getElementById('modal-duration').textContent = fmtDuration(rec.session_start_time, rec.session_end_time);

      if (rec.video_url) {
        document.getElementById('video-source').src = rec.video_url;
        document.getElementById('video-player').load();
        document.getElementById('video-modal').classList.remove('hidden');
        document.getElementById('video-modal').classList.add('flex');
        document.getElementById('video-player').play();
      } else {
        showToast('No video available for this recording', true);
      }
    } else {
      showToast(json.error || 'Failed to load recording', true);
    }
  } catch (err) {
    showToast('Failed to load video', true);
  }
};

// Close video modal
document.getElementById('close-modal')?.addEventListener('click', function() {
  document.getElementById('video-modal').classList.add('hidden');
  document.getElementById('video-modal').classList.remove('flex');
  document.getElementById('video-player').pause();
  document.getElementById('video-source').src = '';
});

document.getElementById('video-modal')?.addEventListener('click', function(e) {
  if (e.target === document.getElementById('video-modal')) {
    document.getElementById('video-modal').classList.add('hidden');
    document.getElementById('video-modal').classList.remove('flex');
    document.getElementById('video-player').pause();
    document.getElementById('video-source').src = '';
  }
});

document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape' && !document.getElementById('video-modal').classList.contains('hidden')) {
    document.getElementById('video-modal').classList.add('hidden');
    document.getElementById('video-modal').classList.remove('flex');
    document.getElementById('video-player').pause();
    document.getElementById('video-source').src = '';
  }
});

// Search on input - filter directly from loaded data
document.addEventListener('DOMContentLoaded', function() {
  var searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('input', function() {
      applySearchFilter();
    });
  }
});

// Initialize
setDefaultDateRange();
loadInstructors();

// Auto-load data on page load
setTimeout(function() { loadVideos(); }, 500);
