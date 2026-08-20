// Video Processing Page JS - Super Admin Settings
document.addEventListener('DOMContentLoaded', () => {
  const videosTableBody = document.getElementById('videosTableBody');
  const convertModal = document.getElementById('convertModal');
  const processModal = document.getElementById('processModal');
  const convertVideoFile = document.getElementById('convertVideoFile');
  const processVideoFile = document.getElementById('processVideoFile');
  const convertMp3Status = document.getElementById('convertMp3Status');
  const processMp3Status = document.getElementById('processMp3Status');
  const convertBtn = document.getElementById('convertBtn');
  const processBtn = document.getElementById('processBtn');
  let videosCache = {};   // filename -> video meta (for modal state checks)

  // Load videos from the API
  async function loadVideos() {
    try {
      const response = await fetch('/api/super_admin/settings/video-processing', { credentials: 'include' });
      const data = await response.json();
      if (data.success && Array.isArray(data.data)) {
        // Cache by filename so modals can check current mp3 status.
        videosCache = {};
        data.data.forEach(v => { videosCache[v.fileName] = v; });
        renderTable(data.data);
      } else {
        showToast('No video data available', 'info');
      }
    } catch (err) {
      console.error('Error loading videos:', err);
      showToast('Error loading videos', 'error');
    }
  }

  // Status badge color based on processing state
  function statusLabelColor(video) {
    if (video.processed) return 'bg-violet-100 text-violet-700';
    if (video.mp3Exists) return 'bg-red-100 text-red-700';
    return 'bg-amber-100 text-amber-700';
  }

  // Detect the "named" video type:
  // <instructorId>_<First>_<Last>_<extMeetingId>_<sessionId>_<Title>_<YYYY_MM_DD>_<hash>.mp4
  function isNamedVideo(fileName) {
    return /^\d{1,10}_[A-Za-z]+_[A-Za-z]+_[A-Za-z0-9]+_\d+_.+\d{4}_\d{2}_\d{2}_[A-Za-z0-9]+\.mp4$/i.test(fileName);
  }

  // Convert button: enabled when no MP3 yet (server-provided canConvert).
  function convertButtonHtml(video, canConvert) {
    if (!canConvert) {
      return '<button type="button" class="px-2 py-1 text-[10px] rounded bg-slate-200 text-slate-400 cursor-not-allowed" disabled>Convert</button>';
    }
    return '<button type="button" class="convert-btn px-2 py-1 text-[10px] rounded bg-cyan-600 hover:bg-cyan-500 text-white font-semibold" data-file="' + video.fileName + '">Convert</button>';
  }

  // Process button: enabled only when the MP3 exists and the session is NOT yet
  // processed (no ai_audit_results rows). When already processed it is disabled.
  // When the MP3 exists but processing failed/not done, show "Re-process".
  function processButtonHtml(video, canProcess) {
    if (!canProcess) {
      return '<button type="button" class="px-2 py-1 text-[10px] rounded bg-slate-200 text-slate-400 cursor-not-allowed" disabled>Process</button>';
    }
    // MP3 exists but not fully processed yet -> offer Re-process.
    const label = video.mp3Exists && !video.processed ? 'Re-process' : 'Process';
    return '<button type="button" class="process-btn px-2 py-1 text-[10px] rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold" data-file="' + video.fileName + '">' + label + '</button>';
  }

  // Render the videos table
  function renderTable(videos) {
    videosTableBody.innerHTML = '';

    // Populate stat cards
    const statTotal = document.getElementById('statTotalVideos');
    const statConverted = document.getElementById('statConverted');
    const statPending = document.getElementById('statPending');
    const statProcessed = document.getElementById('statProcessed');
    if (statTotal) statTotal.textContent = videos.length;
    if (statConverted) statConverted.textContent = videos.filter(v => v.mp3Exists && !v.processed).length;
    if (statPending) statPending.textContent = videos.filter(v => !v.mp3Exists).length;
    if (statProcessed) statProcessed.textContent = videos.filter(v => v.processed).length;

    if (!videos.length) {
      videosTableBody.innerHTML = '<tr><td colspan="5" class="py-3 px-2 text-center text-cyan-800 text-[10px]">No videos found in storage/screen-recordings</td></tr>';
      return;
    }
    videos.forEach(video => {
      const tr = document.createElement('tr');
      tr.className = 'hover:bg-white/60';
      // Use server-provided flags for enable/disable (authoritative).
      const canConvert = video.canConvert;
      const canProcess = video.canProcess;
      const statusLabel = video.processed ? 'Processed'
        : video.mp3Exists ? 'Process failed'
        : 'Pending';
      tr.innerHTML = '<td class="py-1.5 px-2 text-cyan-950 font-medium">' + video.fileName + '</td>'
        + '<td class="py-1.5 px-2 text-cyan-800">' + video.size + ' MB</td>'
        + '<td class="py-1.5 px-2 text-cyan-800">' + video.duration + '</td>'
        + '<td class="py-1.5 px-2"><span class="px-2 py-0.5 rounded text-[10px] font-semibold ' + statusLabelColor(video) + '">' + statusLabel + '</span></td>'
        + '<td class="py-1.5 px-2 space-x-1.5">'
        + convertButtonHtml(video, canConvert)
        + processButtonHtml(video, canProcess)
        + '</td>';
      videosTableBody.appendChild(tr);
    });

    // Bind button events
    document.querySelectorAll('.convert-btn').forEach(btn => {
      btn.addEventListener('click', () => openConvertModal(btn.getAttribute('data-file')));
    });
    document.querySelectorAll('.process-btn').forEach(btn => {
      btn.addEventListener('click', () => openProcessModal(btn.getAttribute('data-file')));
    });
  }

  // Open convert modal
  function openConvertModal(fileName) {
    const video = videosCache[fileName];
    // Convert works on the .mp4 video file link.
    convertVideoFile.value = (video && video.videoPath) || fileName;
    convertMp3Status.textContent = (video && video.mp3Exists) ? 'MP3 already exists — convert disabled' : 'MP3 not found — convert available';
    convertBtn.textContent = 'Convert to MP3';
    convertBtn.disabled = !!(video && video.mp3Exists);
    convertBtn.classList.toggle('opacity-50', !!(video && video.mp3Exists));
    convertBtn.onclick = () => convertAudio(fileName);
    convertModal.classList.remove('hidden');
    setTimeout(() => convertModal.classList.add('opacity-100'), 10);
  }

  // Open process modal
  function openProcessModal(fileName) {
    const video = videosCache[fileName];
    // Process works on the .mp3 audio file link.
    processVideoFile.value = (video && video.audioPath) || fileName;
    processMp3Status.textContent = (video && video.mp3Exists) ? 'MP3 exists — processing available' : 'MP3 required before processing';
    processBtn.textContent = 'Process Audio';
    processBtn.disabled = !(video && video.mp3Exists);
    processBtn.classList.toggle('opacity-50', !(video && video.mp3Exists));
    processBtn.onclick = () => processAudio(fileName);
    processModal.classList.remove('hidden');
    setTimeout(() => processModal.classList.add('opacity-100'), 10);
  }

  // Convert to audio
  async function convertAudio(fileName) {
    if (convertBtn.disabled) return;             // guard against duplicate clicks
    convertBtn.disabled = true;                   // disable while in-flight
    convertBtn.textContent = 'Converting...';
    try {
      // The backend model performs all DB work (users, calendar_connections,
      // meetings, meeting_sessions, meeting_assets) as part of the conversion.
      // Send the .mp4 video file link.
      const video = videosCache[fileName];
      const videoPath = (video && video.videoPath) || fileName;

      const response = await fetch('/api/super_admin/settings/video-processing/convert', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoPath })
      });
      const result = await response.json();
      if (result.success) {
        if (result.data && result.data.alreadyExists) {
          showToast('MP3 already exists', 'success');
        } else {
          showToast('Conversion started', 'success');
          closeModals();
          loadVideos();
        }
      } else {
        showToast('Conversion failed: ' + (result.error || 'unknown error'), 'error');
      }
    } catch (err) {
      console.error('Convert error:', err);
      showToast('Conversion failed', 'error');
    } finally {
      convertBtn.disabled = false;
      convertBtn.textContent = 'Convert to MP3';
    }
  }

  // Process audio
  async function processAudio(fileName) {
    if (processBtn.disabled) return;              // guard against duplicate clicks
    processBtn.disabled = true;                   // disable while in-flight
    processBtn.textContent = 'Processing...';
    try {
      // Send the .mp3 audio file link + meeting_id + session_id so the backend
      // can pass them straight to the Python bridge (runFullAudioPipeline).
      const video = videosCache[fileName];
      // Prefer the video record's audioPath (the .mp3 link); otherwise derive the
      // mp3 path from the .mp4 file name so we never send the video file itself.
      const audioPath = (video && video.audioPath)
        || '/storage/recordings/' + fileName.replace(/^SCREEN_/i, 'REC_').replace(/\.mp4$/i, '.mp3');
      const meetingId = (video && video.meetingId) || null;
      const sessionId = (video && video.sessionId) || null;

      const response = await fetch('/api/super_admin/settings/video-processing/process', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioPath, meetingId, sessionId })
      });
      const result = await response.json();
      if (result.success) {
        if (result.data && result.data.alreadyExists) {
          showToast('Processing completed — MP3 saved', 'success');
        } else {
          showToast('Audio processing started', 'success');
        }
        closeModals();
        loadVideos();
      } else {
        showToast('Processing failed: ' + (result.error || 'unknown error'), 'error');
      }
    } catch (err) {
      console.error('Process error:', err);
      showToast('Processing failed', 'error');
    } finally {
      processBtn.disabled = false;
      processBtn.textContent = 'Process Audio';
    }
  }

  // Close modals
  function closeModals() {
    convertModal.classList.add('hidden');
    convertModal.classList.remove('opacity-100');
    processModal.classList.add('hidden');
    processModal.classList.remove('opacity-100');
  }

  // Click outside to close
  convertModal.addEventListener('click', (e) => { if (e.target === convertModal) closeModals(); });
  processModal.addEventListener('click', (e) => { if (e.target === processModal) closeModals(); });

  // Close buttons (data-close)
  document.querySelectorAll('[data-close]').forEach(el => el.addEventListener('click', closeModals));

  // Refresh button
  const refreshBtn = document.getElementById('refreshBtn');
  if (refreshBtn) refreshBtn.addEventListener('click', loadVideos);

  // Initialize
  loadVideos();
});

// Toast notification
function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  const toastMessage = document.getElementById('toastMessage');
  const toastIcon = document.getElementById('toastIcon');

  if (!toast || !toastMessage) return;

  toastMessage.textContent = message;

  if (type === 'success') {
    toastIcon.innerHTML = '<svg class="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>';
  } else if (type === 'error') {
    toastIcon.innerHTML = '<svg class="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>';
  } else {
    toastIcon.innerHTML = '<svg class="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>';
  }

  toast.classList.remove('translate-y-20', 'opacity-0');
  setTimeout(() => {
    toast.classList.add('translate-y-20', 'opacity-0');
  }, 3000);
}
