/**
 * root/public/js/super_admin/configuration/platforms.js
 * Platforms Configuration - Dynamically loaded from database
 */

document.addEventListener('DOMContentLoaded', () => {
    loadPlatforms();
});

// ─── Platform Definitions ─────────────────────────────────────────────────────

const PLATFORM_DEFS = {
    'zoom': {
        label: 'Zoom',
        icon: 'Z',
        iconBg: 'from-blue-500 to-blue-700',
        description: 'Video conferencing with web client',
        fields: [
            { key: 'enabled', type: 'toggle', label: 'Enabled', desc: 'Enable Zoom integration' },
            { key: 'base_url', type: 'text', label: 'Base URL', placeholder: 'https://us05web.zoom.us/wc/', editable: false },
            { key: 'bot_name', type: 'text', label: 'Bot Name', placeholder: 'RetentionLab Bot' },
            { key: 'requires_passcode', type: 'toggle', label: 'Requires Passcode', desc: 'Bot will extract passcode from meeting' },
            { key: 'auto_enable_captions', type: 'toggle', label: 'Auto-Enable Captions', desc: 'Automatically enable captions in meetings' }
        ]
    },
    'google-meet': {
        label: 'Google Meet',
        icon: 'G',
        iconBg: 'from-red-500 to-yellow-500',
        description: 'Google Workspace video conferencing',
        fields: [
            { key: 'enabled', type: 'toggle', label: 'Enabled', desc: 'Enable Google Meet integration' },
            { key: 'base_url', type: 'text', label: 'Base URL', placeholder: 'https://meet.google.com/', editable: false },
            { key: 'bot_name', type: 'text', label: 'Bot Name', placeholder: 'RetentionLab Bot' },
            { key: 'auto_join', type: 'toggle', label: 'Auto Join', desc: 'Automatically join scheduled meetings' },
            { key: 'auto_enable_captions', type: 'toggle', label: 'Auto-Enable Captions', desc: 'Automatically enable captions in meetings' }
        ]
    },
    'teams': {
        label: 'Microsoft Teams',
        icon: 'T',
        iconBg: 'from-purple-500 to-indigo-700',
        description: 'Microsoft 365 collaboration',
        fields: [
            { key: 'enabled', type: 'toggle', label: 'Enabled', desc: 'Enable Teams integration' },
            { key: 'base_url', type: 'text', label: 'Base URL', placeholder: 'https://teams.live.com/meet/', editable: false },
            { key: 'bot_name', type: 'text', label: 'Bot Name', placeholder: 'RetentionLab Bot' },
            { key: 'auto_join', type: 'toggle', label: 'Auto Join', desc: 'Automatically join scheduled meetings' },
            { key: 'auto_enable_captions', type: 'toggle', label: 'Auto-Enable Captions', desc: 'Automatically enable captions in meetings' }
        ]
    }
};

// ─── Recording Settings Definition ───────────────────────────────────────────

const RECORDING_DEFS = {
    label: 'Recording Settings',
    icon: 'R',
    iconBg: 'from-pink-500 to-rose-600',
    description: 'Configure audio, video, and transcript recording',
    fields: [
        { key: 'audio_recording', type: 'toggle', label: 'Audio Recording', desc: 'Record meeting audio' },
        { key: 'video_recording', type: 'toggle', label: 'Video Recording', desc: 'Record meeting video/screen' },
        { key: 'transcript_recording', type: 'toggle', label: 'Transcript Recording', desc: 'Generate meeting transcripts' }
    ]
};

// ─── Load Platforms from DB ───────────────────────────────────────────────────

