/**
 * root/public/js/super_admin/settings/user-defaults.js
 * User Defaults - Super Admin
 * Configure default settings applied to newly created users.
 */

let allRoles = [];
let allCompanies = [];
let currentSettings = {};

// ─── Data Loading ─────────────────────────────────────────────────────────────

async function loadRoles() {
    try {
        const response = await fetch('/api/roles', { credentials: 'include' });
        if (!response.ok) throw new Error('Failed to fetch roles');
        const result = await response.json();
        allRoles = result.data || [];

        const select = document.getElementById('defaultRoleId');
        allRoles.forEach(role => {
            if (role.role_name !== 'super_admin') {
                const option = document.createElement('option');
                option.value = role.id;
                option.textContent = role.role_name.charAt(0).toUpperCase() + role.role_name.slice(1).replace('_', ' ');
                select.appendChild(option);
            }
        });
    } catch (err) {
        console.error('Error loading roles:', err);
    }
}

async function loadCompanies() {
    try {
        const response = await fetch('/api/companies', { credentials: 'include' });
        if (!response.ok) throw new Error('Failed to fetch companies');
        const result = await response.json();
        allCompanies = result.data || [];

        const select = document.getElementById('defaultCompanyId');
        allCompanies.forEach(company => {
            const option = document.createElement('option');
            option.value = company.id;
            option.textContent = company.company_name;
            select.appendChild(option);
        });
    } catch (err) {
        console.error('Error loading companies:', err);
    }
}

async function loadCurrentSettings() {
    try {
        const response = await fetch('/api/super_admin/settings/user-defaults/system/filter', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ category: 'user_defaults' })
        });
        if (!response.ok) throw new Error('Failed to fetch settings');
        const result = await response.json();
        
        if (result.success && result.data) {
            // Parse settings into a key-value map
            result.data.forEach(setting => {
                currentSettings[setting.setting_key] = setting;
            });
            
            applySettings();
            renderSettingsTable(result.data);
        }
    } catch (err) {
        console.error('Error loading settings:', err);
    }
}

// ─── Apply Settings to Form ───────────────────────────────────────────────────

function applySettings() {
    // Default Role
    const defaultRoleSetting = currentSettings['user_defaults.default_role_id'];
    if (defaultRoleSetting && defaultRoleSetting.setting_value) {
        document.getElementById('defaultRoleId').value = defaultRoleSetting.setting_value;
        // Update stats display
        const role = allRoles.find(r => r.id == defaultRoleSetting.setting_value);
        document.getElementById('displayDefaultRole').textContent = role 
            ? role.role_name.charAt(0).toUpperCase() + role.role_name.slice(1).replace('_', ' ')
            : 'ID: ' + defaultRoleSetting.setting_value;
    }

    // Default Company
    const defaultCompanySetting = currentSettings['user_defaults.default_company_id'];
    if (defaultCompanySetting && defaultCompanySetting.setting_value) {
        document.getElementById('defaultCompanyId').value = defaultCompanySetting.setting_value;
        const company = allCompanies.find(c => c.id == defaultCompanySetting.setting_value);
        document.getElementById('displayDefaultCompany').textContent = company 
            ? company.company_name 
            : 'ID: ' + defaultCompanySetting.setting_value;
    }

    // Default Status
    const defaultStatusSetting = currentSettings['user_defaults.default_status'];
    if (defaultStatusSetting && defaultStatusSetting.setting_value) {
        const status = defaultStatusSetting.setting_value;
        const activeRadio = document.querySelector('input[name="default_status"][value="active"]');
        const inactiveRadio = document.querySelector('input[name="default_status"][value="inactive"]');
        if (status === 'inactive') {
            inactiveRadio.checked = true;
        } else {
            activeRadio.checked = true;
        }
        document.getElementById('displayDefaultStatus').textContent = 
            status === 'active' ? 'Active' : 'Inactive';
    }

    // Password Min Length
    const passwordMinSetting = currentSettings['user_defaults.password_min_length'];
    if (passwordMinSetting && passwordMinSetting.setting_value) {
        document.getElementById('passwordMinLength').value = passwordMinSetting.setting_value;
        document.getElementById('displayMinPassword').textContent = passwordMinSetting.setting_value;
    }

    // Password Require Special
    const passwordSpecialSetting = currentSettings['user_defaults.password_require_special'];
    if (passwordSpecialSetting && passwordSpecialSetting.setting_value) {
        document.getElementById('passwordRequireSpecial').checked = 
            passwordSpecialSetting.setting_value === 'true' || passwordSpecialSetting.setting_value === '1';
    }
}

// ─── Settings Table Rendering ─────────────────────────────────────────────────

