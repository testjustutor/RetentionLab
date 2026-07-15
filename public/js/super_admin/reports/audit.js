/**
 * root/public/js/super_admin/audit.js
 */
document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('auditSearchInput');
    const levelSelect = document.getElementById('auditLevelSelect');
    const fromDateInput = document.getElementById('auditFromDate');
    const toDateInput = document.getElementById('auditToDate');
    const todayDate = new Date().toISOString().slice(0, 10);

    if (fromDateInput && !fromDateInput.value) {
        fromDateInput.value = todayDate;
    }
    if (toDateInput && !toDateInput.value) {
        toDateInput.value = todayDate;
    }

    // Initialize flatpickr calendars when available to show calendar UI
    if (window.flatpickr) {
        try {
            flatpickr(fromDateInput, { dateFormat: 'Y-m-d', defaultDate: todayDate, allowInput: false, onChange: () => applyFilters() });
            flatpickr(toDateInput, { dateFormat: 'Y-m-d', defaultDate: todayDate, allowInput: false, onChange: () => applyFilters() });
        } catch (e) {
            console.warn('flatpickr init failed for audit', e);
        }
    }

    if (searchInput) searchInput.addEventListener('input', applyFilters);
    if (levelSelect) levelSelect.addEventListener('change', applyFilters);
    if (fromDateInput) fromDateInput.addEventListener('change', applyFilters);
    if (toDateInput) toDateInput.addEventListener('change', applyFilters);

    const prevButton = document.getElementById('auditPrevBtn');
    const nextButton = document.getElementById('auditNextBtn');
    if (prevButton) prevButton.addEventListener('click', goToPreviousPage);
    if (nextButton) nextButton.addEventListener('click', goToNextPage);

    loadAuditData();
});

let allLogs = [];
let filteredLogs = [];
let currentPage = 1;
const pageSize = 20;

