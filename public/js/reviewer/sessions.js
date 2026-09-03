/**
 * public/js/reviewer/sessions.js
 */

let currentFilter = 'all';
let sessionsData = [];
let selectedInstructorId = null;

function getPlatformIcon(platform) {
    const icons = {
        'google-meet': `<svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M22.54 6.42a2.78 2.78 0 00-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 00-1.94 2A29 29 0 001 12a29 29 0 00.46 5.58 2.78 2.78 0 001.94 2C5.12 20 12 20 12 20s6.88 0 8.6-.46a2.78 2.78 0 001.94-2A29 29 0 0023 12a29 29 0 00-.46-5.58z"/><polygon points="9.75 15.02 15.5 12 9.75 8.98" fill="#0F172A"/></svg>`,
        'zoom': `<svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/><path d="M10 8l6 4-6 4V8z" fill="#0F172A"/></svg>`,
        'teams': `<svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/></svg>`,
        'unknown': `<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>`
    };
    return icons[platform] || icons['unknown'];
}

function getStatusBadge(status) {
    const map = {
        'completed': 'bg-emerald-900/40 text-emerald-300 border-emerald-700/50',
        'in_progress': 'bg-blue-900/40 text-blue-300 border-blue-700/50',
        'active': 'bg-blue-900/40 text-blue-300 border-blue-700/50',
        'joining': 'bg-amber-900/40 text-amber-300 border-amber-700/50',
        'queued': 'bg-slate-800/60 text-slate-400 border-slate-700/50',
        'launching': 'bg-slate-800/60 text-slate-400 border-slate-700/50',
        'starting': 'bg-slate-800/60 text-slate-400 border-slate-700/50'
    };
    const label = {
        'completed': 'Completed',
        'in_progress': 'In Progress',
        'active': 'Active',
        'joining': 'Joining',
        'queued': 'Scheduled',
        'launching': 'Scheduled',
        'starting': 'Scheduled'
    };
    return {
        class: map[status] || 'bg-slate-800/60 text-slate-400 border-slate-700/50',
        label: label[status] || status
    };
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now - d;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDuration(minutes) {
    if (!minutes) return '-';
    if (minutes < 60) return `${minutes}m`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m ? `${h}h${m}m` : `${h}h`;
}

function renderSessions() {
    const tbody = document.getElementById('sessionsTableBody');
    
    let filtered = sessionsData;
    if (currentFilter !== 'all') {
        if (currentFilter === 'in_progress') {
            filtered = sessionsData.filter(s => ['in_progress', 'active', 'joining'].includes(s.meeting_status));
        } else if (currentFilter === 'scheduled') {
            filtered = sessionsData.filter(s => ['queued', 'launching', 'starting'].includes(s.meeting_status));
        } else {
            filtered = sessionsData.filter(s => s.meeting_status === currentFilter);
        }
    }

    if (!filtered.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="px-6 py-16 text-center">
                    <div class="flex flex-col items-center gap-2">
                        <svg class="w-10 h-10 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                        </svg>
                        <p class="text-slate-500 text-sm">No sessions found</p>
                        <p class="text-slate-600 text-xs">${currentFilter === 'all' ? 'No sessions available for this instructor' : `No ${currentFilter} sessions`}</p>
                    </div>
                </td>
            </tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(s => {
        const badge = getStatusBadge(s.meeting_status);
        return `
        <tr class="border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors cursor-pointer" onclick="viewSession('${s.meeting_id}')">
            <td class="px-3 py-2">
                <div class="flex items-center gap-2">
                    <div class="w-6 h-6 rounded bg-slate-800 border border-slate-700/60 flex items-center justify-center text-slate-500 flex-shrink-0">
                        ${getPlatformIcon(s.platform)}
                    </div>
                    <div class="min-w-0">
                        <p class="text-xs font-medium text-white truncate">${s.title}</p>
                        <p class="text-[10px] text-slate-500 mt-0.5">${s.participant_count || 0} participants</p>
                    </div>
                </div>
            </td>
            <td class="px-3 py-2">
                <span class="text-[10px] text-slate-400 capitalize">${s.platform.replace('-', ' ')}</span>
            </td>
            <td class="px-3 py-2">
                <span class="text-xs text-slate-400">${formatDate(s.start_time)}</span>
            </td>
            <td class="px-3 py-2">
                <span class="text-xs text-slate-400">${formatDuration(s.duration)}</span>
            </td>
            <td class="px-3 py-2">
                ${s.avg_score ? `
                <div class="flex items-center gap-1.5">
                    <div class="w-12 h-1 bg-slate-700 rounded-full overflow-hidden">
                        <div class="h-full rounded-full ${s.avg_score >= 7 ? 'bg-emerald-500' : s.avg_score >= 4 ? 'bg-amber-500' : 'bg-red-500'}" style="width: ${s.avg_score * 10}%"></div>
                    </div>
                    <span class="text-xs font-medium ${s.avg_score >= 7 ? 'text-emerald-400' : s.avg_score >= 4 ? 'text-amber-800' : 'text-red-400'}">${s.avg_score}</span>
                </div>
                ` : '<span class="text-[10px] text-slate-600">-</span>'}
            </td>
            <td class="px-3 py-2 text-right">
                <div class="flex items-center justify-end gap-0.5">
                    ${s.audio_url ? `
                    <button onclick="event.stopPropagation(); openContentModal('${s.audio_url}', 'Audio')" class="p-1 text-violet-400 hover:text-violet-300" title="Audio">
                        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M19 11V7a5 5 0 00-10 0v4M5 11v4a5 5 0 0010 0v-4"/></svg>
                    </button>` : ''}
                    ${s.transcript_url ? `
                    <button onclick="event.stopPropagation(); openContentModal('${s.transcript_url}', 'Transcript')" class="p-1 text-violet-400 hover:text-violet-300" title="Transcript">
                        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M9 12h6M9 16h6M9 8h6"/><rect x="3" y="4" width="18" height="16" rx="2"/></svg>
                    </button>` : ''}
                    ${s.diarization_url ? `
                    <button onclick="event.stopPropagation(); openContentModal('${s.diarization_url}', 'Diarization')" class="p-1 text-violet-400 hover:text-violet-300" title="Diarization">
                        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
                    </button>` : ''}
                    ${s.summary_url ? `
                    <button onclick="event.stopPropagation(); openContentModal('${s.summary_url}', 'Summary')" class="p-1 text-violet-400 hover:text-violet-300" title="Summary">
                        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h7"/></svg>
                    </button>` : ''}
                    ${s.action_items_url ? `
                    <button onclick="event.stopPropagation(); openContentModal('${s.action_items_url}', 'Actions')" class="p-1 text-violet-400 hover:text-violet-300" title="Actions">
                        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
                    </button>` : ''}
                    ${s.audit_url ? `
                    <button onclick="event.stopPropagation(); openContentModal('${s.audit_url}', 'Audit')" class="p-1 text-violet-400 hover:text-violet-300" title="Audit">
                        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    </button>` : ''}
                </div>
            </td>
        </tr>`;
    }).join('');
}

async function loadInstructors() {
    try {
        const res = await fetch('/api/reviewer-sessions/instructors', { credentials: 'include' });
        const data = await res.json();
        if (data.success && data.instructors) {
            const select = document.getElementById('instructorSelect');
            select.innerHTML = '<option value="">— Choose an instructor —</option>' + 
                data.instructors.map(i => 
                    `<option value="${i.id}">${i.first_name || ''} ${i.last_name || ''} (${i.email})</option>`
                ).join('');
        }
    } catch (err) {
        console.error('Failed to load instructors:', err);
    }
}

async function loadSessions() {
    if (!selectedInstructorId) return;
    try {
        document.getElementById('sessionsTableBody').innerHTML = `
            <tr>
                <td colspan="7" class="px-6 py-12 text-center">
                    <div class="flex flex-col items-center gap-2">
                        <svg class="w-8 h-8 text-slate-600 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                        </svg>
                        <p class="text-slate-500 text-sm">Loading sessions...</p>
                    </div>
                </td>
            </tr>`;

        const search = document.getElementById('searchInput').value.trim();
        let url = `/api/reviewer-sessions/instructor-sessions?instructor_id=${selectedInstructorId}`;
        if (currentFilter !== 'all') url += `&status=${currentFilter}`;
        if (search) url += `&search=${encodeURIComponent(search)}`;

        const res = await fetch(url, { credentials: 'include' });
        if (!res.ok) throw new Error('Failed');
        const data = await res.json();

        if (data.success && data.sessions) {
            sessionsData = data.sessions;
            renderSessions();
            document.getElementById('countTotal').textContent = data.counts.total;
            document.getElementById('countCompleted').textContent = data.counts.completed;
            document.getElementById('countInProgress').textContent = data.counts.in_progress;
            document.getElementById('countScheduled').textContent = data.counts.scheduled;
        }
    } catch (err) {
        document.getElementById('sessionsTableBody').innerHTML = `
            <tr>
                <td colspan="7" class="px-6 py-12 text-center">
                    <div class="flex flex-col items-center gap-2">
                        <svg class="w-10 h-10 text-red-500/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                            <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
                        </svg>
                        <p class="text-slate-500 text-sm">Failed to load sessions</p>
                        <button onclick="loadSessions()" class="mt-2 px-4 py-2 text-xs bg-slate-800/60 text-slate-400 border border-slate-700/60 rounded-lg hover:bg-slate-700/60">Retry</button>
                    </div>
                </td>
            </tr>`;
    }
}

function viewSession(meetingId) {
    window.location.href = `/reviewer/evaluations?meeting_id=${meetingId}`;
}

document.getElementById('instructorSelect').addEventListener('change', function() {
    selectedInstructorId = this.value;
    if (selectedInstructorId) {
        document.getElementById('filterTabsWrapper').classList.remove('hidden');
        document.getElementById('summaryCardsWrapper').classList.remove('hidden');
        document.getElementById('instructorInfo').innerHTML = `<span class="text-emerald-400">● Viewing sessions</span>`;
        currentFilter = 'all';
        document.querySelectorAll('.filter-btn').forEach(b => {
            b.classList.remove('active', 'bg-violet-600/20', 'text-violet-300', 'border-violet-500/30');
            b.classList.add('bg-slate-800/60', 'text-slate-400', 'border-slate-700/60');
        });
        document.querySelector('.filter-btn[data-status="all"]').classList.add('active', 'bg-violet-600/20', 'text-violet-300', 'border-violet-500/30');
        document.querySelector('.filter-btn[data-status="all"]').classList.remove('bg-slate-800/60', 'text-slate-400', 'border-slate-700/60');
        loadSessions();
    } else {
        document.getElementById('filterTabsWrapper').classList.add('hidden');
        document.getElementById('summaryCardsWrapper').classList.add('hidden');
        document.getElementById('instructorInfo').innerHTML = `<span>Waiting for selection...</span>`;
        document.getElementById('sessionsTableBody').innerHTML = `
            <tr>
                <td colspan="7" class="px-6 py-16 text-center">
                    <div class="flex flex-col items-center gap-3">
                        <svg class="w-12 h-12 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
                            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/>
                        </svg>
                        <p class="text-slate-500 text-sm">Select an instructor above to view their sessions</p>
                    </div>
                </td>
            </tr>`;
    }
});

document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        if (!selectedInstructorId) return;
        document.querySelectorAll('.filter-btn').forEach(b => {
            b.classList.remove('active', 'bg-violet-600/20', 'text-violet-300', 'border-violet-500/30');
            b.classList.add('bg-slate-800/60', 'text-slate-400', 'border-slate-700/60');
        });
        this.classList.add('active', 'bg-violet-600/20', 'text-violet-300', 'border-violet-500/30');
        this.classList.remove('bg-slate-800/60', 'text-slate-400', 'border-slate-700/60');
        currentFilter = this.dataset.status;
        loadSessions();
    });
});

