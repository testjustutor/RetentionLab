/**
 * public/js/super_admin/settings/calendar-integrations.js
 * Super Admin toggle for the Google/Microsoft Calendar OAuth integrations.
 * Each toggle saves immediately on change (unlike the Platform Integrations
 * page's "Save Changes" batch pattern) — there's only one field per card
 * here, so an immediate save keeps the UX unambiguous.
 */

document.addEventListener('DOMContentLoaded', () => {
    loadProviders();
});

// ─── Provider Presentation Definitions ────────────────────────────────────────

const PROVIDER_DEFS = {
    google: {
        icon: 'G',
        iconBg: 'from-red-500 to-yellow-500',
        description: 'Instructor self-connect + admin-triggered Google Calendar sync'
    },
    microsoft: {
        icon: 'M',
        iconBg: 'from-indigo-500 to-blue-700',
        description: 'Instructor self-connect + admin-triggered Microsoft (Outlook/Teams) Calendar sync'
    }
};

// ─── Load Providers from DB ────────────────────────────────────────────────────

async function loadProviders() {
    try {
        const response = await fetch('/api/super_admin/settings/calendar-integrations/settings', { credentials: 'include' });
        const result = await response.json();

        const grid = document.getElementById('providersGrid');

        if (result.success && Array.isArray(result.data) && result.data.length > 0) {
            grid.innerHTML = result.data.map(buildProviderCard).join('');
        } else {
            grid.innerHTML = '<div class="col-span-full text-center py-8 text-slate-400 text-sm">No calendar providers configured in database.</div>';
        }
    } catch (error) {
        console.error('Error loading calendar integrations:', error);
        document.getElementById('providersGrid').innerHTML = '<div class="col-span-full text-center py-8 text-slate-400 text-sm">Error loading calendar integrations</div>';
    }
}

// ─── Build Provider Card ───────────────────────────────────────────────────────

function buildProviderCard(provider) {
    const def = PROVIDER_DEFS[provider.key] || { icon: '?', iconBg: 'from-slate-500 to-slate-700', description: '' };
    const checked = provider.is_active ? 'checked' : '';
    const disabledAttr = provider.configured ? '' : 'disabled';
    const statusNote = provider.configured
        ? ''
        : '<p class="text-[10px] text-amber-600 mt-1">Not found in calendar_providers — run the calendar_providers seeder.</p>';

    return `
        <div class="platform-card bg-white border-2 border-blue-200 rounded overflow-hidden shadow-md" data-provider-id="${provider.id || ''}" data-provider-key="${provider.key}">
            <div class="px-3 py-2 border-b-2 border-blue-200 bg-blue-50 flex items-center justify-between">
                <div class="flex items-center gap-2">
                    <div class="w-7 h-7 bg-gradient-to-br ${def.iconBg} rounded flex items-center justify-center text-white font-bold text-sm">${def.icon}</div>
                    <div>
                        <h3 class="text-sm font-bold text-blue-950">${provider.label}</h3>
                        <p class="text-[10px] text-blue-700">${def.description}</p>
                    </div>
                </div>
                <label class="toggle-switch">
                    <input type="checkbox" class="provider-enabled-toggle" data-provider-id="${provider.id || ''}" data-provider-label="${provider.label}" ${checked} ${disabledAttr}>
                    <span class="toggle-slider"></span>
                </label>
            </div>
            <div class="p-3">
                <p class="text-[11px] text-slate-500">
                    ${provider.is_active
                        ? 'Instructors can self-connect and admins can send connect emails for this provider.'
                        : 'Connect actions are hidden and blocked for this provider until re-enabled.'}
                </p>
                ${statusNote}
            </div>
        </div>
    `;
}

// ─── Toggle Handler (save immediately on change) ───────────────────────────────

document.addEventListener('change', async function(e) {
    const toggle = e.target.closest('.provider-enabled-toggle');
    if (!toggle) return;

    const id = toggle.getAttribute('data-provider-id');
    const label = toggle.getAttribute('data-provider-label') || 'Provider';
    const isActive = toggle.checked;

    if (!id) {
        showToast(`${label} is not configured in the database yet`, 'error');
        toggle.checked = !isActive;
        return;
    }

    toggle.disabled = true;

    try {
        const response = await fetch('/api/super_admin/settings/calendar-integrations/settings/toggle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ id: Number(id), is_active: isActive })
        });
        const result = await response.json();

        if (result.success) {
            showToast(result.message || `${label} ${isActive ? 'enabled' : 'disabled'}`, 'success');
            // Refresh the card's description text without a full reload.
            loadProviders();
        } else {
            showToast(result.error || `Failed to update ${label}`, 'error');
            toggle.checked = !isActive;
        }
    } catch (error) {
        console.error('Error toggling calendar provider:', error);
        showToast(`Error updating ${label}`, 'error');
        toggle.checked = !isActive;
    } finally {
        toggle.disabled = false;
    }
});

// ─── Toast Notification ───────────────────────────────────────────────────────

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