function parseLogTimestamp(timestamp) {
    if (!timestamp) return null;
    const normalized = timestamp.toString().trim().replace(' ', 'T');
    const parsed = new Date(normalized);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

async function loadAuditData() {
    try {
        const response = await fetch('/api/audit');
        if (!response.ok) throw new Error('Fetch failed');
        const data = await response.json();
        allLogs = Array.isArray(data.logs) ? data.logs : [];
        filteredLogs = allLogs;
        applyFilters();
    } catch (err) {
        console.warn('Failed to load audit API. Generating synthetic logs for standalone mode.', err);
        allLogs = generateSyntheticLogs();
        filteredLogs = allLogs;
        applyFilters();
    }
}

function applyFilters() {
    const searchInput = document.getElementById('auditSearchInput');
    const levelSelect = document.getElementById('auditLevelSelect');
    const fromDateInput = document.getElementById('auditFromDate');
    const toDateInput = document.getElementById('auditToDate');
    const query = searchInput?.value.trim().toLowerCase() || '';
    const level = levelSelect?.value || 'ALL';
    const fromDate = fromDateInput?.value ? new Date(fromDateInput.value) : null;
    const toDateRaw = toDateInput?.value ? new Date(toDateInput.value) : null;
    const toDate = toDateRaw ? new Date(toDateRaw.setHours(23, 59, 59, 999)) : null;

    filteredLogs = allLogs.filter(log => {
        if (level !== 'ALL' && log.level !== level) {
            return false;
        }

        const timestamp = parseLogTimestamp(log.timestamp);
        if (fromDate && timestamp && timestamp < fromDate) {
            return false;
        }
        if (toDate && timestamp && timestamp > toDate) {
            return false;
        }

        if (!query) return true;

        return [log.timestamp, log.level, log.module, log.description, log.user]
            .some(value => value && value.toString().toLowerCase().includes(query));
    });

    currentPage = 1;
    renderAuditLogs(filteredLogs);
    updateAuditSummary(filteredLogs.length, allLogs.length);
}

function renderAuditLogs(logs) {
    const tbody = document.getElementById('logTableBody');
    if (!tbody) return;

    const pageCount = Math.max(1, Math.ceil(logs.length / pageSize));
    if (currentPage > pageCount) {
        currentPage = pageCount;
    }

    const startIndex = (currentPage - 1) * pageSize;
    const pageItems = logs.slice(startIndex, startIndex + pageSize);

    if (!pageItems.length) {
        tbody.innerHTML = `
            <tr class="text-slate-500">
                <td class="px-4 py-6 text-center" colspan="5">No audit logs match the current filters.</td>
            </tr>
        `;
        updatePaginationControls(pageCount);
        return;
    }

    let html = '';
    pageItems.forEach(log => {
        let lvlColor = 'text-rose-400 bg-rose-500/10 border-rose-500/30';
        if (log.level === 'INFO') lvlColor = 'text-blue-400 bg-blue-500/10 border-blue-500/30';
        else if (log.level === 'WARN') lvlColor = 'text-amber-800 bg-amber-500/10 border-amber-500/30';
        else if (log.level === 'CRITICAL') lvlColor = 'text-fuchsia-400 bg-fuchsia-500/10 border-fuchsia-500/30';

        html += `
            <tr class="hover:bg-slate-800/40 transition">
                <td class="px-4 py-2.5 text-slate-500">${escapeHtml(log.timestamp)}</td>
                <td class="px-4 py-2.5">
                    <span class="px-1.5 py-[1px] rounded uppercase font-bold tracking-wider border ${lvlColor} text-[9px]">${escapeHtml(log.level)}</span>
                </td>
                <td class="px-4 py-2.5 text-slate-400">${escapeHtml(log.module)}</td>
                <td class="px-4 py-2.5 opacity-90 truncate max-w-sm">${escapeHtml(log.description)}</td>
                <td class="px-4 py-2.5 text-slate-500">${escapeHtml(log.user)}</td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
    updatePaginationControls(pageCount);
}

function updateAuditSummary(filteredCount, totalCount) {
    const pageCount = Math.max(1, Math.ceil(filteredCount / pageSize));
    const topSummary = document.getElementById('auditCountSummary');
    if (topSummary) {
        topSummary.textContent = `${filteredCount} of ${totalCount} logs displayed`;
    }

    const bottomSummary = document.getElementById('auditBottomSummary');
    if (bottomSummary) {
        bottomSummary.textContent = `Page ${currentPage} of ${pageCount} · ${filteredCount} of ${totalCount} logs shown`;
    }
}

function updatePaginationControls(pageCount) {
    const prevButton = document.getElementById('auditPrevBtn');
    const nextButton = document.getElementById('auditNextBtn');

    if (prevButton) {
        prevButton.disabled = currentPage <= 1;
        prevButton.classList.toggle('opacity-40', currentPage <= 1);
        prevButton.classList.toggle('cursor-not-allowed', currentPage <= 1);
    }

    if (nextButton) {
        nextButton.disabled = currentPage >= pageCount;
        nextButton.classList.toggle('opacity-40', currentPage >= pageCount);
        nextButton.classList.toggle('cursor-not-allowed', currentPage >= pageCount);
    }
}

function goToPreviousPage() {
    if (currentPage <= 1) return;
    currentPage -= 1;
    renderAuditLogs(filteredLogs);
    updateAuditSummary(filteredLogs.length, allLogs.length);
}

function goToNextPage() {
    const pageCount = Math.max(1, Math.ceil(filteredLogs.length / pageSize));
    if (currentPage >= pageCount) return;
    currentPage += 1;
    renderAuditLogs(filteredLogs);
    updateAuditSummary(filteredLogs.length, allLogs.length);
}

function generateSyntheticLogs() {
    const modules = ['DB_ADMIN', 'AUTH', 'BOT_ENGINE', 'MEETING', 'TRANSCRIPT'];
    const levels = ['INFO', 'WARN', 'ERROR', 'CRITICAL'];
    const users = ['system', 'bot-19x', 'admin@local', 'bot-14z', 'cron'];
    const descriptions = [
        'User authenticated successfully via multi-cal auth flow.',
        'Bot connected to Zoom meeting ID 91029.',
        'Truncated table transcriptModel due to retention policy.',
        'Failed to join Google Meet (invalid passcode).',
        'Started audio segmentation process (chunk_size: 30s).',
        'Exported DB snapshot to zip file.',
        'Saved audit report to storage/audits.',
        'Query returned 0 results for meeting participants.',
        'Health check passed for AI inference pipeline.',
        'Warning: metrics collection temporarily delayed.'
    ];

    const logs = [];
    const now = new Date();
    for (let i = 0; i < 100; i++) {
        const time = new Date(now.getTime() - i * 18000).toISOString().split('.')[0].replace('T', ' ');
        logs.push({
            timestamp: time,
            level: levels[Math.floor(Math.random() * levels.length)],
            module: modules[Math.floor(Math.random() * modules.length)],
            description: descriptions[Math.floor(Math.random() * descriptions.length)],
            user: users[Math.floor(Math.random() * users.length)]
        });
    }
    return logs;
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, function (tag) {
        const charsToReplace = {
            '&': '&',
            '<': '<',
            '>': '>',
            '"': '"',
            "'": '&#39;'
        };
        return charsToReplace[tag] || tag;
    });
}