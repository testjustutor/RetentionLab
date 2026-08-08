/**
 * Admin Settings - Meetings Page
 * Handles meeting configuration like auto-recording and retention periods
 */

document.addEventListener('DOMContentLoaded', () => {
  const checkInterval = setInterval(() => {
    if (typeof apiFetch === 'function') {
      clearInterval(checkInterval);
      initializeMeetings();
    }
  }, 100);

  setTimeout(() => clearInterval(checkInterval), 5000);
});

async function initializeMeetings() {
  try {
    await loadMeetingSettings();
    setupEventListeners();
  } catch (error) {
    console.error('Failed to initialize meeting settings:', error);
  }
}

async function loadMeetingSettings() {
  try {
    const response = await apiFetch('/api/admin/settings/meetings');
    const data = response.data || response;
    
    if (data) {
      const autoRecord = document.getElementById('autoRecord');
      const retentionPeriod = document.getElementById('retentionPeriod');
      
      if (autoRecord && data.auto_record !== undefined) {
        autoRecord.checked = data.auto_record === true || data.auto_record === 1;
      }
      if (retentionPeriod && data.retention_days) {
        retentionPeriod.value = data.retention_days;
      }
    }
  } catch (error) {
    console.error('Failed to load meeting settings:', error);
  }
}

function setupEventListeners() {
  const saveBtn = document.getElementById('saveMeetingBtn') || document.querySelector('button');
  if (saveBtn) {
    saveBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      await saveMeetingSettings();
    });
  }
}

async function saveMeetingSettings() {
  const autoRecord = document.getElementById('autoRecord')?.checked;
  const retentionPeriod = document.getElementById('retentionPeriod')?.value;

  try {
    const result = await apiFetch('/api/admin/settings/meetings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        auto_record: autoRecord ? 1 : 0,
        retention_days: retentionPeriod ? parseInt(retentionPeriod) : 180
      })
    });

    if (result.success) {
      showToast('Meeting settings saved successfully');
    }
  } catch (error) {
    console.error('Failed to save meeting settings:', error);
    showToast(error.message || 'Failed to save settings', true);
  }
}