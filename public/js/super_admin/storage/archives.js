/**
 * root/public/js/super_admin/archives.js
 */

let meetingsData = [];
let instructorsList = [];
let currentPage = 1;
let totalPages = 1;
let totalMeetings = 0;
let pageSize = 20;
let activeMeetingId = null;

// ─── Initialize ──────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    initFlatpickr();
    loadInstructors();
    loadMeetings();

    // Search on Enter key
    document.getElementById('searchInput')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') applyFilters();
    });
});

// ─── Flatpickr Initialization ────────────────────────────────────────────────

function initFlatpickr() {
    const fromEl = document.getElementById('fromDate');
    const toEl = document.getElementById('toDate');

    if (window.flatpickr) {
        try {
            flatpickr(fromEl, {
                dateFormat: 'Y-m-d',
                allowInput: false,
                onChange: () => applyFilters()
            });
            flatpickr(toEl, {
                dateFormat: 'Y-m-d',
                allowInput: false,
                onChange: () => applyFilters()
            });
        } catch (e) {
            console.warn('flatpickr init failed', e);
        }
    }
}

// ─── Load Instructors ────────────────────────────────────────────────────────

async function loadInstructors() {
    try {
        const res = await fetch('/api/archives/instructors', { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to fetch instructors');
        const data = await res.json();
        instructorsList = data.instructors || [];

        const select = document.getElementById('instructorFilter');
        select.innerHTML = '<option value="">All Instructors</option>';
        instructorsList.forEach(inst => {
            const option = document.createElement('option');
            option.value = inst.id;
            option.textContent = inst.name;
            select.appendChild(option);
        });
    } catch (err) {
        console.error('Error loading instructors:', err);
    }
}

// ─── Apply Filters ───────────────────────────────────────────────────────────

function applyFilters() {
    currentPage = 1;
    loadMeetings();
}

// ─── Load Meetings ───────────────────────────────────────────────────────────

async function loadMeetings() {
    const listEl = document.getElementById('meetingsTableBody');
    if (!listEl) return;

    listEl.innerHTML = `
        <tr>
            <td colspan="6" class="py-4 text-center text-slate-500">Loading meetings...</td>
        </tr>
    `;

    const fromDate = document.getElementById('fromDate')?.value?.trim() || '';
    const toDate = document.getElementById('toDate')?.value?.trim() || '';
    const instructorId = document.getElementById('instructorFilter')?.value?.trim() || '';
    const search = document.getElementById('searchInput')?.value?.trim() || '';

    try {
        const body = {};
        if (fromDate) body.from = fromDate;
        if (toDate) body.to = toDate;
        if (instructorId) body.instructorId = Number(instructorId);
        if (search) body.search = search;
        body.page = currentPage;
        body.pageSize = pageSize;

        const res = await fetch('/api/archives', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        const text = await res.text();
        if (text.trim().startsWith('<')) {
            throw new Error('Received HTML response instead of JSON');
        }

        const data = JSON.parse(text);
        meetingsData = data.meetings || [];
        totalMeetings = data.total || 0;
        totalPages = data.totalPages || 0;
        currentPage = data.page || currentPage;
        pageSize = data.pageSize || pageSize;
    } catch (err) {
        console.warn('Data fetch failed, injecting empty list.', err);
        meetingsData = [];
        totalMeetings = 0;
        totalPages = 0;
    }

    renderMeetingsTable();
    updatePagination();
}

// ─── Render Meetings Table ───────────────────────────────────────────────────

function renderMeetingsTable() {
    const tbody = document.getElementById('meetingsTableBody');

    if (meetingsData.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="py-4 text-center text-slate-500">No meetings found</td>
            </tr>
        `;
        return;
    }

    let html = '';
    meetingsData.forEach((meeting) => {
        const d = new Date(meeting.date);
        const dateStr = d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
        const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        const platformRaw = (meeting.platform || 'unknown').toLowerCase();
        let platformLabel = platformRaw, platformColors = '';

        if (platformRaw === 'zoom') {
            platformLabel = 'Zoom';
            platformColors = 'text-blue-400 bg-blue-500/10 border-blue-500/20';
        } else if (platformRaw === 'teams') {
            platformLabel = 'Teams';
            platformColors = 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20';
        } else if (platformRaw === 'google-meet' || platformRaw === 'google') {
            platformLabel = 'G-Meet';
            platformColors = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
        } else {
            platformColors = 'text-slate-400 bg-slate-500/10 border-slate-500/20';
        }

        const sessionCount = meeting.session_count || 1;

        html += `
            <tr class="hover:bg-slate-800/30 transition">
                <td class="py-2 px-3 text-xs text-slate-300">
                    <div class="font-medium">${dateStr}</div>
                    <div class="text-[10px] text-slate-500">${timeStr}</div>
                </td>
                <td class="py-2 px-3 text-xs text-slate-200 font-medium">${meeting.title || 'Untitled Session'}</td>
                <td class="py-2 px-3 text-xs text-slate-300">${meeting.instructorName || 'Unknown'}</td>
                <td class="py-2 px-3">
                    <span class="px-1.5 py-[1px] rounded uppercase font-bold tracking-wider border ${platformColors} text-[9px]">${platformLabel}</span>
                </td>
                <td class="py-2 px-3 text-xs text-slate-300 text-center">${sessionCount}</td>
                <td class="py-2 px-3">
                    <button onclick="viewMeetingDetail('${meeting.id}')" class="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] rounded transition">
                        View
                    </button>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}

// ─── Pagination ──────────────────────────────────────────────────────────────

function updatePagination() {
    const start = totalMeetings === 0 ? 0 : (currentPage - 1) * pageSize + 1;
    const end = Math.min(currentPage * pageSize, totalMeetings);

    document.getElementById('showingStart').textContent = start;
    document.getElementById('showingEnd').textContent = end;
    document.getElementById('totalMeetings').textContent = totalMeetings;
    document.getElementById('pageInfo').textContent = `Page ${currentPage} of ${totalPages || 1}`;

    document.getElementById('prevBtn').disabled = currentPage <= 1;
    document.getElementById('nextBtn').disabled = currentPage >= totalPages;
}

function changePage(newPage) {
    if (newPage < 1 || newPage > totalPages) return;
    currentPage = newPage;
    loadMeetings();
}

window.changePage = changePage;

// ─── View Meeting Detail ─────────────────────────────────────────────────────

window.viewMeetingDetail = async function(meetingId) {
    const meeting = meetingsData.find(m => m.id === meetingId);
    if (!meeting) return;

    activeMeetingId = meetingId;
    const modal = document.getElementById('meetingDetailModal');
    const content = document.getElementById('meetingDetailContent');

    modal.classList.remove('hidden');

    const d = new Date(meeting.date);
    const dateStr = d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const platformRaw = (meeting.platform || 'unknown').toLowerCase();
    let platformLabel = platformRaw;
    if (platformRaw === 'google-meet' || platformRaw === 'google') platformLabel = 'Google Meet';
    else if (platformRaw === 'zoom') platformLabel = 'Zoom';
    else if (platformRaw === 'teams') platformLabel = 'Microsoft Teams';

    content.innerHTML = `
        <div class="space-y-4">
            <!-- Meeting Info -->
            <div class="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
                <h4 class="text-sm font-semibold text-slate-200 mb-2">${meeting.title || 'Untitled Session'}</h4>
                <div class="grid grid-cols-2 gap-2 text-[10px]">
                    <div>
                        <span class="text-slate-400">Date:</span>
                        <span class="text-slate-200 ml-1">${dateStr} at ${timeStr}</span>
                    </div>
                    <div>
                        <span class="text-slate-400">Platform:</span>
                        <span class="text-slate-200 ml-1">${platformLabel}</span>
                    </div>
                    <div>
                        <span class="text-slate-400">Instructor:</span>
                        <span class="text-slate-200 ml-1">${meeting.instructorName || 'Unknown'}</span>
                    </div>
                    <div>
                        <span class="text-slate-400">Meeting ID:</span>
                        <span class="text-slate-200 ml-1 font-mono">${meeting.meetingId || 'N/A'}</span>
                    </div>
                </div>
            </div>

            <!-- Audio Player -->
            ${meeting.audioUrl ? `
            <div class="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
                <h5 class="text-xs font-semibold text-slate-300 mb-2">Recording</h5>
                <audio controls class="w-full">
                    <source src="${meeting.audioUrl}" type="audio/mpeg">
                    Your browser does not support the audio element.
                </audio>
            </div>
            ` : ''}

            <!-- Transcript -->
            <div class="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
                <h5 class="text-xs font-semibold text-slate-300 mb-2">Transcript</h5>
                <div id="transcriptContainer" class="max-h-96 overflow-y-auto custom-scrollbar">
                    <div class="flex justify-center py-4">
                        <span class="text-[10px] text-slate-400">Loading transcript...</span>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Load transcript if available
    if (meeting.transcripts) {
        try {
            const rawText = await fetch(meeting.transcripts).then(r => r.text());
            const transcripts = parseTranscript(rawText);
            renderTranscripts(transcripts);
        } catch (err) {
            console.error("Failed to parse transcripts", err);
            document.getElementById('transcriptContainer').innerHTML = `
                <div class="flex justify-center py-4">
                    <span class="text-[10px] text-slate-500">Failed to load transcript</span>
                </div>
            `;
        }
    } else {
        document.getElementById('transcriptContainer').innerHTML = `
            <div class="flex justify-center py-4">
                <span class="text-[10px] text-slate-500">No transcript available</span>
            </div>
        `;
    }
};

// ─── Close Modal ─────────────────────────────────────────────────────────────

window.closeMeetingDetailModal = function() {
    const modal = document.getElementById('meetingDetailModal');
    modal.classList.add('hidden');
    activeMeetingId = null;
};

// ─── Transcript Parsing & Rendering ─────────────────────────────────────────

function parseTranscript(text) {
    const lines = text.split('\n');
    const result = [];
    const regex = /^\[(\d{2}:\d{2}:\d{2})\]\s([^:]+):\s(.+)$/;

    for (const line of lines) {
        const match = line.match(regex);
        if (!match) continue;

        const [, time, speaker, msg] = match;
        result.push({
            time,
            speaker,
            text: msg,
            isSystem: false,
            color: getColor(speaker)
        });
    }
    return result;
}

function getColor(speaker) {
    let hash = 0;
    for (let i = 0; i < speaker.length; i++) {
        hash += speaker.charCodeAt(i);
    }
    const colors = ['emerald', 'blue', 'indigo', 'orange', 'fuchsia'];
    return colors[hash % colors.length];
}

function renderTranscripts(transcripts) {
    const container = document.getElementById('transcriptContainer');

    if (transcripts.length === 0) {
        container.innerHTML = `
            <div class="flex justify-center py-4">
                <span class="text-[10px] text-slate-500">No transcript entries found</span>
            </div>
        `;
        return;
    }

    const colorMap = {
        'emerald': 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400',
        'blue': 'bg-blue-500/20 border-blue-500/30 text-blue-400',
        'indigo': 'bg-indigo-500/20 border-indigo-500/30 text-indigo-400',
        'orange': 'bg-orange-500/20 border-orange-500/30 text-orange-400',
        'fuchsia': 'bg-fuchsia-500/20 border-fuchsia-500/30 text-fuchsia-400',
    };

    let html = '';
    transcripts.forEach((t) => {
        const initials = t.speaker ? t.speaker.substring(0, 2).toUpperCase() : 'U';
        const colorStyle = colorMap[t.color] || 'bg-slate-700 border-slate-600 text-white';

        html += `
            <div class="flex gap-3 transcript-item mb-3">
                <div class="w-8 h-8 shrink-0 rounded-lg ${colorStyle} border flex items-center justify-center font-bold text-[10px]">
                    ${initials}
                </div>
                <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 mb-1">
                        <span class="text-[11px] font-bold text-slate-200">${t.speaker || 'Unknown Speaker'}</span>
                        <span class="text-[9px] text-slate-500 font-mono">${t.time || '--:--'}</span>
                    </div>
                    <p class="text-slate-300 text-[11px] leading-relaxed">${t.text}</p>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}