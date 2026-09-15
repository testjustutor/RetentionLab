/**
 * public/js/admin/content/recordings.js
 */

var PLAT = { 'google-meet':'Google Meet','zoom':'Zoom','teams':'Teams' };
var allRecordings = [];
var recordingsTable = null;

function fmtTime(iso){if(!iso)return'--';var d=new Date(iso);return d.toLocaleDateString([],{month:'short',day:'numeric'})+' '+d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});}
function fmtDuration(s,e){if(!s||!e)return'--';var m=Math.round((new Date(e)-new Date(s))/60000);if(m<60)return m+'m';var h=Math.floor(m/60);m=m%60;return h+'h'+(m>0?' '+m+'m':'');}

// Map a file extension (from the audio URL) to a proper MIME type for the
// <source type="..."> attribute. Previously this was hardcoded to
// "audio/wav" regardless of the actual file extension, which can cause
// browsers to refuse playback of non-wav files (e.g. .mp3).
function getAudioMimeType(url) {
  var ext = (String(url).split('.').pop() || '').toLowerCase().split('?')[0];
  switch (ext) {
    case 'mp3': return 'audio/mpeg';
    case 'wav': return 'audio/wav';
    case 'ogg': return 'audio/ogg';
    case 'm4a': return 'audio/mp4';
    case 'aac': return 'audio/aac';
    case 'flac': return 'audio/flac';
    default: return 'audio/mpeg';
  }
}

// Normalizes an audio URL coming back from the API so the browser resolves
// it against the site root instead of the current page path. Without this,
// a relative path like "storage/recordings/foo.mp3" gets resolved against
// whatever page you're on (e.g. /admin/content/...), producing a broken
// URL such as /admin/content/storage/recordings/foo.mp3 -> 404.
function normalizeAudioUrl(url) {
  if (!url) return url;
  if (/^https?:\/\//i.test(url)) return url; // already absolute (has protocol)
  if (url.startsWith('/')) return url; // already root-relative
  return '/' + url.replace(/^\.?\/+/, ''); // strip leading "./" or "/" then re-root
}

function getFilterParams() {
  const fromDate = document.getElementById('filterFromDate')?.value || '';
  const toDate = document.getElementById('filterToDate')?.value || '';
  const userId = window.instructorFilter ? window.instructorFilter.getValue() : null;
  const params = new URLSearchParams();
  if (fromDate) params.append('from_date', fromDate);
  if (toDate) params.append('to_date', toDate);
  if (userId) params.append('user_id', userId);
  return params.toString();
}

function setDefaultDateRange() {
  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const fromEl = document.getElementById('filterFromDate');
  const toEl = document.getElementById('filterToDate');
  if (fromEl && !fromEl.value) fromEl.value = weekAgo.toISOString().split('T')[0];
  if (toEl && !toEl.value) toEl.value = now.toISOString().split('T')[0];
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

async function fetchRecordings() {
  try {
    const userId = window.instructorFilter ? window.instructorFilter.getValue() : null;
    const fromDate = document.getElementById('filterFromDate')?.value || '';
    const toDate = document.getElementById('filterToDate')?.value || '';
    
    // Get logged-in user UUID from localStorage
    const currentUser = JSON.parse(localStorage.getItem('rl_user') || '{}');
    const loggedInUser = currentUser?.user_uuid || null;
    
    var json = await apiFetch('/api/admin/content/audio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: userId || undefined,
        startDate: fromDate || undefined,
        endDate: toDate || undefined,
        loggedInUser: loggedInUser || undefined
      })
    });
    allRecordings = json.recordings || [];
    
    // Debug: Log first recording to see actual data structure
    if (allRecordings.length > 0) {
      // console.log('First recording data:', allRecordings[0]);
    }
  } catch(err) {
    console.error('Failed to fetch recordings:', err);
    allRecordings = [];
  }
}

