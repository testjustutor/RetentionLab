/**
 * public/js/super_admin/settings/bot-configuration.js
 */

document.addEventListener('DOMContentLoaded', () => {
  loadBotSettings();
});

// Load bot settings from API
async function loadBotSettings() {
  try {
    const response = await fetch('/api/super_admin/settings/bot-configuration/settings?category=bot');
    const result = await response.json();
    
    if (result.success && result.data) {
      result.data.forEach(setting => {
        const key = setting.setting_key.replace('bot.', '');
        const el = document.getElementById(key);
        
        if (el) {
          // Use is_editable flag from database
          const isEditable = setting.is_editable !== false;
          
          if (!isEditable) {
            // Display as read-only
            el.disabled = true;
            el.classList.add('bg-slate-800', 'text-slate-400', 'cursor-not-allowed');
            if (el.type === 'checkbox') {
              el.checked = setting.setting_value === 'true';
            } else {
              el.value = setting.setting_value;
            }
          } else {
            // Editable field
            if (el.type === 'checkbox') {
              el.checked = setting.setting_value === 'true';
            } else {
              el.value = setting.setting_value;
            }
          }
        }
      });
    }
  } catch (error) {
    console.error('Error loading bot settings:', error);
    showToast('Failed to load bot settings', 'error');
  }
}

// Save all bot settings
async function saveAllSettings() {
  try {
    const settings = [
      // Bot Engine Settings
      { key: 'bot.auto_launch', value: document.getElementById('botAutoLaunch').checked ? 'true' : 'false', type: 'boolean' },
      { key: 'bot.polling_enabled', value: document.getElementById('pollingEnabled').checked ? 'true' : 'false', type: 'boolean' },
      { key: 'bot.max_concurrent', value: document.getElementById('maxConcurrentBots').value, type: 'number' },
      { key: 'bot.launch_window', value: document.getElementById('botLaunchWindow').value, type: 'number' },

      // Bot Timing (live - these actually drive config/settings.js)
      { key: 'bot.host_wait_timeout_ms', value: document.getElementById('host_wait_timeout_ms').value, type: 'number' },
      { key: 'bot.human_join_timeout_ms', value: document.getElementById('human_join_timeout_ms').value, type: 'number' },
      { key: 'bot.launch_lead_minutes', value: document.getElementById('launch_lead_minutes').value, type: 'number' },
      { key: 'bot.queued_expire_minutes', value: document.getElementById('queued_expire_minutes').value, type: 'number' },

      // Error Handling & Retries
      { key: 'bot.max_retries', value: document.getElementById('maxRetries').value, type: 'number' },
      { key: 'bot.retry_delay', value: document.getElementById('retryDelay').value, type: 'number' },
      { key: 'bot.auto_retry', value: document.getElementById('autoRetry').checked ? 'true' : 'false', type: 'boolean' },
      { key: 'bot.notify_on_failure', value: document.getElementById('notifyOnFailure').checked ? 'true' : 'false', type: 'boolean' },
      
      // Advanced Settings
      { key: 'bot.timeout', value: document.getElementById('botTimeout').value, type: 'number' },
      { key: 'bot.cleanup_interval', value: document.getElementById('cleanupInterval').value, type: 'number' },
      { key: 'bot.debug_mode', value: document.getElementById('debugMode').checked ? 'true' : 'false', type: 'boolean' }
    ];

    const response = await fetch('/api/super_admin/settings/bot-configuration/settings/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings })
    });

    const result = await response.json();
    
    if (result.success) {
      showToast(`Successfully saved ${result.summary?.success || settings.length} settings`, 'success');
    } else {
      showToast(result.error || 'Failed to save settings', 'error');
    }
  } catch (error) {
    console.error('Error saving settings:', error);
    showToast('Error saving settings', 'error');
  }
}

// Reset to default values
function resetToDefaults() {
  if (!confirm('Reset all settings to default values?')) return;

  // Bot Engine Settings
  document.getElementById('botAutoLaunch').checked = true;
  document.getElementById('pollingEnabled').checked = true;
  document.getElementById('maxConcurrentBots').value = 50;
  document.getElementById('botLaunchWindow').value = 3;

  // Bot Timing (live)
  document.getElementById('host_wait_timeout_ms').value = 900000;
  document.getElementById('human_join_timeout_ms').value = 600000;
  document.getElementById('launch_lead_minutes').value = 3;
  document.getElementById('queued_expire_minutes').value = 50;

  // Error Handling & Retries
  document.getElementById('maxRetries').value = 3;
  document.getElementById('retryDelay').value = 5;
  document.getElementById('autoRetry').checked = true;
  document.getElementById('notifyOnFailure').checked = true;
  
  // Advanced Settings
  document.getElementById('botTimeout').value = 300;
  document.getElementById('cleanupInterval').value = 24;
  document.getElementById('debugMode').checked = false;
  
  showToast('Settings reset to defaults', 'info');
}

// Toast notification
function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  const toastMessage = document.getElementById('toastMessage');
  const toastIcon = document.getElementById('toastIcon');
  
  toastMessage.textContent = message;
  
  if (type === 'success') {
    toastIcon.innerHTML = `<svg class="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>`;
  } else if (type === 'error') {
    toastIcon.innerHTML = `<svg class="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>`;
  } else {
    toastIcon.innerHTML = `<svg class="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`;
  }
  
  toast.classList.remove('translate-y-20', 'opacity-0');
  setTimeout(() => {
    toast.classList.add('translate-y-20', 'opacity-0');
  }, 3000);
}