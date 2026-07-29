/**
 * public/js/admin/content/videos.js
 * Frontend logic for video recordings page with filters
 */

var PLAT = { 'google-meet':'Google Meet','zoom':'Zoom','teams':'Teams' };
function fmtTime(iso){if(!iso)return'--';var d=new Date(iso);return d.toLocaleDateString([],{month:'short',day:'numeric'})+' '+d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});}
function fmtDuration(s,e){if(!s||!e)return'--';var m=Math.round((new Date(e)-new Date(s))/60000);if(m<60)return m+'m';var h=Math.floor(m/60);m=m%60;return h+'h'+(m>0?' '+m+'m':'');}

// State
var currentFilters = {
  startDate: null,
  endDate: null,
  instructorId: null
};

async function init() {
  await loadComponents();
  await loadInstructors();
  await loadVideos();
  setupEventListeners();
}

// Load sidebar and header components
async function loadComponents() {
  const sidebarPlaceholder = document.getElementById('sidebar-placeholder');
  const headerPlaceholder = document.getElementById('header-placeholder');

  if (sidebarPlaceholder) {
    try {
      const response = await fetch('/sidebar.html');
      const html = await response.text();
      sidebarPlaceholder.innerHTML = html;
    } catch (err) {
      console.error('Failed to load sidebar:', err);
    }
  }

  if (headerPlaceholder) {
    try {
      const response = await fetch('/header.html');
      const html = await response.text();
      headerPlaceholder.innerHTML = html;
    } catch (err) {
      console.error('Failed to load header:', err);
    }
  }
}

// Load instructors for filter dropdown
async function loadInstructors() {
  try {
    const json = await apiFetch('/api/recordings/videos/instructors');
    const instructors = json.instructors || [];
    const select = document.getElementById('filter-instructor');
    select.innerHTML = '<option value="">All Instructors</option>' + 
      instructors.map(function(inst) {
        return '<option value="'+inst.id+'">'+escHtml(inst.name)+'</option>';
      }).join('');
  } catch (err) {
    console.error('Failed to load instructors:', err);
  }
}

// Load videos with current filters
async function loadVideos() {
  const container = document.getElementById('videos-table-body');
  container.innerHTML = '<tr><td colspan="7" class="text-center py-8"><div class="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto"></div><span class="ml-3 text-sm text-slate-400">Loading videos...</span></td></tr>';

  try {
    const params = new URLSearchParams();
    if (currentFilters.startDate) params.append('startDate', currentFilters.startDate);
    if (currentFilters.endDate) params.append('endDate', currentFilters.endDate);
    if (currentFilters.instructorId) params.append('instructorId', currentFilters.instructorId);

    const json = await apiFetch('/api/recordings/videos?' + params.toString());
    const videos = json.recordings || [];
    
    document.getElementById('videos-count').textContent = videos.length + ' video' + (videos.length !== 1 ? 's' : '');

    if (!videos.length) {
      container.innerHTML = '<tr><td colspan="7" class="text-center py-8 text-slate-500">No videos found. Try adjusting your filters.</td></tr>';
      return;
    }

    let html = '';
    videos.forEach(function(v) {
      const date = fmtTime(v.scheduled_start_time);
      const duration = fmtDuration(v.session_start_time, v.session_end_time);
      const oqiScore = v.oqi_score ? v.oqi_score.toFixed(1) : 'N/A';
      const hasVideo = v.has_video;

      html += '<tr class="hover:bg-slate-800/30 transition-colors">';
      html += '<td class="py-2 px-3"><p class="font-medium truncate max-w-[200px]">'+escHtml(v.title)+'</p><p class="text-[10px] text-slate-500">'+escHtml(v.description||'')+'</p></td>';
      html += '<td class="py-2 px-3"><p class="text-sm text-slate-300">'+escHtml(v.instructor_name)+'</p><p class="text-[10px] text-slate-500">'+escHtml(v.instructor_email)+'</p></td>';
      html += '<td class="py-2 px-3"><span class="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">'+escHtml(PLAT[v.platform]||v.platform||'Unknown')+'</span></td>';
      html += '<td class="py-2 px-3 text-slate-400 text-xs">'+date+'</td>';
      html += '<td class="py-2 px-3 text-slate-400 text-xs">'+duration+'</td>';
      html += '<td class="py-2 px-3">' + (v.oqi_score ? '<span class="badge badge-'+getOqiColor(v.oqi_score)+'">'+oqiScore+'</span>' : '<span class="text-slate-600">N/A</span>') + '</td>';
      html += '<td class="py-2 px-3 text-right">' + (hasVideo ? '<button onclick="playVideo('+v.meeting_id+')" class="px-3 py-1.5 rounded-md bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium transition-colors">Play</button>' : '<span class="text-[10px] text-slate-600">No video</span>') + '</td>';
      html += '</tr>';
    });

    container.innerHTML = html;
  } catch (err) {
    container.innerHTML = '<tr><td colspan="7" class="text-center py-8 text-red-400">Failed to load videos: '+escHtml(err.message)+'</td></tr>';
  }
}

// Setup event listeners
function setupEventListeners() {
  document.getElementById('apply-filters').addEventListener('click', function() {
    currentFilters = {
      startDate: document.getElementById('filter-start-date').value || null,
      endDate: document.getElementById('filter-end-date').value || null,
      instructorId: document.getElementById('filter-instructor').value || null
    };
    loadVideos();
  });

  document.getElementById('clear-filters').addEventListener('click', function() {
    document.getElementById('filter-start-date').value = '';
    document.getElementById('filter-end-date').value = '';
    document.getElementById('filter-instructor').value = '';
    currentFilters = {
      startDate: null,
      endDate: null,
      instructorId: null
    };
    loadVideos();
  });

  document.getElementById('close-modal').addEventListener('click', closeVideoModal);
  document.getElementById('video-modal').addEventListener('click', function(e) {
    if (e.target === document.getElementById('video-modal')) closeVideoModal();
  });

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && !document.getElementById('video-modal').classList.contains('hidden')) {
      closeVideoModal();
    }
  });
}

// Play video
window.playVideo = async function(meetingId) {
  try {
    const json = await apiFetch('/api/recordings/videos/' + meetingId);
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
    console.error('Failed to play video:', err);
    showToast('Failed to load video', true);
  }
};

// Close video modal
function closeVideoModal() {
  document.getElementById('video-modal').classList.add('hidden');
  document.getElementById('video-modal').classList.remove('flex');
  document.getElementById('video-player').pause();
  document.getElementById('video-source').src = '';
}

// Utility: Get OQI score color
function getOqiColor(score) {
  if (score >= 90) return 'success';
  if (score >= 80) return 'primary';
  if (score >= 70) return 'warning';
  return 'danger';
}

// Utility: Escape HTML
function escHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}