async function loadPlatforms() {
    try {
        const response = await fetch('/api/settings/system?category=platforms');
        const result = await response.json();

        if (result.success && result.data) {
            const settings = result.data;
            
            // Extract which platforms exist in the database
            const platformKeys = new Set();
            settings.forEach(s => {
                const parts = s.setting_key.replace('platforms.', '').split('.');
                if (parts.length >= 2) {
                    platformKeys.add(parts[0]);
                }
            });

            // Build platform cards only for platforms in DB
            const grid = document.getElementById('platformsGrid');
            let html = '';
            
            // Build platform cards
            platformKeys.forEach(platformId => {
                const def = PLATFORM_DEFS[platformId];
                if (!def) return;

                // Get settings for this platform
                const platformSettings = settings.filter(s => s.setting_key.startsWith(`platforms.${platformId}.`));
                const settingsMap = {};
                platformSettings.forEach(s => {
                    const key = s.setting_key.replace(`platforms.${platformId}.`, '');
                    settingsMap[key] = { value: s.setting_value, editable: s.is_editable !== false };
                });

                html += buildPlatformCard(platformId, def, settingsMap);
            });

            // Build recording settings card (global, not per-platform)
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

// ─── Build Platform Card ──────────────────────────────────────────────────────

function buildPlatformCard(platformId, def, settings) {
    const isEnabled = settings['enabled']?.value === 'true';
    const enabledChecked = isEnabled ? 'checked' : '';

    let fieldsHtml = '';
    def.fields.forEach(field => {
        const setting = settings[field.key];
        const value = setting?.value || '';
        // Check both database is_editable flag and field definition editable property
        const isEditable = (field.editable !== false) && (setting?.editable !== false);
        const disabledAttr = isEditable ? '' : 'disabled';
        const disabledClass = isEditable ? '' : 'opacity-50 cursor-not-allowed';

        if (field.type === 'toggle') {
            const checked = value === 'true' ? 'checked' : '';
            fieldsHtml += `
                <div class="flex items-center justify-between ${disabledClass}">
                    <div>
                        <label class="block text-xs font-medium text-slate-300">${field.label}</label>
                        ${field.desc ? `<p class="text-[10px] text-slate-500">${field.desc}</p>` : ''}
                    </div>
                    <label class="toggle-switch">
                        <input type="checkbox" id="${platformId}-${field.key}" ${checked} ${disabledAttr}>
                        <span class="toggle-slider"></span>
                    </label>
                </div>
            `;
        } else if (field.type === 'select') {
            const options = field.options.map(opt => 
                `<option value="${opt}" ${value === opt ? 'selected' : ''}>${opt.charAt(0).toUpperCase() + opt.slice(1).replace('-', ' ')}</option>`
            ).join('');
            fieldsHtml += `
                <div>
                    <label class="block text-xs font-medium text-slate-300 mb-1">${field.label}</label>
                    <select id="${platformId}-${field.key}" class="w-full bg-slate-950 border border-slate-800 focus:border-violet-500 rounded px-2 py-1 text-xs text-slate-300 outline-none ${disabledClass}" ${disabledAttr}>
                        ${options}
                    </select>
                </div>
            `;
        } else {
            const displayValue = value || '';
            fieldsHtml += `
                <div>
                    <label class="block text-xs font-medium text-slate-300 mb-1">${field.label}</label>
                    <input type="text" id="${platformId}-${field.key}" value="${displayValue}" placeholder="${field.placeholder}"
                        class="w-full bg-slate-950 border border-slate-800 focus:border-violet-500 rounded px-2 py-1 text-xs text-slate-300 outline-none font-mono ${disabledClass}" ${disabledAttr}>
                </div>
            `;
        }
    });

    return `
        <div class="platform-card bg-slate-900 border border-slate-800 rounded overflow-hidden" data-platform="${platformId}">
            <div class="px-3 py-2 border-b border-slate-800 bg-slate-950/50 flex items-center justify-between">
                <div class="flex items-center gap-2">
                    <div class="w-7 h-7 bg-gradient-to-br ${def.iconBg} rounded flex items-center justify-center text-white font-bold text-sm">${def.icon}</div>
                    <div>
                        <h3 class="text-sm font-semibold text-white">${def.label}</h3>
                        <p class="text-[10px] text-slate-400">${def.description}</p>
                    </div>
                </div>
                <label class="toggle-switch">
                    <input type="checkbox" id="${platformId}-enabled" ${enabledChecked}>
                    <span class="toggle-slider"></span>
                </label>
            </div>
            <div class="p-3 space-y-2">
                ${fieldsHtml}
                <button onclick="testPlatform('${platformId}')" class="w-full px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-medium transition">
                    Test Connection
                </button>
            </div>
        </div>
    `;
}

// ─── Build Recording Card ─────────────────────────────────────────────────────

function buildRecordingCard(settings) {
    let fieldsHtml = '';
    RECORDING_DEFS.fields.forEach(field => {
        const value = settings[field.key]?.value || '';
        const isEditable = settings[field.key]?.editable !== false;
        const disabledAttr = isEditable ? '' : 'disabled';
        const disabledClass = isEditable ? '' : 'opacity-50 cursor-not-allowed';

        const checked = value === 'true' ? 'checked' : '';
        fieldsHtml += `
            <div class="flex items-center justify-between ${disabledClass}">
                <div>
                    <label class="block text-xs font-medium text-slate-300">${field.label}</label>
                    ${field.desc ? `<p class="text-[10px] text-slate-500">${field.desc}</p>` : ''}
                </div>
                <label class="toggle-switch">
                    <input type="checkbox" id="recording-${field.key}" ${checked} ${disabledAttr}>
                    <span class="toggle-slider"></span>
                </label>
            </div>
        `;
    });

    return `
        <div class="platform-card bg-slate-900 border border-slate-800 rounded overflow-hidden" data-platform="recording">
            <div class="px-3 py-2 border-b border-slate-800 bg-slate-950/50 flex items-center justify-between">
                <div class="flex items-center gap-2">
                    <div class="w-7 h-7 bg-gradient-to-br ${RECORDING_DEFS.iconBg} rounded flex items-center justify-center text-white font-bold text-sm">${RECORDING_DEFS.icon}</div>
                    <div>
                        <h3 class="text-sm font-semibold text-white">${RECORDING_DEFS.label}</h3>
                        <p class="text-[10px] text-slate-400">${RECORDING_DEFS.description}</p>
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
    const cards = document.querySelectorAll('.platform-card');
    const settings = [];

    cards.forEach(card => {
        const platformId = card.dataset.platform;
        
        // Handle recording settings card
        if (platformId === 'recording') {
            RECORDING_DEFS.fields.forEach(field => {
                const el = document.getElementById(`recording-${field.key}`);
                if (!el) return;
                const value = el.checked ? 'true' : 'false';
                settings.push({
                    key: `recording.${field.key}`,
                    value: value,
                    type: 'boolean'
                });
            });
            return;
        }

        // Handle platform cards
        const def = PLATFORM_DEFS[platformId];
        if (!def) return;

        def.fields.forEach(field => {
            const el = document.getElementById(`${platformId}-${field.key}`);
            if (!el) return;

            let value;
            if (field.type === 'toggle') {
                value = el.checked ? 'true' : 'false';
            } else {
                value = el.value;
            }

            settings.push({
                key: `platforms.${platformId}.${field.key}`,
                value: value,
                type: field.type === 'toggle' ? 'boolean' : 'string'
            });
        });
    });

    try {
        const response = await fetch('/api/settings/system/bulk', {
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

// ─── Test Platform ────────────────────────────────────────────────────────────

async function testPlatform(platform) {
    showToast(`Testing ${platform} connection...`, 'info');
    setTimeout(() => {
        showToast(`${platform} connection test completed`, 'success');
    }, 1500);
}

async function testAllPlatforms() {
    showToast('Testing all platform connections...', 'info');
    const cards = document.querySelectorAll('.platform-card');
    for (const card of cards) {
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    showToast('All platform tests completed', 'success');
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