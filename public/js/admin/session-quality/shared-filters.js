/**
 * shared-filters.js
 * Cascading filter bar for session quality report pages.
 *
 * Filter dependency flow:
 *  1. Instructor (independent) + Board (independent) - both load on page load
 *  2. When Instructor selected → Board reloads with instructor_id, Meeting loads with instructor_id
 *  3. When Board selected → Class loads with instructor_id + board
 *  4. When Class selected → Subject loads with instructor_id + board + class
 *  5. When Subject selected → Meeting reloads with all filters
 *  6. When Meeting selected → Session loads with meeting_internal_id
 *  7. Get Data button enables when a meeting is selected (with or without other filters)
 */

const SessionQualityFilters = (() => {
  let onGetDataCallback = null;
  let currentFilters = {
    instructor_id: '',
    board: '',
    grade: '',
    subject: '',
    meetingId: '',
    sessionId: ''
  };

  function renderFilterBar(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = `
      <div class="bg-white border border-slate-200 rounded-lg p-3 mb-3">
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
          <!-- Instructor -->
          <div>
            <label class="block text-[10px] text-slate-500 uppercase tracking-wide mb-1">Instructor</label>
            <select id="filterInstructor" class="w-full text-[12px] border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500">
              <option value="">All</option>
            </select>
          </div>

          <!-- Board/Curriculum -->
          <div>
            <label class="block text-[10px] text-slate-500 uppercase tracking-wide mb-1">Board</label>
            <select id="filterBoard" class="w-full text-[12px] border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500">
              <option value="">All</option>
            </select>
          </div>

          <!-- Class/Grade -->
          <div>
            <label class="block text-[10px] text-slate-500 uppercase tracking-wide mb-1">Class</label>
            <select id="filterGrade" class="w-full text-[12px] border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500" disabled>
              <option value="">All</option>
            </select>
          </div>

          <!-- Subject -->
          <div>
            <label class="block text-[10px] text-slate-500 uppercase tracking-wide mb-1">Subject</label>
            <select id="filterSubject" class="w-full text-[12px] border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500" disabled>
              <option value="">All</option>
            </select>
          </div>

          <!-- Meeting -->
          <div>
            <label class="block text-[10px] text-slate-500 uppercase tracking-wide mb-1">Meeting</label>
            <select id="filterMeeting" class="w-full text-[12px] border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500" disabled>
              <option value="">Select</option>
            </select>
          </div>

          <!-- Session -->
          <div>
            <label class="block text-[10px] text-slate-500 uppercase tracking-wide mb-1">Session</label>
            <select id="filterSession" class="w-full text-[12px] border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500" disabled>
              <option value="">Select</option>
            </select>
          </div>

          <!-- Get Data Button -->
          <div class="flex items-end">
            <button id="btnGetData" class="w-full px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[12px] font-medium rounded-lg transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed" disabled>
              Get Data
            </button>
          </div>
        </div>
      </div>
    `;
  }

  function populateSelect(elementId, options, keepFirst = true) {
    const select = document.getElementById(elementId);
    if (!select) return;
    const currentVal = select.value;
    const firstOpt = keepFirst ? select.options[0] : null;
    select.innerHTML = '';
    if (firstOpt) select.appendChild(firstOpt);
    options.forEach(opt => {
      const o = document.createElement('option');
      o.value = opt.value;
      o.textContent = opt.label;
      select.appendChild(o);
    });
    if (currentVal && [...select.options].some(o => o.value === currentVal)) {
      select.value = currentVal;
    }
  }

  // ── API LOADERS ──────────────────────────────────────────────────────────

  async function loadInstructors() {
    try {
      const res = await apiFetch('/api/tutoring/filters/instructors', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = res.data || res;
      const options = data.options || [];
      populateSelect('filterInstructor', options);
      if (options.length === 0) {
        const container = document.getElementById(containerId);
        if (container) {
          const msg = document.createElement('div');
          msg.className = 'bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3';
          msg.innerHTML = '<p class="text-[12px] text-amber-800">No instructors found. Please create instructors first.</p>';
          container.insertBefore(msg, container.firstChild);
        }
      }
    } catch (e) {
      console.warn('[SharedFilters] Failed to load instructors:', e);
    }
  }

  async function loadBoards(instructorId) {
    try {
      const body = instructorId ? { instructor_id: instructorId } : {};
      const res = await apiFetch('/api/tutoring/filters/boards', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = res.data || res;
      populateSelect('filterBoard', data.options || []);
      document.getElementById('filterBoard').disabled = false;
    } catch (e) {
      console.warn('[SharedFilters] Failed to load boards:', e);
    }
  }

  async function loadClasses(instructorId, board) {
    try {
      const body = {};
      if (instructorId) body.instructor_id = instructorId;
      if (board) body.board = board;
      const res = await apiFetch('/api/tutoring/filters/classes', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = res.data || res;
      populateSelect('filterGrade', data.options || []);
      document.getElementById('filterGrade').disabled = false;
    } catch (e) {
      console.warn('[SharedFilters] Failed to load classes:', e);
    }
  }

  async function loadSubjects(instructorId, board, grade) {
    try {
      const body = {};
      if (instructorId) body.instructor_id = instructorId;
      if (board) body.board = board;
      if (grade) body.grade = grade;
      const res = await apiFetch('/api/tutoring/filters/subjects', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = res.data || res;
      populateSelect('filterSubject', data.options || []);
      document.getElementById('filterSubject').disabled = false;
    } catch (e) {
      console.warn('[SharedFilters] Failed to load subjects:', e);
    }
  }

  async function loadMeetings(instructorId, board, grade, subject) {
    try {
      const body = {};
      if (instructorId) body.instructor_id = instructorId;
      if (board) body.board = board;
      if (grade) body.grade = grade;
      if (subject) body.subject = subject;
      const res = await apiFetch('/api/tutoring/filters/meetings', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = res.data || res;
      populateSelect('filterMeeting', data.options || []);
      document.getElementById('filterMeeting').disabled = false;
    } catch (e) {
      console.warn('[SharedFilters] Failed to load meetings:', e);
    }
  }

  async function loadSessions(meetingInternalId) {
    try {
      const body = meetingInternalId ? { meeting_internal_id: meetingInternalId } : {};
      const res = await apiFetch('/api/tutoring/filters/sessions', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = res.data || res;
      populateSelect('filterSession', data.options || []);
      document.getElementById('filterSession').disabled = false;
    } catch (e) {
      console.warn('[SharedFilters] Failed to load sessions:', e);
    }
  }

  // ── BUTTON STATE LOGIC ───────────────────────────────────────────────────
  // Disabled only when:
  //   - No filters selected at all
  //   - Board selected but no class and no subject
  //   - Board + class selected but no subject
  //   - Board + class + subject selected but no meeting
  // Enabled in all other cases (instructor alone, meeting alone, etc.)

  function updateGetDataButton() {
    const btn = document.getElementById('btnGetData');
    if (!btn) return;

    const { instructor_id, board, grade, subject, meetingId } = currentFilters;

    // If meeting is selected → always enabled
    if (meetingId) {
      btn.disabled = false;
      return;
    }

    // If board is selected but no class and no subject → disabled
    if (board && !grade && !subject) {
      btn.disabled = true;
      return;
    }

    // If board + class selected but no subject → disabled
    if (board && grade && !subject) {
      btn.disabled = true;
      return;
    }

    // If board + class + subject selected but no meeting → disabled
    if (board && grade && subject && !meetingId) {
      btn.disabled = true;
      return;
    }

    // All other cases → enabled (instructor alone, meeting alone, etc.)
    btn.disabled = false;
  }

  function onGetData(callback) {
    onGetDataCallback = callback;
  }

  // ── INIT ─────────────────────────────────────────────────────────────────

  async function init(containerId = 'filters-container') {
    renderFilterBar(containerId);
    
    // Load both Instructor and Board on page load (both independent)
    await Promise.all([
      loadInstructors(),
      loadBoards()
    ]);

    // Wire up cascading change events
    const instructorSelect = document.getElementById('filterInstructor');
    const boardSelect = document.getElementById('filterBoard');
    const gradeSelect = document.getElementById('filterGrade');
    const subjectSelect = document.getElementById('filterSubject');
    const meetingSelect = document.getElementById('filterMeeting');
    const sessionSelect = document.getElementById('filterSession');
    const getDataBtn = document.getElementById('btnGetData');

    // ── INSTRUCTOR CHANGE ──────────────────────────────────────────────────
    instructorSelect?.addEventListener('change', async () => {
      currentFilters.instructor_id = instructorSelect.value;
      currentFilters.board = '';
      currentFilters.grade = '';
      currentFilters.subject = '';
      currentFilters.meetingId = '';
      currentFilters.sessionId = '';

      // Reset downstream selects
      populateSelect('filterBoard', []);
      populateSelect('filterGrade', []);
      document.getElementById('filterGrade').disabled = true;
      populateSelect('filterSubject', []);
      document.getElementById('filterSubject').disabled = true;
      populateSelect('filterMeeting', []);
      document.getElementById('filterMeeting').disabled = true;
      populateSelect('filterSession', []);
      document.getElementById('filterSession').disabled = true;

      // Load boards filtered by instructor + meetings for this instructor
      await Promise.all([
        loadBoards(currentFilters.instructor_id),
        loadMeetings(currentFilters.instructor_id)
      ]);
      updateGetDataButton();
    });

    // ── BOARD CHANGE ───────────────────────────────────────────────────────
    boardSelect?.addEventListener('change', async () => {
      currentFilters.board = boardSelect.value;
      currentFilters.grade = '';
      currentFilters.subject = '';
      currentFilters.meetingId = '';
      currentFilters.sessionId = '';

      // Reset downstream selects
      populateSelect('filterGrade', []);
      document.getElementById('filterGrade').disabled = true;
      populateSelect('filterSubject', []);
      document.getElementById('filterSubject').disabled = true;
      populateSelect('filterMeeting', []);
      document.getElementById('filterMeeting').disabled = true;
      populateSelect('filterSession', []);
      document.getElementById('filterSession').disabled = true;

      // Load classes with instructor_id + board
      await loadClasses(currentFilters.instructor_id, currentFilters.board);
      updateGetDataButton();
    });

    // ── CLASS/GRADE CHANGE ─────────────────────────────────────────────────
    gradeSelect?.addEventListener('change', async () => {
      currentFilters.grade = gradeSelect.value;
      currentFilters.subject = '';
      currentFilters.meetingId = '';
      currentFilters.sessionId = '';

      // Reset downstream selects
      populateSelect('filterSubject', []);
      document.getElementById('filterSubject').disabled = true;
      populateSelect('filterMeeting', []);
      document.getElementById('filterMeeting').disabled = true;
      populateSelect('filterSession', []);
      document.getElementById('filterSession').disabled = true;

      // Load subjects with instructor_id + board + class
      await loadSubjects(currentFilters.instructor_id, currentFilters.board, currentFilters.grade);
      updateGetDataButton();
    });

    // ── SUBJECT CHANGE ─────────────────────────────────────────────────────
    subjectSelect?.addEventListener('change', async () => {
      currentFilters.subject = subjectSelect.value;
      currentFilters.meetingId = '';
      currentFilters.sessionId = '';

      // Reset downstream selects
      populateSelect('filterMeeting', []);
      document.getElementById('filterMeeting').disabled = true;
      populateSelect('filterSession', []);
      document.getElementById('filterSession').disabled = true;

      // Load meetings with all filters
      await loadMeetings(
        currentFilters.instructor_id,
        currentFilters.board,
        currentFilters.grade,
        currentFilters.subject
      );
      updateGetDataButton();
    });

    // ── MEETING CHANGE ─────────────────────────────────────────────────────
    meetingSelect?.addEventListener('change', async () => {
      currentFilters.meetingId = meetingSelect.value;
      currentFilters.sessionId = '';

      // Reset session select
      populateSelect('filterSession', []);
      document.getElementById('filterSession').disabled = true;

      // Load sessions for this meeting
      if (currentFilters.meetingId) {
        await loadSessions(currentFilters.meetingId);
      }
      updateGetDataButton();
    });

    // ── SESSION CHANGE ─────────────────────────────────────────────────────
    sessionSelect?.addEventListener('change', async () => {
      currentFilters.sessionId = sessionSelect.value;
      updateGetDataButton();
    });

    // ── GET DATA BUTTON ────────────────────────────────────────────────────
    getDataBtn?.addEventListener('click', () => {
      // Use sessionId if available, otherwise meetingId
      const id = currentFilters.sessionId || currentFilters.meetingId;
      if (id && onGetDataCallback) {
        onGetDataCallback(id, currentFilters);
      }
    });
  }

  return {
    init,
    onGetData,
    getCurrentFilters: () => currentFilters
  };
})();