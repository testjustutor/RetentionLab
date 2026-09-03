/**
 * Admin Settings - Meetings Page
 * Loads + saves meeting settings and shows meeting stats from the DB
 * via GET/PUT /api/admin/settings/meetings (route > controller > model > db).
 */
(async () => {
  await loadMeetings();
  bindSave();
})();

async function loadMeetings() {
  try {
    const data = await apiFetch('/api/admin/settings/meetings');
    const stats = data.stats || {};
    setText('statTotalMeetings', stats.totalMeetings);
    setText('statUpcoming', stats.upcomingMeetings);
    setText('statCompleted', stats.completedMeetings);
    setText('statSessions', stats.totalSessions);
    setText('statReviews', stats.totalReviews);
    setText('statInstructors', stats.instructorCount);
    setText('statReviewers', stats.reviewerCount);

    const s = data.settings || {};
    setBool('autoRecord', s.auto_record);
    setVal('retentionPeriod', s.retention_days);
    setVal('defaultDuration', s.default_duration);
    setVal('defaultPlatform', s.default_platform);
    setBool('autoTranscript', s.auto_transcript);
    setBool('notifyInstructor', s.notify_instructor);
    setBool('autoAssignReviewer', s.auto_assign_reviewer);
    setVal('reminderMinutes', s.reminder_minutes);
  } catch (e) {
    console.error('loadMeetings:', e);
    showToast('Failed to load meeting settings: ' + e.message, true);
  }
}

function bindSave() {
  const btn = document.getElementById('saveMeetingBtn');
  if (!btn) return;
  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    await saveMeetings();
  });
}

function collectSettings() {
  return {
    auto_record: boolOf('autoRecord'),
    retention_days: intOf('retentionPeriod', 180),
    default_duration: intOf('defaultDuration', 60),
    default_platform: valOf('defaultPlatform') || 'zoom',
    auto_transcript: boolOf('autoTranscript'),
    notify_instructor: boolOf('notifyInstructor'),
    auto_assign_reviewer: boolOf('autoAssignReviewer'),
    reminder_minutes: intOf('reminderMinutes', 30)
  };
}

async function saveMeetings() {
  const msg = document.getElementById('saveMsg');
  try {
    const result = await apiFetch('/api/admin/settings/meetings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: collectSettings() })
    });
    showToast('Meeting settings saved successfully');
    if (msg) msg.textContent = 'Saved';
  } catch (e) {
    console.error('saveMeetings:', e);
    showToast('Failed to save: ' + e.message, true);
    if (msg) msg.textContent = 'Save failed';
  }
}

function setText(id, v) { const el = document.getElementById(id); if (el) el.textContent = (v == null ? '-' : v); }
function setVal(id, v) { const el = document.getElementById(id); if (el) el.value = (v == null ? '' : v); }
function setBool(id, v) { const el = document.getElementById(id); if (el) el.checked = !!v; }
function valOf(id) { const el = document.getElementById(id); return el ? el.value : ''; }
function boolOf(id) { const el = document.getElementById(id); return el ? el.checked : false; }
function intOf(id, fallback) { const n = parseInt(valOf(id), 10); return Number.isNaN(n) ? fallback : n; }
