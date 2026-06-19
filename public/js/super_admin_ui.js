/**
 * root/public/js/super_admin_ui.js
*/
import API from './auth.js';

async function fetchWithAuth(url, options = {}) {
    const res = await fetch(url, Object.assign({
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
    }, options));
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

// ---------------------------
// DASHBOARD LOGIC (index.html)
// ---------------------------
async function initDashboard() {
    try {
        const data = await fetchWithAuth('/api/dashboard/super_admin');
        
        // Update stats
        const activeSchedulesEl = document.getElementById('statActiveSchedules');
        if (activeSchedulesEl) activeSchedulesEl.textContent = data.activeSchedules.toLocaleString();
        
        const systemLoadEl = document.getElementById('statSystemLoad');
        if (systemLoadEl) systemLoadEl.textContent = data.systemLoad + '%';
        
        const systemLoadBarEl = document.getElementById('statSystemLoadBar');
        if (systemLoadBarEl) systemLoadBarEl.style.width = data.systemLoad + '%';
        
        const apiRequestsEl = document.getElementById('statApiRequests');
        if (apiRequestsEl) apiRequestsEl.textContent = (data.apiRequests / 1000).toFixed(1) + 'k';
        
        const gatewayFlagsEl = document.getElementById('statGatewayFlags');
        if (gatewayFlagsEl) gatewayFlagsEl.textContent = data.gatewayFlags;

        // Render deployments
        const deploymentsTbody = document.getElementById('deploymentsTbody');
        if (deploymentsTbody && data.deployments) {
            deploymentsTbody.innerHTML = '';
            data.deployments.forEach(dep => {
                const tr = document.createElement('tr');
                tr.className = "border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors";
                tr.innerHTML = `
                    <td class="py-3 pl-2 text-slate-300 font-medium text-[11px]">${dep.id}</td>
                    <td class="py-3 font-mono text-violet-400 text-[11px]">${dep.service}</td>
                    <td class="py-3">${dep.environment}</td>
                    <td class="py-3 text-slate-400">${dep.time}</td>
                    <td class="py-3 text-right">
                        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">${dep.status}</span>
                    </td>
                `;
                deploymentsTbody.appendChild(tr);
            });
        }
    } catch (err) {
        console.error("Failed to load super admin dashboard:", err);
    }
}

// ---------------------------
// PROFILE LOGIC (profile.html)
// ---------------------------
async function initProfile() {
    try {
        const { user } = await API.me();
        if (!user) return;

        // Populate profile card
        const cardName = document.getElementById('cardName');
        const cardEmail = document.getElementById('cardEmail');
        const bigAvatar = document.getElementById('bigAvatar');
        
        const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email.split('@')[0];
        
        if (cardName) cardName.textContent = fullName;
        if (cardEmail) cardEmail.textContent = user.email;
        if (bigAvatar) bigAvatar.textContent = fullName.substring(0, 2).toUpperCase();

        // Populate form
        const inputName = document.getElementById('inputName');
        const inputEmail = document.getElementById('inputEmail');
        if (inputName) inputName.value = fullName;
        if (inputEmail) inputEmail.value = user.email;

        // Fetch logs
        const logsRes = await fetchWithAuth('/api/audit?limit=5');
        const logsTbody = document.getElementById('logsTbody');
        if (logsTbody && logsRes.logs) {
            logsTbody.innerHTML = '';
            logsRes.logs.slice(0, 5).forEach(log => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td class="py-2.5 font-mono text-violet-400">${log.module}</td>
                    <td class="py-2.5">${log.user || 'system'}</td>
                    <td class="py-2.5 text-slate-500">${new Date(log.timestamp).toLocaleString()}</td>
                `;
                logsTbody.appendChild(tr);
            });
        }
        
    } catch (err) {
        console.error("Failed to load profile:", err);
    }
}

// Attach a global save handler for the form
window.saveProfile = async function(e) {
    e.preventDefault();
    try {
        const { user } = await API.me();
        const first_name = document.getElementById('inputName').value.split(' ')[0];
        const last_name = document.getElementById('inputName').value.split(' ').slice(1).join(' ');
        const email = document.getElementById('inputEmail').value;
        
        await fetchWithAuth(`/api/users/${user.id}`, {
            method: 'PUT',
            body: JSON.stringify({ first_name, last_name, email })
        });
        alert('Profile saved successfully!');
        window.location.reload();
    } catch (err) {
        alert('Failed to save profile');
        console.error(err);
    }
};

// ---------------------------
// SETTINGS LOGIC (settings.html)
// ---------------------------
async function initSettings() {
    try {
        const { user } = await API.me();
        if (!user) return;
        
        // Fetch current user settings
        const settings = ['email_notifications', 'maintenance_mode', 'session_timeout', 'rate_limit'];
        for (const key of settings) {
            try {
                const res = await fetchWithAuth(`/api/settings/user/${user.id}/${key}`);
                if (res && res.setting_value !== undefined) {
                    const el = document.getElementById(`setting_${key}`);
                    if (el) {
                        if (el.type === 'checkbox') {
                            el.checked = res.setting_value === 'true';
                        } else {
                            el.value = res.setting_value;
                        }
                    }
                }
            } catch (e) {
                // Ignore missing settings
            }
        }

        // Attach listeners to save on change
        const els = document.querySelectorAll('.dynamic-setting');
        els.forEach(el => {
            el.addEventListener('change', async (e) => {
                const key = e.target.id.replace('setting_', '');
                const value = e.target.type === 'checkbox' ? e.target.checked.toString() : e.target.value;
                try {
                    await fetchWithAuth(`/api/settings/user/${user.id}`, {
                        method: 'POST',
                        body: JSON.stringify({ key, value })
                    });
                } catch (err) {
                    console.error('Failed to save setting:', err);
                }
            });
        });

    } catch (err) {
        console.error("Failed to load settings:", err);
    }
}

// ---------------------------
// ROUTER
// ---------------------------
document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname;
    if (path.includes('super_admin/index.html')) {
        initDashboard();
    } else if (path.includes('super_admin/profile.html')) {
        initProfile();
    } else if (path.includes('super_admin/settings.html')) {
        initSettings();
    }
});