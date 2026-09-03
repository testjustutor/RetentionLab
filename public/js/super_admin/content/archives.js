/**
 * public/js/super_admin/content/archives.js
 */

let meetingsData = [];
let instructorsList = [];
let currentPage = 1;
let totalPages = 1;
let totalMeetings = 0;
let pageSize = 20;
let activeMeetingId = null;
let meetingsTable = null;

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Initialize Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

document.addEventListener('DOMContentLoaded', () => {
    initFlatpickr();
    loadInstructors();
    loadMeetings();

    // Search on Enter key
    document.getElementById('searchInput')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') applyFilters();
    });
});

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Flatpickr Initialization Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

function defaultDateRange() {
    // Returns { from, to } as YYYY-MM-DD covering the last 1 week (7 days).
    const to = new Date();
    const from = new Date();
    from.setDate(to.getDate() - 7);
    const fmt = (d) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    };
    return { from: fmt(from), to: fmt(to) };
}

function initFlatpickr() {
    const fromEl = document.getElementById('fromDate');
    const toEl = document.getElementById('toDate');
    const defaults = defaultDateRange();

    if (window.flatpickr) {
        try {
            flatpickr(fromEl, {
                dateFormat: 'Y-m-d',
                allowInput: false,
                defaultDate: defaults.from,
                onChange: () => applyFilters()
            });
            flatpickr(toEl, {
                dateFormat: 'Y-m-d',
                allowInput: false,
                defaultDate: defaults.to,
                onChange: () => applyFilters()
            });
        } catch (e) {
            console.warn('flatpickr init failed', e);
            if (fromEl) fromEl.value = defaults.from;
            if (toEl) toEl.value = defaults.to;
        }
    } else {
        // Fallback if flatpickr failed to load
        if (fromEl) fromEl.value = defaults.from;
        if (toEl) toEl.value = defaults.to;
    }
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Load Instructors Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

async function loadInstructors() {
    try {
        const res = await fetch('/api/super_admin/content/archives/instructors', { credentials: 'include' });
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

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Apply Filters Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

function applyFilters() {
    currentPage = 1;
    loadMeetings();
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Load Meetings Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

async function loadMeetings() {
    const meetingsList = document.getElementById('meetingsTableContainer');
    if (!meetingsList) return;

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

        const res = await fetch('/api/super_admin/content/archives/meetings', {
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

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Render Meetings Table Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

function renderMeetingsTable() {
    const container = document.getElementById('meetingsTableContainer');
    if (!container) return;

    const rows = meetingsData.map(meeting => {
        const d = new Date(meeting.date);
        const dateStr = d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
        return {
            id: meeting.id,
            title: meeting.title || 'Untitled Session',
            date: dateStr,
            instructor: meeting.instructorName || 'Unknown',
            platform: meeting.platform || 'unknown',
            sessions: meeting.session_count || 1
        };
    });

    if (!meetingsTable) {
        meetingsTable = createTable({
            containerId: 'meetingsTableContainer',
            searchable: false,          // handled by external filters + server
            pagination: false,          // handled by external prev/next (server-side)
            exportable: true,
            exportFilename: 'archives',
            emptyMessage: 'No meetings found',
            headers: [
                { label: 'Date', key: 'date', width: '15%', render: (val) => '<span class="text-emerald-950 text-xs font-semibold">' + escHtml(val) + '</span>' },
                { label: 'Title', key: 'title', width: '34%', render: (val) => '<span class="text-slate-900 text-xs font-medium">' + escHtml(val) + '</span>' },
                { label: 'Instructor', key: 'instructor', width: '18%', render: (val) => '<span class="text-emerald-900 text-xs">' + escHtml(val) + '</span>' },
                {
                    label: 'Platform', key: 'platform', width: '14%',
                    render: (val) => {
                        const raw = String(val || 'unknown').toLowerCase();
                        let label = raw, colors = 'bg-slate-100 text-slate-700 border-slate-200';
                        if (raw === 'zoom') { label = 'Zoom'; colors = 'bg-blue-100 text-blue-700 border-blue-200'; }
                        else if (raw === 'teams') { label = 'Teams'; colors = 'bg-indigo-100 text-indigo-700 border-indigo-200'; }
                        else if (raw === 'google-meet' || raw === 'google') { label = 'G-Meet'; colors = 'bg-emerald-100 text-emerald-700 border-emerald-200'; }
                        return '<span class="inline-flex px-1.5 py-0.5 rounded-full uppercase font-bold tracking-wider border text-[9px] ' + colors + '">' + escHtml(label) + '</span>';
                    }
                },
                { label: 'Sessions', key: 'sessions', width: '8%', align: 'right', render: (val) => '<span class="text-emerald-900 text-xs">' + (val || 1) + '</span>' },
                { label: 'Actions', key: 'id', width: '11%', align: 'right', render: (val) => '<button onclick="viewMeetingDetail(\'' + escHtml(val) + '\')" class="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] rounded transition">View</button>' }
            ]
        });
    }

    meetingsTable.setData(rows);
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Pagination Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

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

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ View Meeting Detail Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

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
            <div class="bg-white rounded-lg p-3 border border-slate-200">
                <h4 class="text-sm font-semibold text-slate-200 mb-2">${meeting.title || 'Untitled Session'}</h4>
                <div class="grid grid-cols-2 gap-2 text-[10px]">
                    <div>
                        <span class="text-slate-500">Date:</span>
                        <span class="text-slate-800 ml-1">${dateStr} at ${timeStr}</span>
                    </div>
                    <div>
                        <span class="text-slate-500">Platform:</span>
                        <span class="text-slate-800 ml-1">${platformLabel}</span>
                    </div>
                    <div>
                        <span class="text-slate-500">Instructor:</span>
                        <span class="text-slate-800 ml-1">${meeting.instructorName || 'Unknown'}</span>
                    </div>
                    <div>
                        <span class="text-slate-500">Meeting ID:</span>
                        <span class="text-slate-800 ml-1 font-mono">${meeting.meetingId || 'N/A'}</span>
                    </div>
                </div>
            </div>

            <!-- Audio Player -->
            ${meeting.audioUrl ? `
            <div class="bg-white rounded-lg p-3 border border-slate-200">
                <h5 class="text-xs font-semibold text-slate-800 mb-2">Recording</h5>
                <audio controls class="w-full">
                    <source src="${meeting.audioUrl}" type="audio/mpeg">
                    Your browser does not support the audio element.
                </audio>
            </div>
            ` : ''}

            <!-- Transcript -->
            <div class="bg-white rounded-lg p-3 border border-slate-200">
                <h5 class="text-xs font-semibold text-slate-800 mb-2">Transcript</h5>
                <div id="transcriptContainer" class="max-h-96 overflow-y-auto custom-scrollbar">
                    <div class="flex justify-center py-4">
                        <span class="text-[10px] text-slate-500">Loading transcript...</span>
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

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Close Modal Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

window.closeMeetingDetailModal = function() {
    const modal = document.getElementById('meetingDetailModal');
    modal.classList.add('hidden');
    activeMeetingId = null;
};

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Transcript Parsing & Rendering Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

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
        'emerald': 'bg-emerald-100 border-emerald-200 text-emerald-800',
        'blue': 'bg-blue-100 border-blue-200 text-blue-800',
        'indigo': 'bg-indigo-100 border-indigo-200 text-indigo-800',
        'orange': 'bg-orange-100 border-orange-200 text-orange-800',
        'fuchsia': 'bg-fuchsia-100 border-fuchsia-200 text-fuchsia-800',
    };

    let html = '';
    transcripts.forEach((t) => {
        const initials = t.speaker ? t.speaker.substring(0, 2).toUpperCase() : 'U';
        const colorStyle = colorMap[t.color] || 'bg-slate-200 border-slate-300 text-slate-800';

        html += `
            <div class="flex gap-3 transcript-item mb-3">
                <div class="w-8 h-8 shrink-0 rounded-lg ${colorStyle} border flex items-center justify-center font-bold text-[10px]">
                    ${initials}
                </div>
                <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 mb-1">
                        <span class="text-[11px] font-bold text-slate-800">${t.speaker || 'Unknown Speaker'}</span>
                        <span class="text-[9px] text-slate-500 font-mono">${t.time || '--:--'}</span>
                    </div>
                    <p class="text-slate-700 text-[11px] leading-relaxed">${t.text}</p>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}