/**
 * root/public/js/super_admin/people/user-settings.js
 * User Management Settings - Super Admin
 * Supports both global defaults and per-user overrides
 */

// Settings configuration mapping
const GLOBAL_SETTINGS_MAP = {
  // Registration & Access
  allowRegistration: { key: 'user_allow_registration', type: 'string' },
  defaultRole: { key: 'user_default_role', type: 'string' },
  emailVerification: { key: 'user_email_verification', type: 'string' },
  
  // Security
  minPasswordLength: { key: 'user_min_password_length', type: 'number' },
  maxLoginAttempts: { key: 'user_max_login_attempts', type: 'number' },
  sessionTimeout: { key: 'user_session_timeout', type: 'number' },
  
  // Permissions & Features
  allowGuestAccess: { key: 'allow_guest_access', type: 'string' },
  allowInstructorSelfRegistration: { key: 'allow_instructor_self_registration', type: 'string' },
  requireAdminApproval: { key: 'require_admin_approval_for_new_users', type: 'string' },
  allowMeetingDeletion: { key: 'allow_meeting_deletion', type: 'string' },
  allowReportExport: { key: 'allow_report_export', type: 'string' },
  allowReviewerAssignment: { key: 'allow_reviewer_assignment', type: 'string' },
  allowScoreEditingAfterSubmit: { key: 'allow_score_editing_after_submit', type: 'string' },
  autoAssignReviewer: { key: 'auto_assign_reviewer', type: 'string' },
  desktopNotifications: { key: 'desktop_notifications', type: 'string' }
};

const USER_SETTINGS_MAP = {
  // AI & Automation
  aiEnabled: { key: 'ai_enabled', type: 'string' },
  autoGenerateSummary: { key: 'auto_generate_summary', type: 'string' },
  autoGenerateActionItems: { key: 'auto_generate_action_items', type: 'string' },
  autoTagTopics: { key: 'auto_tag_topics', type: 'string' },
  sentimentAnalysisEnabled: { key: 'sentiment_analysis_enabled', type: 'string' },
  hallucinationCheckEnabled: { key: 'hallucination_check_enabled', type: 'string' },
  speakerDiarizationEnabled: { key: 'speaker_diarization_enabled', type: 'string' },
  topicClusteringEnabled: { key: 'topic_clustering_enabled', type: 'string' },
  aiProvider: { key: 'ai_provider', type: 'string' },
  
  // Recording & Media
  audioRecordingEnabled: { key: 'audio_capture_enabled', type: 'string' },
  videoRecordingEnabled: { key: 'video_capture_enabled', type: 'string' },
  transcriptRecordingEnabled: { key: 'transcription_enabled', type: 'string' },
  allowAudioDownload: { key: 'allow_audio_download', type: 'string' },
  allowTranscriptDownload: { key: 'allow_transcript_download', type: 'string' },
  captionsEnabled: { key: 'captions_enabled', type: 'string' },
  
  // Notifications
  notificationsEnabled: { key: 'notifications_enabled', type: 'string' },
  emailNotifications: { key: 'email_notifications', type: 'string' },
  smsNotifications: { key: 'sms_notifications', type: 'string' },
  digestFrequency: { key: 'email_digest_frequency', type: 'string' },
  digestDeliveryTime: { key: 'digest_delivery_time', type: 'string' },
  soundEnabled: { key: 'sound_enabled', type: 'string' },
  
  // Display & Localization
  language: { key: 'language', type: 'string' },
  timezone: { key: 'timezone', type: 'string' },
  dateFormat: { key: 'date_format', type: 'string' },
  timeFormat: { key: 'time_format', type: 'string' },
  theme: { key: 'theme', type: 'string' },
  itemsPerPage: { key: 'items_per_page', type: 'number' }
};

let currentUserId = null;
let currentUserData = null;

// Load users into selector
async function loadUsers() {
  try {
    const response = await fetch('/api/users', { 
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ page: 1, per_page: 100 }),
      credentials: 'include' 
    });
    if (!response.ok) throw new Error('Failed to fetch users');
    const result = await response.json();
    const users = result.data || [];

    const selector = document.getElementById('userSelector');
    users.forEach(user => {
      if (user.role_name === 'super_admin') return; // Skip super admin
      const option = document.createElement('option');
      option.value = user.id;
      option.textContent = `${user.first_name || ''} ${user.last_name || ''} (${user.email})`.trim() || user.email;
      selector.appendChild(option);
    });
  } catch (err) {
    console.error('Error loading users:', err);
  }
}

