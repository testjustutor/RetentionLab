/**
 * public/js/super_admin/settings/platforms.js
 *
 * Which platforms exist and their display labels come from the
 * calendar_providers DB table; every configurable field (which settings
 * exist per platform, their current value, and whether they're editable)
 * comes from the system_settings rows returned alongside them. Nothing
 * about WHICH platforms/settings exist is hardcoded here — only pure
 * presentation (icon glyph/color) and a couple of generic rendering rules
 * live in this file, since no DB column represents those.
 */

document.addEventListener('DOMContentLoaded', () => {
    loadPlatforms();
});

// ─── Presentation-only helpers (not business data) ────────────────────────

// Rotating icon colors — purely cosmetic, cycles for however many platforms
// the database actually returns (not tied to specific platform names).
const ICON_PALETTE = [
    'from-blue-500 to-blue-700',
    'from-red-500 to-yellow-500',
    'from-purple-500 to-indigo-700',
    'from-emerald-500 to-teal-700',
    'from-orange-500 to-amber-700'
];

// Setting keys that must never render as editable here regardless of what's
// in the database — their values are wired into platform-adapter code
// elsewhere, not something to hand-edit from this page. (Currently empty —
// base_url used to be the one entry here, but it's fully hidden below now
// instead of just locked. Kept as a hook for any future read-only field.)
const LOCKED_FIELD_KEYS = new Set([]);

// Setting keys not shown on this page at all (still exist in system_settings
// and still saved/read normally elsewhere — just not surfaced in this card
// per the owner's request). Only "Enabled" is shown on a platform card now.
const HIDDEN_FIELD_KEYS = new Set(['bot_name', 'base_url', 'auto_join', 'auto_enable_captions', 'requires_passcode']);

