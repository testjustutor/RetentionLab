/**
 * public/js/admin/recordings.js
 * Frontend logic for video recordings page with filters
 */

(function() {
  'use strict';

  // State
  let allRecordings = [];
  let allInstructors = [];
  let currentFilters = {
    startDate: null,
    endDate: null,
    instructorId: null
  };

  // DOM Elements
  const filterStartDate = document.getElementById('filter-start-date');
  const filterEndDate = document.getElementById('filter-end-date');
  const filterInstructor = document.getElementById('filter-instructor');
  const applyFiltersBtn = document.getElementById('apply-filters');
  const clearFiltersBtn = document.getElementById('clear-filters');
  const recordingsTableBody = document.getElementById('recordings-table-body');
  const recordingsCount = document.getElementById('recordings-count');
  const videoModal = document.getElementById('video-modal');
  const videoPlayer = document.getElementById('video-player');
  const videoSource = document.getElementById('video-source');
  const closeModalBtn = document.getElementById('close-modal');
  const modalTitle = document.getElementById('modal-title');
  const modalInstructor = document.getElementById('modal-instructor');
  const modalPlatform = document.getElementById('modal-platform');
  const modalDate = document.getElementById('modal-date');
  const modalDuration = document.getElementById('modal-duration');

  // Initialize page
  async function init() {
    await loadComponents();
    await loadInstructors();
    await loadRecordings();
    setupEventListeners();
  }

  // Load sidebar and header components
  async function loadComponents() {
    const sidebarPlaceholder = document.getElementById('sidebar-placeholder');
    const headerPlaceholder = document.getElementById('header-placeholder');
    const headerButtonsContainer = document.getElementById('header-buttons-container');

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
      const response = await fetch('/api/recordings/videos/instructors', {
        credentials: 'include'
      });
      const data = await response.json();

      if (data.success && data.instructors) {
        allInstructors = data.instructors;
        populateInstructorDropdown(allInstructors);
      }
    } catch (err) {
      console.error('Failed to load instructors:', err);
    }
  }

  // Populate instructor dropdown
  function populateInstructorDropdown(instructors) {
    filterInstructor.innerHTML = '<option value="">All Instructors</option>';
    instructors.forEach(instructor => {
      const option = document.createElement('option');
      option.value = instructor.id;
      option.textContent = instructor.name;
      filterInstructor.appendChild(option);
    });
  }

  // Load recordings with current filters
  async function loadRecordings() {
    try {
      const params = new URLSearchParams();
      if (currentFilters.startDate) params.append('startDate', currentFilters.startDate);
      if (currentFilters.endDate) params.append('endDate', currentFilters.endDate);
      if (currentFilters.instructorId) params.append('instructorId', currentFilters.instructorId);

      const response = await fetch(`/api/recordings/videos?${params.toString()}`, {
        credentials: 'include'
      });
      const data = await response.json();

      if (data.success) {
        allRecordings = data.recordings || [];
        renderRecordings(allRecordings);
        updateRecordingsCount(allRecordings.length);
      } else {
        showError(data.error || 'Failed to load recordings');
      }
    } catch (err) {
      console.error('Failed to load recordings:', err);
      showError('Failed to load recordings');
    }
  }

  // Render recordings table
  function renderRecordings(recordings) {
    if (recordings.length === 0) {
      recordingsTableBody.innerHTML = `
        <tr>
          <td colspan="7" class="text-center py-8 text-slate-500">
            No recordings found. Try adjusting your filters.
          </td>
        </tr>
      `;
      return;
    }

    recordingsTableBody.innerHTML = recordings.map(rec => {
      const date = formatDate(rec.scheduled_start_time);
      const duration = calculateDuration(rec.session_start_time, rec.session_end_time);
      const oqiScore = rec.oqi_score ? rec.oqi_score.toFixed(1) : 'N/A';
      const hasVideo = rec.has_video;

      return `
        <tr>
          <td>
            <div class="font-medium text-slate-900">${escapeHtml(rec.title)}</div>
            <div class="text-xs text-slate-500">${escapeHtml(rec.description || '')}</div>
          </td>
          <td>
            <div class="text-sm text-slate-700">${escapeHtml(rec.instructor_name)}</div>
            <div class="text-xs text-slate-500">${escapeHtml(rec.instructor_email)}</div>
          </td>
          <td>
            <span class="badge badge-${getPlatformColor(rec.platform)}">${escapeHtml(rec.platform || 'unknown')}</span>
          </td>
          <td class="text-sm text-slate-600">${date}</td>
          <td class="text-sm text-slate-600">${duration}</td>
          <td>
            ${rec.oqi_score ? `<span class="badge badge-${getOqiColor(rec.oqi_score)}">${oqiScore}</span>` : '<span class="text-slate-400">N/A</span>'}
          </td>
          <td>
            ${hasVideo ? `
              <button class="btn btn-sm btn-primary" onclick="window.playVideo(${rec.meeting_id})">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path>
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                Play
              </button>
            ` : '<span class="text-xs text-slate-400">No video</span>'}
          </td>
        </tr>
      `;
    }).join('');
  }

  // Update recordings count
  function updateRecordingsCount(count) {
    recordingsCount.textContent = `${count} recording${count !== 1 ? 's' : ''}`;
  }

  // Show error message
  function showError(message) {
    recordingsTableBody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center py-8 text-red-600">
          ${escapeHtml(message)}
        </td>
      </tr>
    `;
  }

  // Setup event listeners
  function setupEventListeners() {
    // Apply filters
    applyFiltersBtn.addEventListener('click', () => {
      currentFilters = {
        startDate: filterStartDate.value || null,
        endDate: filterEndDate.value || null,
        instructorId: filterInstructor.value ? parseInt(filterInstructor.value) : null
      };
      loadRecordings();
    });

    // Clear filters
    clearFiltersBtn.addEventListener('click', () => {
      filterStartDate.value = '';
      filterEndDate.value = '';
      filterInstructor.value = '';
      currentFilters = {
        startDate: null,
        endDate: null,
        instructorId: null
      };
      loadRecordings();
    });

    // Close modal
    closeModalBtn.addEventListener('click', closeVideoModal);
    videoModal.addEventListener('click', (e) => {
      if (e.target === videoModal) closeVideoModal();
    });

    // Escape key to close modal
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !videoModal.classList.contains('hidden')) {
        closeVideoModal();
      }
    });
  }

  // Play video
  window.playVideo = async function(meetingId) {
    try {
      const response = await fetch(`/api/recordings/videos/${meetingId}`, {
        credentials: 'include'
      });
      const data = await response.json();

      if (data.success && data.recording) {
        const recording = data.recording;
        modalTitle.textContent = recording.title;
        modalInstructor.textContent = recording.instructor_name;
        modalPlatform.textContent = recording.platform || 'unknown';
        modalDate.textContent = formatDate(recording.scheduled_start_time);
        modalDuration.textContent = calculateDuration(recording.session_start_time, recording.session_end_time);

        if (recording.video_url) {
          videoSource.src = recording.video_url;
          videoPlayer.load();
          videoModal.classList.remove('hidden');
          videoModal.classList.add('flex');
          videoPlayer.play();
        } else {
          alert('No video available for this recording');
        }
      } else {
        alert(data.error || 'Failed to load recording');
      }
    } catch (err) {
      console.error('Failed to play video:', err);
      alert('Failed to load video');
    }
  };

  // Close video modal
  function closeVideoModal() {
    videoModal.classList.add('hidden');
    videoModal.classList.remove('flex');
    videoPlayer.pause();
    videoSource.src = '';
  }

  // Utility: Format date
  function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  // Utility: Calculate duration
  function calculateDuration(startTime, endTime) {
    if (!startTime || !endTime) return 'N/A';
    const start = new Date(startTime);
    const end = new Date(endTime);
    const diffMs = end - start;
    const diffMins = Math.floor(diffMs / 60000);
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  }

  // Utility: Get platform color
  function getPlatformColor(platform) {
    const colors = {
      'zoom': 'primary',
      'google_meet': 'success',
      'teams': 'info'
    };
    return colors[platform] || 'secondary';
  }

  // Utility: Get OQI score color
  function getOqiColor(score) {
    if (score >= 90) return 'success';
    if (score >= 80) return 'primary';
    if (score >= 70) return 'warning';
    return 'danger';
  }

  // Utility: Escape HTML
  function escapeHtml(text) {
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
})();