// Load roles into role selector
async function loadRoles() {
  try {
    const response = await fetch('/api/roles', { credentials: 'include' });
    if (!response.ok) throw new Error('Failed to fetch roles');
    const result = await response.json();
    const roles = result.data || [];

    const roleSelect = document.getElementById('userRoleSelect');
    roleSelect.innerHTML = '<option value="">Select a role</option>';
    
    roles.forEach(role => {
      if (role.role_name === 'super_admin') return; // Skip super admin role
      const option = document.createElement('option');
      option.value = role.id;
      option.textContent = role.role_name.charAt(0).toUpperCase() + role.role_name.slice(1).replace('_', ' ');
      roleSelect.appendChild(option);
    });
  } catch (err) {
    console.error('Error loading roles:', err);
  }
}

// Load global settings
async function loadGlobalSettings() {
  try {
    const response = await fetch('/api/settings/system', { credentials: 'include' });
    if (!response.ok) throw new Error('Failed to fetch settings');
    const result = await response.json();
    const settings = result.data || [];

    const settingsMap = {};
    settings.forEach(setting => {
      settingsMap[setting.setting_key] = setting.setting_value;
    });

    for (const [elementId, config] of Object.entries(GLOBAL_SETTINGS_MAP)) {
      const element = document.getElementById(elementId);
      if (!element) continue;

      const value = settingsMap[config.key];
      if (value === undefined || value === null) continue;

      if (element.type === 'checkbox') {
        element.checked = value === 'true' || value === true;
      } else {
        element.value = value;
      }
    }
  } catch (err) {
    console.error('Error loading global settings:', err);
    showToast('Failed to load global settings', 'error');
  }
}

// Load user-specific settings and user data
async function loadUserSettings(userId) {
  try {
    // Load user settings
    const settingsResponse = await fetch(`/api/settings/user?user_id=${userId}`, { credentials: 'include' });
    if (!settingsResponse.ok) throw new Error('Failed to fetch user settings');
    const settingsResult = await settingsResponse.json();
    const settings = settingsResult.data || [];

    const settingsMap = {};
    settings.forEach(setting => {
      settingsMap[setting.setting_key] = setting.setting_value;
    });

    for (const [elementId, config] of Object.entries(USER_SETTINGS_MAP)) {
      const element = document.getElementById(elementId);
      if (!element) continue;

      const value = settingsMap[config.key];
      if (value === undefined || value === null) continue;

      if (element.type === 'checkbox') {
        element.checked = value === 'true' || value === true;
      } else {
        element.value = value;
      }
    }

    // Load user data (role, active status)
    const userResponse = await fetch(`/api/users/${userId}`, { credentials: 'include' });
    if (!userResponse.ok) throw new Error('Failed to fetch user data');
    const userResult = await userResponse.json();
    currentUserData = userResult.data;

    // Set role selector
    const roleSelect = document.getElementById('userRoleSelect');
    if (currentUserData.role_id) {
      roleSelect.value = currentUserData.role_id;
    }

    // Set active status
    const isActiveCheckbox = document.getElementById('userIsActive');
    if (currentUserData.is_active !== undefined) {
      isActiveCheckbox.checked = currentUserData.is_active === 1 || currentUserData.is_active === true;
    }
  } catch (err) {
    console.error('Error loading user settings:', err);
    showToast('Failed to load user settings', 'error');
  }
}

// Save global settings
async function saveGlobalSettings() {
  try {
    const settingsToSave = [];
    
    for (const [elementId, config] of Object.entries(GLOBAL_SETTINGS_MAP)) {
      const element = document.getElementById(elementId);
      if (!element) continue;

      let value;
      if (element.type === 'checkbox') {
        value = element.checked ? 'true' : 'false';
      } else {
        value = element.value;
      }

      settingsToSave.push({
        key: config.key,
        value: value,
        type: config.type
      });
    }

    const response = await fetch('/api/settings/system/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ settings: settingsToSave })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to save global settings');
    }

    const result = await response.json();
    showToast(`Global settings saved (${result.summary.success} settings)`, 'success');
  } catch (err) {
    console.error('Error saving global settings:', err);
    showToast('Error saving global settings: ' + err.message, 'error');
  }
}