function renderSettingsTable(settings) {
    const tbody = document.getElementById('settingsTableBody');

    if (!settings || settings.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" class="py-3 px-2 text-center text-slate-500 text-[10px]">No default user settings configured yet. Save your first defaults above.</td></tr>`;
        return;
    }

    let html = '';
    const sortedSettings = [...settings].sort((a, b) => a.setting_key.localeCompare(b.setting_key));
    
    sortedSettings.forEach(setting => {
        const key = setting.setting_key.replace('user_defaults.', '');
        let displayValue = setting.setting_value || '(empty)';
        
        // Beautify certain values
        if (key === 'default_role_id') {
            const role = allRoles.find(r => r.id == setting.setting_value);
            displayValue = role ? role.role_name : displayValue;
        } else if (key === 'default_company_id') {
            const company = allCompanies.find(c => c.id == setting.setting_value);
            displayValue = company ? company.company_name : displayValue;
        } else if (key === 'default_status') {
            displayValue = setting.setting_value === 'active' ? 'Active' : 'Inactive';
        } else if (key === 'password_require_special') {
            displayValue = setting.setting_value === 'true' || setting.setting_value === '1' ? 'Yes' : 'No';
        }
        
        const updatedAt = setting.updated_at 
            ? new Date(setting.updated_at + 'Z').toLocaleString() 
            : (setting.created_at ? new Date(setting.created_at + 'Z').toLocaleString() : 'N/A');

        html += `
            <tr class="hover:bg-slate-800/30 transition">
                <td class="py-1.5 px-2 text-slate-200 text-[10px] font-mono">${setting.setting_key}</td>
                <td class="py-1.5 px-2 text-slate-300 text-[10px]">${displayValue}</td>
                <td class="py-1.5 px-2 text-slate-400 text-[10px]">${updatedAt}</td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}

// ─── Save Form ────────────────────────────────────────────────────────────────

document.getElementById('userDefaultsForm').addEventListener('submit', async (event) => {
    event.preventDefault();

    const formData = new FormData(event.target);
    const data = Object.fromEntries(formData.entries());
    
    const saveBtn = document.getElementById('saveDefaultsBtn');
    saveBtn.disabled = true;
    saveBtn.innerHTML = `
        <svg class="w-3.5 h-3.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
        </svg>
        Saving...`;

    try {
        const settings = [];
        
        // Default Role
        if (data.default_role_id) {
            settings.push({
                key: 'user_defaults.default_role_id',
                value: data.default_role_id,
                type: 'string'
            });
        }

        // Default Company
        if (data.default_company_id) {
            settings.push({
                key: 'user_defaults.default_company_id',
                value: data.default_company_id,
                type: 'string'
            });
        }

        // Default Status
        settings.push({
            key: 'user_defaults.default_status',
            value: data.default_status || 'active',
            type: 'string'
        });

        // Password Min Length
        const passwordMinLength = document.getElementById('passwordMinLength').value || '6';
        settings.push({
            key: 'user_defaults.password_min_length',
            value: passwordMinLength,
            type: 'string'
        });

        // Password Require Special
        const passwordRequireSpecial = document.getElementById('passwordRequireSpecial').checked;
        settings.push({
            key: 'user_defaults.password_require_special',
            value: String(passwordRequireSpecial),
            type: 'string'
        });

        // Save all settings using bulk endpoint
        const response = await fetch('/api/super_admin/settings/user-defaults/system/bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ settings })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Failed to save defaults');
        }

        const result = await response.json();
        if (result.success) {
            showToast('User defaults saved successfully!', 'info');
            // Reload settings
            await refreshData();
        } else {
            throw new Error(result.error || 'Failed to save defaults');
        }
    } catch (err) {
        alert('Error: ' + err.message);
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = `
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"/>
            </svg>
            Save Defaults`;
    }
});

// ─── Live Preview Updates ─────────────────────────────────────────────────────

document.getElementById('defaultRoleId').addEventListener('change', function() {
    const role = allRoles.find(r => r.id == this.value);
    document.getElementById('displayDefaultRole').textContent = role 
        ? role.role_name.charAt(0).toUpperCase() + role.role_name.slice(1).replace('_', ' ')
        : 'Not Set';
});

document.getElementById('defaultCompanyId').addEventListener('change', function() {
    const company = allCompanies.find(c => c.id == this.value);
    document.getElementById('displayDefaultCompany').textContent = company 
        ? company.company_name 
        : 'Not Set';
});

document.querySelectorAll('input[name="default_status"]').forEach(radio => {
    radio.addEventListener('change', function() {
        document.getElementById('displayDefaultStatus').textContent = 
            this.value === 'active' ? 'Active' : 'Inactive';
    });
});

document.getElementById('passwordMinLength').addEventListener('input', function() {
    document.getElementById('displayMinPassword').textContent = this.value || '6';
});

// ─── Refresh & Init ───────────────────────────────────────────────────────────

async function refreshData() {
    currentSettings = {};
    await loadCurrentSettings();
}

async function init() {
    await Promise.all([
        loadRoles(),
        loadCompanies()
    ]);
    
    await loadCurrentSettings();
}

document.addEventListener('DOMContentLoaded', init);

