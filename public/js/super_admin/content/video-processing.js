/**
 * public/js/super_admin/content/video-processing.js
 * (Moved from public/js/super_admin/settings/ — page now lives under
 * /super_admin/content/video-processing. The API endpoints below are
 * unchanged and still live under /api/super_admin/content/video-processing.)
 *
 * AI Transcript calls Deepgram directly via POST .../video-processing/transcript
 * (in videoProcessingController.js — requires DEEPGRAM_API_KEY in .env). This
 * is a SEPARATE, fast, speaker-labelled transcript — not the Whisper transcript
 * that Generate Report produces as part of the full audit pipeline. The old
 * standalone "Deepgram Processing" page/route/controller/model were deleted
 * and are NOT used here; this endpoint lives entirely inside video-processing.
 */

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
  const uploadModal = document.getElementById('uploadModal');
  const uploadFileInput = document.getElementById('uploadFileInput');
  const uploadBtn = document.getElementById('uploadBtn');
  const uploadHint = document.getElementById('uploadHint');
  const convertProcessing = document.getElementById('convertProcessing');
  const processProcessing = document.getElementById('processProcessing');
  let videosCache = {};   // filename -> video meta (for modal state checks)
  let isConverting = false;            // true while a Convert request is in flight
  let isProcessing = false;            // true while a Process (report/transcript) request is in flight
  let activeProcessMode = 'report';    // which action the process modal is running: 'report' | 'transcript'
  const DEFAULT_CONVERT_BTN_HTML = convertBtn ? convertBtn.innerHTML : '';
  const DEFAULT_PROCESS_BTN_HTML = processBtn ? processBtn.innerHTML : '';
  const BUSY_SVG = '<svg class="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>';

  // Load videos from the API
  async function loadVideos() {
    try {
      const response = await fetch('/api/super_admin/content/video-processing', { credentials: 'include' });
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
    const s = video.processingStatus || ('pending');
    if (s === 'processed') return 'bg-violet-100 text-violet-700';
    if (s === 'processing') return 'bg-blue-100 text-blue-700';
    if (s === 'failed') return 'bg-red-100 text-red-700';
    if (s === 'converted') return 'bg-emerald-100 text-emerald-700';
    return 'bg-amber-100 text-amber-700';
  }

  // Human-readable status label for the badge
  function statusLabel(video) {
    const s = video.processingStatus || ('pending');
    switch (s) {
      case 'processed': return 'Processed';
      case 'processing': return 'Processing';
      case 'failed': return 'Process failed';
      case 'converted': return 'Converted';
      default: return 'Pending';
    }
  }

  // Detect the "named" video type:
  // <instructorId>_<First>_<Last>_<extMeetingId>_<sessionId>_<Title>_<YYYY_MM_DD>_<hash>.mp4
  function isNamedVideo(fileName) {
    return /^\d{1,10}_[A-Za-z]+_[A-Za-z]+_[A-Za-z0-9]+_\d+_.+\d{4}_\d{2}_\d{2}_[A-Za-z0-9]+\.mp4$/i.test(fileName);
  }

  // Convert button: enabled only when no MP3 yet (server-provided canConvert).
  function convertButtonHtml(video, canConvert) {
    if (!canConvert) {
      return '<button type="button" class="px-2 py-1 text-[10px] rounded bg-slate-200 text-slate-400 cursor-not-allowed" disabled>Convert</button>';
    }
    return '<button type="button" class="convert-btn px-2 py-1 text-[10px] rounded bg-cyan-600 hover:bg-cyan-500 text-white font-semibold" data-file="' + video.fileName + '">Convert</button>';
  }

  // AI Transcript button: enabled only when an MP3 exists (Deepgram reads the
  // converted audio). Once a transcript exists, also show a "View" link.
  function aiTranscriptButtonHtml(video) {
    if (!video || !video.mp3Exists) {
      return '<button type="button" class="px-2 py-1 text-[10px] rounded bg-slate-200 text-slate-400 cursor-not-allowed" disabled title="Convert the video to MP3 first">AI Transcript</button>';
    }
    const btn = '<button type="button" class="ai-transcript-btn px-2 py-1 text-[10px] rounded bg-purple-600 hover:bg-purple-500 text-white font-semibold" data-file="' + video.fileName + '">AI Transcript</button>';
    if (!video.transcriptExists) return btn;
    return btn + '<a href="' + video.transcriptTxtUrl + '" target="_blank" rel="noopener" class="ml-1 px-2 py-1 text-[10px] rounded bg-purple-100 hover:bg-purple-200 text-purple-700 font-semibold">View</a>';
  }

  // Process button state machine:
  //   converted -> enabled "Generate Report"
  //   failed    -> enabled "Re-generate Report"
  //   processing -> disabled "Processing"
  //   processed  -> disabled "Generate Report"
  //   pending    -> disabled "Generate Report"
  function processButtonHtml(video, canProcess) {
    const s = video.processingStatus || ('pending');
    if (s === 'processing') {
      return '<button type="button" class="px-2 py-1 text-[10px] rounded bg-blue-200 text-blue-500 cursor-wait" disabled>Processing</button>';
    }
    if (!canProcess) {
      return '<button type="button" class="px-2 py-1 text-[10px] rounded bg-slate-200 text-slate-400 cursor-not-allowed" disabled>Generate Report</button>';
    }
    const label = s === 'failed' ? 'Re-generate Report' : 'Generate Report';
    return '<button type="button" class="process-btn px-2 py-1 text-[10px] rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold" data-file="' + video.fileName + '">' + label + '</button>';
  }

  // Report button: shown only when a report file exists for this video.
  function reportButtonHtml(video) {
    if (!video || !video.reportJsonExists) {
      return '<button type="button" class="px-2 py-1 text-[10px] rounded bg-slate-200 text-slate-400 cursor-not-allowed" disabled>Report</button>';
    }
    return '<button type="button" class="report-btn px-2 py-1 text-[10px] rounded bg-violet-600 hover:bg-violet-500 text-white font-semibold" data-file="' + video.fileName + '">Report</button>';
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
    if (statConverted) statConverted.textContent = videos.filter(v => v.processingStatus === 'converted').length;
    if (statPending) statPending.textContent = videos.filter(v => v.processingStatus === 'pending').length;
    if (statProcessed) statProcessed.textContent = videos.filter(v => v.processingStatus === 'processed').length;

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
      const statusLabel_ = statusLabel(video);
      tr.innerHTML = '<td class="py-1.5 px-2 text-cyan-950 font-medium">' + video.fileName + '</td>'
        + '<td class="py-1.5 px-2 text-cyan-800">' + video.size + ' MB</td>'
        + '<td class="py-1.5 px-2 text-cyan-800">' + video.duration + '</td>'
        + '<td class="py-1.5 px-2"><span class="px-2 py-0.5 rounded text-[10px] font-semibold ' + statusLabelColor(video) + '">' + statusLabel_ + '</span></td>'
        + '<td class="py-1.5 px-2 space-x-1.5">'
        + convertButtonHtml(video, canConvert)
        + aiTranscriptButtonHtml(video)
        + processButtonHtml(video, canProcess)
        + reportButtonHtml(video)
        + '</td>';
      videosTableBody.appendChild(tr);
    });

    // Bind button events
    document.querySelectorAll('.convert-btn').forEach(btn => {
      btn.addEventListener('click', () => openConvertModal(btn.getAttribute('data-file')));
    });
    document.querySelectorAll('.ai-transcript-btn').forEach(btn => {
      btn.addEventListener('click', () => openProcessModal(btn.getAttribute('data-file'), 'transcript'));
    });
    document.querySelectorAll('.process-btn').forEach(btn => {
      btn.addEventListener('click', () => openProcessModal(btn.getAttribute('data-file'), 'report'));
    });
    document.querySelectorAll('.report-btn').forEach(btn => {
      btn.addEventListener('click', () => openReportModal(btn.getAttribute('data-file')));
    });
  }

  // Open report modal for a video (fetches JSON, renders PDF-style report)
  function openReportModal(fileName) {
    const video = videosCache[fileName];
    const modal = document.getElementById('reportModal');
    const container = document.getElementById('reportContent');
    if (!modal || !container) return;
    container.innerHTML = '<p class="text-xs text-slate-500">Loading report...</p>';
    modal.classList.remove('hidden');
    setTimeout(() => modal.classList.add('opacity-100'), 10);

    if (!video || !video.reportJsonExists) {
      container.innerHTML = '<p class="text-xs text-slate-500">No report available for this video.</p>';
      return;
    }
    fetch(video.reportJsonUrl, { credentials: 'include' })
      .then(res => { if (!res.ok) throw new Error('HTTP ' + res.status); return res.json(); })
      .then(report => { container.innerHTML = renderReport(report); })
      .catch(err => { container.innerHTML = '<p class="text-xs text-red-500">Failed to load report: ' + err.message + '</p>'; });
  }

  // Build HTML for the report (categories, ratings, marks, red flags, comments)
  function renderReport(report) {
    const meta = report.meta || {};
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
    let html = '<div class="space-y-3 text-xs">';

    // Header
    html += '<div class="border-b border-slate-200 pb-2"><p class="font-bold text-sm text-slate-800">Tutor Observation Report</p>'
      + '<p class="text-slate-600">' + esc(meta.tutor_name || '')
      + (meta.student_name ? ' — ' + esc(meta.student_name) : '') + '</p>'
      + (meta.session_date ? '<p class="text-slate-500">' + esc(meta.session_date) + (meta.session_time ? ' ' + esc(meta.session_time) : '') + '</p>' : '')
      + '<p class="text-slate-700 font-semibold mt-1">Total: <span class="text-violet-700">' + esc(report.total_score) + ' / ' + esc(report.total_marks) + '</span>'
      + (report.rating_overall ? ' · <span class="text-slate-600">' + esc(report.rating_overall) + '</span>' : '') + '</p></div>';

    // Categories + indicators
    (report.categories || []).forEach(cat => {
      html += '<div class="rounded border border-slate-200 overflow-hidden"><div class="bg-slate-100 px-2 py-1.5 font-bold text-slate-700">'
        + esc(cat.code) + '. ' + esc(cat.name) + ' <span class="font-medium">(' + esc(cat.scored_marks) + '/' + esc(cat.marks) + ')</span></div><div class="p-2 space-y-1.5">';
      (cat.indicators || []).forEach(ind => {
        const ratingClass = ind.rating === 'Meets Expectations' ? 'text-emerald-700' : (ind.rating === 'Partially Meets' ? 'text-amber-700' : (ind.rating === 'Needs Improvement' ? 'text-red-700' : 'text-slate-500'));
        html += '<div><p class="font-semibold text-slate-700">' + esc(ind.id) + ' ' + esc(ind.name)
          + ' <span class="' + ratingClass + '">(' + esc(ind.rating || 'N/A') + ')</span></p>';
        if (ind.rating_descriptor) html += '<p class="text-slate-500 italic">' + esc(ind.rating_descriptor) + '</p>';
        if (ind.additional_notes) html += '<p class="text-slate-600">— ' + esc(ind.additional_notes) + '</p>';
        html += '</div>';
      });
      html += '</div></div>';
    });

    // Red flags
    const flags = (report.red_flags || []).filter(f => f.flagged);
    html += '<div class="rounded border border-red-200"><div class="bg-red-50 px-2 py-1.5 font-bold text-red-700">Red Flags</div><div class="p-2">';
    if (!flags.length) html += '<p class="text-slate-500">None</p>';
    else flags.forEach(f => html += '<p class="text-red-700">• ' + esc(f.name) + (f.note ? ': ' + esc(f.note) : '') + '</p>');
    html += '</div></div>';

    // Comments + recommendations
    if ((report.observer_comments || []).length) {
      html += '<div><p class="font-bold text-slate-700 mb-0.5">Observer Comments</p><p class="text-slate-600">' + esc(report.observer_comments.join(' ')) + '</p></div>';
    }
    if ((report.recommendations || []).length) {
      html += '<div><p class="font-bold text-slate-700 mb-0.5">Recommendations</p><ul class="list-disc pl-4 text-slate-600">';
      report.recommendations.forEach(r => html += '<li>' + esc(r) + '</li>');
      html += '</ul></div>';
    }
    html += '</div>';
    return html;
  }

  // Toggle the Convert modal busy (processing) state while a request is in flight.
  function setConvertBusy(busy) {
    if (!convertBtn || !convertProcessing) return;
    isConverting = !!busy;
    convertBtn.disabled = !!busy;
    convertBtn.classList.toggle('opacity-50', !!busy);
    convertBtn.classList.toggle('cursor-wait', !!busy);
    convertBtn.innerHTML = busy ? BUSY_SVG + ' Converting...' : DEFAULT_CONVERT_BTN_HTML;
    convertProcessing.classList.toggle('hidden', !busy);
    convertProcessing.classList.toggle('flex', !!busy);
    if (busy) convertMp3Status.textContent = '';
  }

  // Open convert modal
  function openConvertModal(fileName) {
    const video = videosCache[fileName];
    // Convert works on the .mp4 video file link.
    convertVideoFile.value = (video && video.videoPath) || fileName;
    convertMp3Status.textContent = (video && video.mp3Exists) ? 'MP3 already exists — convert disabled' : 'MP3 not found — convert available';
    convertMp3Status.className = 'text-xs ' + ((video && video.mp3Exists) ? 'text-amber-600' : 'text-cyan-700');
    // Reset any leftover busy state, then apply the can-convert enable/disable.
    setConvertBusy(false);
    convertBtn.innerHTML = DEFAULT_CONVERT_BTN_HTML;
    convertBtn.disabled = !!(video && video.mp3Exists);
    convertBtn.classList.toggle('opacity-50', !!(video && video.mp3Exists));
    convertBtn.onclick = () => convertAudio(fileName);
    convertModal.classList.remove('hidden');
    setTimeout(() => convertModal.classList.add('opacity-100'), 10);
  }

  // Build the correct resting (non-busy) innerHTML for the process button based
  // on which mode the modal is running (report vs transcript).
  function processBtnRestoreHtml() {
    if (activeProcessMode === 'transcript') {
      return DEFAULT_PROCESS_BTN_HTML.replace(/Generate Report/, 'Generate Transcript');
    }
    return DEFAULT_PROCESS_BTN_HTML;
  }

  // Toggle the Process modal busy (processing) state while a request is in flight
  // (used for both Generate Report and AI Transcript).
  function setProcessBusy(busy) {
    if (!processBtn || !processProcessing) return;
    isProcessing = !!busy;
    processBtn.disabled = !!busy;
    processBtn.classList.toggle('opacity-50', !!busy);
    processBtn.classList.toggle('cursor-wait', !!busy);
    processBtn.innerHTML = busy ? BUSY_SVG + ' Processing...' : processBtnRestoreHtml();
    processProcessing.classList.toggle('hidden', !busy);
    processProcessing.classList.toggle('flex', !!busy);
    if (busy) processMp3Status.textContent = '';
  }

  // Open the process modal.
  //   mode = 'report'     -> Generate Report (full Whisper + audit pipeline)
  //   mode = 'transcript' -> AI Transcript (Deepgram, fast, speaker-labelled)
  function openProcessModal(fileName, mode) {
    const video = videosCache[fileName];
    activeProcessMode = mode === 'transcript' ? 'transcript' : 'report';
    const modalTitle = document.getElementById('processModalTitle');
    if (modalTitle) modalTitle.textContent = activeProcessMode === 'transcript' ? 'AI Transcript' : 'Generate Report';
    // Process works on the .mp3 audio file link.
    processVideoFile.value = (video && video.audioPath) || fileName;
    processMp3Status.textContent = (video && video.mp3Exists) ? 'MP3 exists — action available' : 'MP3 required before processing';
    processMp3Status.className = 'text-xs ' + ((video && video.mp3Exists) ? 'text-emerald-700' : 'text-amber-600');
    // Reset any leftover busy state, then apply the can-process enable/disable.
    setProcessBusy(false);
    processBtn.disabled = !(video && video.mp3Exists);
    processBtn.classList.toggle('opacity-50', !(video && video.mp3Exists));
    processBtn.onclick = () => processAudio(fileName, activeProcessMode);
    processModal.classList.remove('hidden');
    setTimeout(() => processModal.classList.add('opacity-100'), 10);
  }

  // Open upload modal
  function openUploadModal() {
    resetUploadModal();
    uploadBtn.onclick = () => uploadVideo();
    uploadModal.classList.remove('hidden');
    setTimeout(() => uploadModal.classList.add('opacity-100'), 10);
  }

  // Reset upload modal state
  function resetUploadModal() {
    if (!uploadFileInput) return;
    uploadFileInput.value = '';
    uploadHint.textContent = 'Select an MP4 video — it will be saved to storage/screen-recordings.';
    uploadHint.className = 'text-xs text-slate-500';
    uploadBtn.disabled = true;
    uploadBtn.classList.add('opacity-50');
    uploadBtn.textContent = 'Upload Video';
  }

  // Validate the file chosen in the upload modal
  function onUploadFileSelected() {
    const file = uploadFileInput.files && uploadFileInput.files[0];
    if (!file) { resetUploadModal(); return; }
    uploadBtn.disabled = true;
    uploadBtn.classList.add('opacity-50');
    uploadBtn.textContent = 'Upload Video';
    if (!/\.mp4$/i.test(file.name)) {
      uploadHint.textContent = 'Only .mp4 files are supported. Please choose an MP4 video.';
      uploadHint.className = 'text-xs text-red-600';
      return;
    }
    if (videosCache[file.name]) {
      uploadHint.textContent = 'A video named "' + file.name + '" already exists in storage/screen-recordings. Rename the file or choose another.';
      uploadHint.className = 'text-xs text-amber-600';
      return;
    }
    uploadHint.textContent = 'Ready to upload: ' + file.name + ' (' + (file.size / (1024 * 1024)).toFixed(2) + ' MB)';
    uploadHint.className = 'text-xs text-emerald-600';
    uploadBtn.disabled = false;
    uploadBtn.classList.remove('opacity-50');
  }

  // Upload the selected video to storage/screen-recordings then refresh the table
  async function uploadVideo() {
    if (!uploadBtn || uploadBtn.disabled) return;
    const file = uploadFileInput.files && uploadFileInput.files[0];
    if (!file || !/\.mp4$/i.test(file.name)) return;
    uploadBtn.disabled = true;
    uploadBtn.classList.add('opacity-50');
    uploadBtn.textContent = 'Uploading...';
    uploadHint.textContent = 'Uploading ' + file.name + ' — please wait...';
    uploadHint.className = 'text-xs text-blue-600';
    try {
      const response = await fetch('/api/super_admin/content/video-processing/upload', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'X-File-Name': encodeURIComponent(file.name),
          'Content-Type': file.type || 'application/octet-stream'
        },
        body: file
      });
      let result = {};
      try { result = await response.json(); } catch (e) { /* non-JSON body */ }
      if (result.success) {
        showToast('Video uploaded: ' + file.name, 'success');
        closeModals();
        loadVideos();
      } else {
        uploadHint.textContent = result.error || 'Upload failed.';
        uploadHint.className = 'text-xs text-red-600';
        showToast('Upload failed: ' + (result.error || 'unknown error'), 'error');
      }
    } catch (err) {
      console.error('Upload error:', err);
      uploadHint.textContent = 'Upload failed: ' + err.message;
      uploadHint.className = 'text-xs text-red-600';
      showToast('Upload failed', 'error');
    } finally {
      uploadBtn.textContent = 'Upload Video';
      onUploadFileSelected();
    }
  }

  // Convert to audio
  async function convertAudio(fileName) {
    if (convertBtn.disabled || isConverting) return;   // guard against duplicate clicks
    setConvertBusy(true);                              // show the processing state
    try {
      // The backend model performs all DB work (users, calendar_connections,
      // meetings, meeting_sessions, meeting_assets) as part of the conversion.
      // Send the .mp4 video file link.
      const video = videosCache[fileName];
      const videoPath = (video && video.videoPath) || fileName;

      const response = await fetch('/api/super_admin/content/video-processing/convert', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoPath })
      });
      const result = await response.json();
      if (result.success) {
        setConvertBusy(false);                 // release the modal lock before closing
        showToast(result.data && result.data.alreadyExists ? 'MP3 already exists' : 'Conversion completed — MP3 saved', 'success');
        closeModals();
      } else {
        convertMp3Status.textContent = result.error || 'Conversion failed';
        convertMp3Status.className = 'text-xs text-red-600';
        showToast('Conversion failed: ' + (result.error || 'unknown error'), 'error');
      }
    } catch (err) {
      console.error('Convert error:', err);
      convertMp3Status.textContent = 'Conversion failed: ' + err.message;
      convertMp3Status.className = 'text-xs text-red-600';
      showToast('Conversion failed', 'error');
    } finally {
      setConvertBusy(false);                   // always restore the button
      loadVideos();                            // always re-call the data after the response
    }
  }

  // Process audio
  //   mode = 'report'     -> POST video-processing/process (full Whisper + audit pipeline)
  //   mode = 'transcript' -> POST video-processing/transcript (Deepgram AI transcript)
  async function processAudio(fileName, mode) {
    const isTranscript = mode === 'transcript';
    if (processBtn.disabled || isProcessing) return;   // guard against duplicate clicks
    setProcessBusy(true);                              // show the processing state
    try {
      // Send the .mp3 audio file link + meeting_id + session_id so the backend
      // can pass them straight into the pipeline (runFullAudioPipeline or Deepgram).
      const video = videosCache[fileName];
      // Prefer the video record's audioPath (the .mp3 link); otherwise derive the
      // mp3 path from the .mp4 file name so we never send the video file itself.
      const audioPath = (video && video.audioPath)
        || '/storage/recordings/' + fileName.replace(/^SCREEN_/i, 'REC_').replace(/\.mp4$/i, '.mp3');
      const meetingId = (video && video.meetingId) || null;
      const sessionId = (video && video.sessionId) || null;

      const url = isTranscript
        ? '/api/super_admin/content/video-processing/transcript'
        : '/api/super_admin/content/video-processing/process';

      const response = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioPath, meetingId, sessionId })
      });
      const result = await response.json();
      if (result.success) {
        setProcessBusy(false);                 // release the modal lock before closing
        showToast(isTranscript ? 'AI transcript generated' : 'Report generated', 'success');
        closeModals();
      } else {
        processMp3Status.textContent = result.error || 'Processing failed';
        processMp3Status.className = 'text-xs text-red-600';
        showToast((isTranscript ? 'Transcript' : 'Report') + ' failed: ' + (result.error || 'unknown error'), 'error');
      }
    } catch (err) {
      console.error('Process error:', err);
      processMp3Status.textContent = 'Processing failed: ' + err.message;
      processMp3Status.className = 'text-xs text-red-600';
      showToast('Processing failed', 'error');
    } finally {
      setProcessBusy(false);                   // always restore the button
      loadVideos();                            // always re-call the data after the response
    }
  }

  // Close modals (locked while a Convert/Process request is running)
  function closeModals() {
    if (isConverting || isProcessing) return;   // keep the modal open while a job is running
    convertModal.classList.add('hidden');
    convertModal.classList.remove('opacity-100');
    processModal.classList.add('hidden');
    processModal.classList.remove('opacity-100');
    if (uploadModal) {
      uploadModal.classList.add('hidden');
      uploadModal.classList.remove('opacity-100');
    }
  }

  // Click outside to close
  convertModal.addEventListener('click', (e) => { if (e.target === convertModal) closeModals(); });
  processModal.addEventListener('click', (e) => { if (e.target === processModal) closeModals(); });
  if (uploadModal) uploadModal.addEventListener('click', (e) => { if (e.target === uploadModal) closeModals(); });

  // Close buttons (data-close)
  document.querySelectorAll('[data-close]').forEach(el => el.addEventListener('click', closeModals));

  // Report modal close (its own close button + backdrop)
  const reportModal = document.getElementById('reportModal');
  if (reportModal) {
    document.querySelectorAll('[data-close-report]').forEach(el => el.addEventListener('click', () => {
      reportModal.classList.add('hidden');
      reportModal.classList.remove('opacity-100');
    }));
    reportModal.addEventListener('click', (e) => {
      if (e.target === reportModal) {
        reportModal.classList.add('hidden');
        reportModal.classList.remove('opacity-100');
      }
    });
  }

  // Refresh button
  const refreshBtn = document.getElementById('refreshBtn');
  if (refreshBtn) refreshBtn.addEventListener('click', loadVideos);

  // Upload video button + file input listener
  const uploadVideoBtn = document.getElementById('uploadVideoBtn');
  if (uploadVideoBtn) uploadVideoBtn.addEventListener('click', openUploadModal);
  if (uploadFileInput) uploadFileInput.addEventListener('change', onUploadFileSelected);

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