// Update user role and status
async function updateUser(userId) {
  try {
    const roleId = document.getElementById('userRoleSelect').value;
    const isActive = document.getElementById('userIsActive').checked;

    if (!roleId) {
      showToast('Please select a role', 'error');
      return;
    }

    const response = await fetch(`/api/users/${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        role_id: parseInt(roleId),
        is_active: isActive
      })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to update user');
    }

    const result = await response.json();
    showToast('User updated successfully', 'success');
    
    // Reload user data to reflect changes
    await loadUserSettings(userId);
  } catch (err) {
    console.error('Error updating user:', err);
    showToast('Error updating user: ' + err.message, 'error');
  }
}

// Save user-specific settings
async function saveUserSettings(userId) {
  try {
    const settingsToSave = [];
    
    for (const [elementId, config] of Object.entries(USER_SETTINGS_MAP)) {
      const element = document.getElementById(elementId);
      if (!element) continue;

      let value;
      if (element.type === 'checkbox') {
        value = element.checked ? 'true' : 'false';
      } else {
        value = element.value;
      }

      settingsToSave.push({
        key: config.key,
        value: value,
        type: config.type
      });
    }

    // Save each setting for the specific user
    const response = await fetch('/api/settings/user/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ 
        settings: settingsToSave,
        user_id: userId 
      })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to save user settings');
    }

    const result = await response.json();
    showToast(`User settings saved (${result.summary.success} settings)`, 'success');
  } catch (err) {
    console.error('Error saving user settings:', err);
    showToast('Error saving user settings: ' + err.message, 'error');
  }
}

// Reset to defaults
async function resetToDefaults() {
  if (!confirm('Reset all settings to default values? This cannot be undone.')) return;

  try {
    const defaults = {
      user_allow_registration: 'false',
      user_default_role: '',
      user_email_verification: 'true',
      user_min_password_length: '6',
      user_max_login_attempts: '5',
      user_session_timeout: '60',
      allow_guest_access: 'false',
      allow_instructor_self_registration: 'false',
      require_admin_approval_for_new_users: 'false',
      allow_meeting_deletion: 'false',
      allow_report_export: 'true',
      allow_reviewer_assignment: 'true',
      allow_score_editing_after_submit: 'false',
      auto_assign_reviewer: 'false',
      desktop_notifications: 'true'
    };

    const settingsToSave = Object.entries(defaults).map(([key, value]) => ({
      key,
      value,
      type: typeof value === 'number' ? 'number' : 'string'
    }));

    const response = await fetch('/api/settings/system/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ settings: settingsToSave })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to reset settings');
    }

    showToast('Settings reset to defaults', 'success');
    await loadGlobalSettings();
  } catch (err) {
    console.error('Error resetting settings:', err);
    showToast('Error resetting settings: ' + err.message, 'error');
  }
}

// Toast notification
function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  const toastMessage = document.getElementById('toastMessage');
  const toastIcon = document.getElementById('toastIcon');
  
  if (!toast || !toastMessage || !toastIcon) return;
  
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

// Event Listeners
document.addEventListener('DOMContentLoaded', async () => {
  await loadUsers();
  await loadRoles();
  await loadGlobalSettings();

  const userSelector = document.getElementById('userSelector');
  const globalSettingsSection = document.getElementById('globalSettingsSection');
  const userSettingsSection = document.getElementById('userSettingsSection');
  const saveBtn = document.getElementById('saveSettingsBtn');
  const resetBtn = document.getElementById('resetSettingsBtn');
  const updateUserBtn = document.getElementById('updateUserBtn');

  // User selector change handler
  userSelector?.addEventListener('change', async (e) => {
    const userId = e.target.value;
    
    if (userId) {
      // Show user-specific settings
      globalSettingsSection.classList.add('hidden');
      userSettingsSection.classList.remove('hidden');
      currentUserId = userId;
      await loadUserSettings(userId);
    } else {
      // Show global settings
      globalSettingsSection.classList.remove('hidden');
      userSettingsSection.classList.add('hidden');
      currentUserId = null;
      await loadGlobalSettings();
    }
  });

  // Save button handler
  saveBtn?.addEventListener('click', async (e) => {
    e.preventDefault();
    
    if (currentUserId) {
      await saveUserSettings(currentUserId);
    } else {
      await saveGlobalSettings();
    }
  });

  // Update user button handler
  updateUserBtn?.addEventListener('click', async (e) => {
    e.preventDefault();
    if (currentUserId) {
      await updateUser(currentUserId);
    } else {
      showToast('Please select a user first', 'error');
    }
  });

  // Reset button handler
  resetBtn?.addEventListener('click', async (e) => {
    e.preventDefault();
    await resetToDefaults();
  });
});