let searchTimeout;
document.getElementById('searchInput').addEventListener('input', function() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => { if (selectedInstructorId) loadSessions(); }, 400);
});

function escapeHtml(s) {
    if (!s) return '';
    const div = document.createElement('div');
    div.textContent = String(s);
    return div.innerHTML;
}

function openContentModal(url, title) {
    const modal = document.getElementById('contentModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalContent = document.getElementById('modalContent');
    
    modalTitle.textContent = title;
    modalContent.innerHTML = '<div class="flex items-center justify-center py-12"><svg class="w-8 h-8 text-slate-600 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg></div>';
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    
    fetch(url, { credentials: 'include' })
        .then(res => {
            if (!res.ok) throw new Error('Failed to load content');
            return res.text();
        })
        .then(text => {
            if (url.endsWith('.json')) {
                try {
                    const json = JSON.parse(text);
                    modalContent.innerHTML = '<pre class="bg-slate-800/50 p-4 rounded-lg overflow-auto text-xs text-slate-300 font-mono">' + escapeHtml(JSON.stringify(json, null, 2)) + '</pre>';
                } catch {
                    modalContent.innerHTML = '<pre class="bg-slate-800/50 p-4 rounded-lg overflow-auto text-xs text-slate-300 font-mono whitespace-pre-wrap">' + escapeHtml(text) + '</pre>';
                }
            } else if (url.endsWith('.txt') || url.endsWith('.md')) {
                modalContent.innerHTML = '<div class="prose prose-invert max-w-none"><pre class="whitespace-pre-wrap font-mono text-sm text-slate-300">' + escapeHtml(text) + '</pre></div>';
            } else if (url.endsWith('.mp3') || url.endsWith('.wav')) {
                modalContent.innerHTML = '<audio controls class="w-full" src="' + url + '"></audio>';
            } else {
                modalContent.innerHTML = '<pre class="bg-slate-800/50 p-4 rounded-lg overflow-auto text-xs text-slate-300 font-mono whitespace-pre-wrap">' + escapeHtml(text) + '</pre>';
            }
        })
        .catch(err => {
            modalContent.innerHTML = '<div class="flex flex-col items-center justify-center py-12 text-red-400"><p>Failed to load content</p><p class="text-xs mt-1 text-slate-500">' + escapeHtml(err.message) + '</p></div>';
        });
}

function closeContentModal() {
    const modal = document.getElementById('contentModal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    document.getElementById('modalContent').innerHTML = '<div class="flex items-center justify-center py-12"><svg class="w-8 h-8 text-slate-600 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg></div>';
}

document.getElementById('contentModal').addEventListener('click', function(e) {
    if (e.target === this) closeContentModal();
});

document.addEventListener('DOMContentLoaded', loadInstructors);