function applySearchFilter() {
  const searchTerm = (document.getElementById('searchInput')?.value || '').toLowerCase();
  var filtered = allRecordings;
  if (searchTerm) {
    filtered = allRecordings.filter(function(r) {
      return (r.title || '').toLowerCase().includes(searchTerm);
    });
  }
  
  if (!recordingsTable) {
    recordingsTable = createTable({
      containerId: 'recordingsContainer',
      headers: [
        { label: 'Meeting', key: 'title', render: function(value) {
          return '<p class="font-medium truncate max-w-[150px] text-slate-900">' + escHtml(value || 'Untitled') + '</p>';
        }},
        { label: 'Instructor', key: 'instructor_name', render: function(value, row) {
          return '<p class="text-xs text-slate-900">' + escHtml(value || 'Unknown') + '</p>' +
            '<p class="text-[10px] text-slate-500">' + escHtml(row.instructor_email || '') + '</p>';
        }},
        { label: 'Date & Time', key: 'start_time', render: function(value) {
          return '<span class="text-xs text-slate-500">' + fmtTime(value) + '</span>';
        }},
        { label: 'Duration', key: 'start_time', render: function(value, row) {
          return '<span class="text-xs text-slate-500">' + fmtDuration(value, row.end_time) + '</span>';
        }},
        { label: 'Platform', key: 'platform', render: function(value) {
          return '<span class="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">' + escHtml(PLAT[value] || value || 'Unknown') + '</span>';
        }},
        { label: 'Recording', key: 'has_recording', render: function(value, row) {
          var cls = value ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-slate-100 text-slate-500 border-slate-200';
          var label = value ? 'Available' : (row.asset_status === 'Conversion' ? 'Processing' : 'Not Started');
          return '<span class="inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-medium ' + cls + '">' + label + '</span>';
        }},
        { label: 'Status', key: 'status', render: function(value) {
          var cls = value === 'completed' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-amber-500/10 text-amber-800 border-amber-500/20';
          return '<span class="inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-medium ' + cls + '">' + (value || 'unknown') + '</span>';
        }},
        {
          label: 'Play',
          key: 'has_recording',
          // Fixed: the <source type="..."> was hardcoded to "audio/wav"
          // regardless of the actual file extension (e.g. .mp3), which can
          // cause some browsers to refuse playback even when the file
          // itself loads. MIME type is now derived from the URL's
          // extension, the URL is normalized to be root-relative (fixes
          // 404s caused by relative paths resolving against the current
          // page instead of the site root) and escaped, and each row gets
          // a unique audio element id so we can attach an error listener
          // that surfaces a message if the file 404s or fails to decode
          // (previously it just failed silently).
          render: function(value, row) {
            const rawAudioUrl = row.play_url || row.audio_url;
            if (!(value && rawAudioUrl)) {
              return '<span class="text-[10px] text-slate-600">--</span>';
            }
            var audioUrl = normalizeAudioUrl(rawAudioUrl);
            var mime = getAudioMimeType(audioUrl);
            var audioId = 'rec-audio-' + (row.meeting_id || row.id || Math.random().toString(36).slice(2));
            return '<div class="flex flex-col gap-0.5">' +
              '<audio id="' + audioId + '" controls preload="none" class="h-6 w-32" data-audio-id="' + audioId + '"><source src="' + escHtml(audioUrl) + '" type="' + mime + '"></audio>' +
              '<span id="' + audioId + '-error" class="hidden text-[9px] text-red-500">Failed to load audio</span>' +
            '</div>';
          }
        }
      ],
      data: filtered,
      emptyMessage: 'No recordings found',
      pagination: { perPage: 10 }
    });
    recordingsTable.render();
    attachAudioErrorHandlers();
  } else {
    recordingsTable.setData(filtered);
    attachAudioErrorHandlers();
  }
}

// Attaches an 'error' listener to every rendered <audio> element so a
// failed load (404, missing file, unsupported format, etc.) shows a
// visible message next to the player instead of failing with no feedback.
function attachAudioErrorHandlers() {
  document.querySelectorAll('audio[data-audio-id]').forEach(function(audioEl) {
    if (audioEl.dataset.errorBound) return; // avoid double-binding on re-render
    audioEl.dataset.errorBound = 'true';
    audioEl.addEventListener('error', function() {
      var errorEl = document.getElementById(audioEl.dataset.audioId + '-error');
      if (errorEl) errorEl.classList.remove('hidden');
    });
  });
}

async function loadRecordings() {
  if (recordingsTable) {
    recordingsTable.setLoading(true);
  }
  await fetchRecordings();
  if (recordingsTable) {
    recordingsTable.setLoading(false);
  }
  applySearchFilter();
}

function escHtml(s) {
  if (!s) return '';
  const div = document.createElement('div');
  div.textContent = String(s);
  return div.innerHTML;
}

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
setTimeout(function() { loadRecordings(); }, 500);