function humanizeKey(key) {
    return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function isBooleanValue(value) {
    return value === 'true' || value === 'false';
}

// ─── Load Platforms from DB ───────────────────────────────────────────────────

async function loadPlatforms() {
    try {
        const response = await fetch('/api/super_admin/settings/platforms/settings?category=platforms', { credentials: 'include' });
        const result = await response.json();

        if (result.success && result.data) {
            const settings = result.data;
            const providers = result.providers || [];

            const grid = document.getElementById('platformsGrid');
            let html = '';

            // Build one card per platform row from calendar_providers — the
            // platform list is whatever the database says it is.
            providers.forEach((provider, index) => {
                const platformId = provider.name;
                const platformSettings = settings.filter(s => s.setting_key.startsWith(`platforms.${platformId}.`));
                const settingsMap = {};
                platformSettings.forEach(s => {
                    const key = s.setting_key.replace(`platforms.${platformId}.`, '');
                    settingsMap[key] = { value: s.setting_value, editable: s.is_editable !== false };
                });

                html += buildPlatformCard(platformId, provider.display_name || platformId, settingsMap, index);
            });

            // Recording settings (global, not per-platform) — still driven
            // entirely by whichever recording.* rows exist in the DB.
            const recordingSettings = settings.filter(s => s.setting_key.startsWith('recording.'));
            if (recordingSettings.length > 0) {
                const recordingSettingsMap = {};
                recordingSettings.forEach(s => {
                    const key = s.setting_key.replace('recording.', '');
                    recordingSettingsMap[key] = { value: s.setting_value, editable: s.is_editable !== false };
                });
                html += buildRecordingCard(recordingSettingsMap);
            }

            if (!html) {
                grid.innerHTML = '<div class="col-span-full text-center py-8 text-slate-400 text-sm">No platforms configured in database. Run seeders to add platform settings.</div>';
            } else {
                grid.innerHTML = html;
            }
        } else {
            document.getElementById('platformsGrid').innerHTML = '<div class="col-span-full text-center py-8 text-slate-400 text-sm">Failed to load platforms from database</div>';
        }
    } catch (error) {
        console.error('Error loading platforms:', error);
        document.getElementById('platformsGrid').innerHTML = '<div class="col-span-full text-center py-8 text-slate-400 text-sm">Error loading platforms</div>';
    }
}

// ─── Build Platform Card (fields = whatever exists in system_settings) ────────

function buildPlatformCard(platformId, label, settings, colorIndex) {
    const isEnabled = settings['enabled']?.value === 'true';
    const enabledChecked = isEnabled ? 'checked' : '';
    const icon = (label.charAt(0) || '?').toUpperCase();
    const iconBg = ICON_PALETTE[colorIndex % ICON_PALETTE.length];

    let fieldsHtml = '';
    Object.keys(settings)
        .filter(key => key !== 'enabled' && !HIDDEN_FIELD_KEYS.has(key))
        .sort()
        .forEach(key => {
            const setting = settings[key];
            const value = setting.value || '';
            const isEditable = !LOCKED_FIELD_KEYS.has(key) && setting.editable !== false;
            const disabledAttr = isEditable ? '' : 'disabled';
            const disabledClass = isEditable ? '' : 'opacity-50 cursor-not-allowed';
            const settingKey = `platforms.${platformId}.${key}`;

            if (isBooleanValue(value)) {
                const checked = value === 'true' ? 'checked' : '';
                fieldsHtml += `
                    <div class="flex items-center justify-between ${disabledClass}">
                        <div>
                            <label class="block text-xs font-bold text-blue-900">${humanizeKey(key)}</label>
                        </div>
                        <label class="toggle-switch">
                            <input type="checkbox" data-setting-key="${settingKey}" data-setting-type="boolean" ${checked} ${disabledAttr}>
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                `;
            } else {
                fieldsHtml += `
                    <div>
                        <label class="block text-xs font-bold text-blue-900 mb-1">${humanizeKey(key)}</label>
                        <input type="text" data-setting-key="${settingKey}" data-setting-type="string" value="${value}"
                            class="w-full bg-white border border-blue-300 focus:border-blue-500 rounded px-2 py-1 text-xs text-slate-900 outline-none font-mono ${disabledClass}" ${disabledAttr}>
                    </div>
                `;
            }
        });

    return `
        <div class="platform-card bg-white border-2 border-blue-200 rounded overflow-hidden shadow-md" data-platform="${platformId}">
            <div class="px-3 py-2 border-b-2 border-blue-200 bg-blue-50 flex items-center justify-between">
                <div class="flex items-center gap-2">
                    <div class="w-7 h-7 bg-gradient-to-br ${iconBg} rounded flex items-center justify-center text-white font-bold text-sm">${icon}</div>
                    <div>
                        <h3 class="text-sm font-bold text-blue-950">${label}</h3>
                    </div>
                </div>
                <label class="toggle-switch">
                    <input type="checkbox" data-setting-key="platforms.${platformId}.enabled" data-setting-type="boolean" ${enabledChecked}>
                    <span class="toggle-slider"></span>
                </label>
            </div>
            <div class="p-3 space-y-2">
                ${fieldsHtml}
            </div>
        </div>
    `;
}

// ─── Build Recording Card ─────────────────────────────────────────────────────

function buildRecordingCard(settings) {
    let fieldsHtml = '';
    Object.keys(settings).sort().forEach(key => {
        const setting = settings[key];
        const value = setting.value || '';
        const isEditable = setting.editable !== false;
        const disabledAttr = isEditable ? '' : 'disabled';
        const disabledClass = isEditable ? '' : 'opacity-50 cursor-not-allowed';
        const checked = value === 'true' ? 'checked' : '';

        fieldsHtml += `
            <div class="flex items-center justify-between ${disabledClass}">
                <div>
                    <label class="block text-xs font-bold text-blue-900">${humanizeKey(key)}</label>
                </div>
                <label class="toggle-switch">
                    <input type="checkbox" data-setting-key="recording.${key}" data-setting-type="boolean" ${checked} ${disabledAttr}>
                    <span class="toggle-slider"></span>
                </label>
            </div>
        `;
    });

    return `
        <div class="platform-card bg-white border-2 border-blue-200 rounded overflow-hidden shadow-md" data-platform="recording">
            <div class="px-3 py-2 border-b-2 border-blue-200 bg-blue-50 flex items-center justify-between">
                <div class="flex items-center gap-2">
                    <div class="w-7 h-7 bg-gradient-to-br from-pink-500 to-rose-600 rounded flex items-center justify-center text-white font-bold text-sm">R</div>
                    <div>
                        <h3 class="text-sm font-bold text-blue-950">Recording Settings</h3>
                    </div>
                </div>
            </div>
            <div class="p-3 space-y-2">
                ${fieldsHtml}
            </div>
        </div>
    `;
}

// ─── Save All Platforms ───────────────────────────────────────────────────────

async function saveAllPlatforms() {
    const inputs = document.querySelectorAll('[data-setting-key]');
    const settings = [];

    inputs.forEach(el => {
        const key = el.dataset.settingKey;
        const type = el.dataset.settingType || 'string';
        const value = type === 'boolean' ? (el.checked ? 'true' : 'false') : el.value;
        settings.push({ key, value, type });
    });

    try {
        const response = await fetch('/api/super_admin/settings/platforms/settings/bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ settings })
        });

        const result = await response.json();

        if (result.success) {
            showToast(`Successfully saved ${result.summary?.success || settings.length} settings`, 'success');
        } else {
            showToast(result.error || 'Failed to save settings', 'error');
        }
    } catch (error) {
        console.error('Error saving platforms:', error);
        showToast('Error saving platforms', 'error');
    }
}

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
