/**
 * Admin Settings - Notifications Page
 * Handles notification preferences like email alerts and push notifications
 */

document.addEventListener('DOMContentLoaded', () => {
  const checkInterval = setInterval(() => {
    if (typeof apiFetch === 'function') {
      clearInterval(checkInterval);
      initializeNotifications();
    }
  }, 100);

  setTimeout(() => clearInterval(checkInterval), 5000);
});

async function initializeNotifications() {
  try {
    await loadNotificationSettings();
    setupEventListeners();
  } catch (error) {
    console.error('Failed to initialize notifications:', error);
  }
}

async function loadNotificationSettings() {
  try {
    const response = await apiFetch('/api/admin/settings/notifications');
    const data = response.data || response;
    
    if (data) {
      const emailAlerts = document.getElementById('emailAlerts');
      if (emailAlerts && data.email_alerts !== undefined) {
        emailAlerts.checked = data.email_alerts === true || data.email_alerts === 1;
      }
    }
  } catch (error) {
    console.error('Failed to load notification settings:', error);
  }
}

function setupEventListeners() {
  const saveBtn = document.getElementById('saveNotifBtn') || document.querySelector('button');
  if (saveBtn) {
    saveBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      await saveNotificationSettings();
    });
  }
}

async function saveNotificationSettings() {
  const emailAlerts = document.getElementById('emailAlerts')?.checked;

  try {
    const result = await apiFetch('/api/admin/settings/notifications', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email_alerts: emailAlerts ? 1 : 0
      })
    });

    if (result.success) {
      showToast('Notification settings saved successfully');
    }
  } catch (error) {
    console.error('Failed to save notification settings:', error);
    showToast(error.message || 'Failed to save settings', true);
  }
}