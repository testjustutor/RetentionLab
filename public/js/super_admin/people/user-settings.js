// Load roles and settings dynamically from backend API
async function loadUserSettings() {
  const defaultRoleSelect = document.getElementById('defaultRole');
  try {
    // Load roles
    const rolesResponse = await fetch('/api/roles');
    if (!rolesResponse.ok) throw new Error('Failed to fetch roles');
    const rolesResult = await rolesResponse.json();
    const roles = rolesResult.data || [];

    defaultRoleSelect.innerHTML = '<option value="">Select a default role</option>';
    roles.forEach(role => {
      const option = document.createElement('option');
      option.value = role.id;
      option.textContent = role.role_name;
      defaultRoleSelect.appendChild(option);
    });

    // Load current settings
    const defaultRoleSetting = await fetch('/api/settings/global/user_default_role').then(r => r.ok ? r.json() : null);
    const allowRegSetting = await fetch('/api/settings/global/user_allow_registration').then(r => r.ok ? r.json() : null);

    if (defaultRoleSetting && defaultRoleSetting.setting_value) {
      defaultRoleSelect.value = defaultRoleSetting.setting_value;
    }
    document.getElementById('allowRegistration').checked = (allowRegSetting && allowRegSetting.setting_value === 'true');
  } catch (err) {
    console.error('Error loading user settings:', err);
  }
}

// Handle form submission
document.getElementById('userSettingsForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(event.target);
  const settingsData = {
    default_role: formData.get('defaultRole') || '',
    allow_registration: formData.get('allowRegistration') === 'on' ? 'true' : 'false'
  };

  try {
    // Save default role setting
    await fetch('/api/settings/global', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'user_default_role', value: settingsData.default_role, type: 'string' })
    });

    // Save allow registration setting
    await fetch('/api/settings/global', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'user_allow_registration', value: settingsData.allow_registration, type: 'string' })
    });

    alert('User settings saved successfully!');
  } catch (err) {
    alert('Error saving settings: ' + err.message);
  }
});

loadUserSettings();