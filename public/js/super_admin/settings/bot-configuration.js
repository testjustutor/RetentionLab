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
      // Puppeteer Configuration
      { key: 'bot.default_viewport', value: document.getElementById('defaultViewport').value, type: 'string' },
      { key: 'bot.protocol_timeout', value: document.getElementById('protocolTimeout').value, type: 'number' },
      { key: 'bot.slow_mo', value: document.getElementById('slowMo').value, type: 'number' },
      { key: 'bot.ignore_default_args', value: document.getElementById('ignoreDefaultArgs').value, type: 'string' },
      { key: 'bot.user_data_dir', value: document.getElementById('userDataDir').value, type: 'string' },
      { key: 'bot.headless_mode', value: document.getElementById('headlessMode').checked ? 'true' : 'false', type: 'boolean' },
      
      // Audio Configuration
      { key: 'bot.audio_device_name', value: document.getElementById('audioDeviceName').value, type: 'string' },
      { key: 'bot.audio_bitrate', value: document.getElementById('audioBitrate').value, type: 'string' },
      { key: 'bot.audio_sample_rate', value: document.getElementById('audioSampleRate').value, type: 'number' },
      { key: 'bot.audio_channels', value: document.getElementById('audioChannels').value, type: 'number' },
      { key: 'bot.audio_format', value: document.getElementById('audioFormat').value, type: 'string' },
      { key: 'bot.audio_enhancement', value: document.getElementById('audioEnhancement').checked ? 'true' : 'false', type: 'boolean' },
      
      // Screen Configuration
      { key: 'bot.screen_framerate', value: document.getElementById('screenFramerate').value, type: 'number' },
      { key: 'bot.screen_crf', value: document.getElementById('screenCrf').value, type: 'number' },
      
      // Bot Engine Settings
      { key: 'bot.auto_launch', value: document.getElementById('botAutoLaunch').checked ? 'true' : 'false', type: 'boolean' },
      { key: 'bot.polling_enabled', value: document.getElementById('pollingEnabled').checked ? 'true' : 'false', type: 'boolean' },
      { key: 'bot.max_concurrent', value: document.getElementById('maxConcurrentBots').value, type: 'number' },
      { key: 'bot.launch_window', value: document.getElementById('botLaunchWindow').value, type: 'number' },
      
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
  
  // Puppeteer Configuration
  document.getElementById('defaultViewport').value = 'null';
  document.getElementById('protocolTimeout').value = 180000;
  document.getElementById('slowMo').value = 0;
  document.getElementById('ignoreDefaultArgs').value = '--mute-audio';
  document.getElementById('userDataDir').value = './storage/chrome-profiles';
  document.getElementById('headlessMode').checked = true;
  
  // Audio Configuration
  document.getElementById('audioDeviceName').value = 'audio=CABLE Output (VB-Audio Virtual Cable)';
  document.getElementById('audioBitrate').value = '128k';
  document.getElementById('audioSampleRate').value = '48000';
  document.getElementById('audioChannels').value = '1';
  document.getElementById('audioFormat').value = 'libmp3lame';
  document.getElementById('audioEnhancement').checked = true;
  
  // Screen Configuration
  document.getElementById('screenFramerate').value = 15;
  document.getElementById('screenCrf').value = 28;
  
  // Bot Engine Settings
  document.getElementById('botAutoLaunch').checked = true;
  document.getElementById('pollingEnabled').checked = true;
  document.getElementById('maxConcurrentBots').value = 50;
  document.getElementById('botLaunchWindow').value = 3;
  
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