/**
 * Admin Settings - Organization Page
 * Handles company profile settings like name, timezone, and branding
 */

document.addEventListener('DOMContentLoaded', () => {
  const checkInterval = setInterval(() => {
    if (typeof apiFetch === 'function') {
      clearInterval(checkInterval);
      initializeOrganization();
    }
  }, 100);

  setTimeout(() => clearInterval(checkInterval), 5000);
});

async function initializeOrganization() {
  try {
    await loadOrganizationSettings();
    setupEventListeners();
  } catch (error) {
    console.error('Failed to initialize organization settings:', error);
  }
}

async function loadOrganizationSettings() {
  try {
    const response = await apiFetch('/api/admin/settings/organization');
    const data = response.data || response;
    
    if (data) {
      const companyName = document.getElementById('companyName');
      const timezone = document.getElementById('timezone');
      
      if (companyName && data.company_name) {
        companyName.value = data.company_name;
      }
      if (timezone && data.timezone) {
        timezone.value = data.timezone;
      }
    }
  } catch (error) {
    console.error('Failed to load organization settings:', error);
  }
}

function setupEventListeners() {
  const saveBtn = document.getElementById('saveOrgBtn') || document.querySelector('button');
  if (saveBtn) {
    saveBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      await saveOrganizationSettings();
    });
  }
}

async function saveOrganizationSettings() {
  const companyName = document.getElementById('companyName')?.value?.trim();
  const timezone = document.getElementById('timezone')?.value;

  try {
    const result = await apiFetch('/api/admin/settings/organization', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_name: companyName,
        timezone: timezone
      })
    });

    if (result.success) {
      showToast('Organization settings saved successfully');
    }
  } catch (error) {
    console.error('Failed to save organization settings:', error);
    showToast(error.message || 'Failed to save settings', true);
  }
}