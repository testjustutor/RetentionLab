let meetingsData = [];
let activeMeetingId = null;

document.addEventListener('DOMContentLoaded', () => {
    // initialize date inputs to today if empty so user can change them
    const fromEl = document.getElementById('fromDate');
    const toEl = document.getElementById('toDate');
    const today = getDefaultTodayISO();
    if (fromEl && !fromEl.value) fromEl.value = today;
    if (toEl && !toEl.value) toEl.value = today;

    // Debounced loader to collapse multiple quick events into one request
    function debounce(fn, wait) {
        let t = null;
        return (...args) => {
            clearTimeout(t);
            t = setTimeout(() => fn.apply(this, args), wait);
        };
    }

    const debouncedLoadMeetings = debounce(loadMeetings, 300);

    // If flatpickr available, initialize calendar pickers and wire onchange to reload (debounced)
    if (window.flatpickr) {
        try {
            flatpickr(fromEl, { dateFormat: 'Y-m-d', defaultDate: today, allowInput: false, onChange: () => debouncedLoadMeetings() });
            flatpickr(toEl, { dateFormat: 'Y-m-d', defaultDate: today, allowInput: false, onChange: () => debouncedLoadMeetings() });
        } catch (e) {
            console.warn('flatpickr init failed', e);
        }
    }

    loadMeetings();

    // Search functionality (transcripts)
    document.getElementById('searchTranscript')?.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const items = document.querySelectorAll('.transcript-item');
        items.forEach(item => {
            const text = item.querySelector('.transcript-text').textContent.toLowerCase();
            if (term === '' || text.includes(term)) {
                item.style.display = 'flex';
            } else {
                item.style.display = 'none';
            }
        });
    });

    // Search + filters (meetings list)
    document.getElementById('meetingSearch')?.addEventListener('input', () => loadMeetings());
    const fromDateEl = document.getElementById('fromDate');
    const toDateEl = document.getElementById('toDate');
    if (fromDateEl) {
        fromDateEl.addEventListener('change', () => loadMeetings());
        fromDateEl.addEventListener('input', () => loadMeetings());
    }
    if (toDateEl) {
        toDateEl.addEventListener('change', () => loadMeetings());
        toDateEl.addEventListener('input', () => loadMeetings());
    }
});

function getDefaultTodayISO() {
    return new Date().toISOString().slice(0, 10);
}

function readFilters() {
    const q = document.getElementById('meetingSearch')?.value?.trim() || '';

    // from/to are date inputs (YYYY-MM-DD)
    const fromVal = document.getElementById('fromDate')?.value?.trim();
    const toVal = document.getElementById('toDate')?.value?.trim();

    const today = getDefaultTodayISO();

    // Default date filter = today for both from and to
    const from = fromVal || today;
    const to = toVal || today;

    // Convert date-only to ISO range values
    const fromISO = new Date(from + 'T00:00:00.000Z').toISOString();
    const toISO = new Date(to + 'T23:59:59.999Z').toISOString();

    // Use a high limit to approximate 'all' within the date range
    const defaultLimit = 1000;

    return {
        q,
        from: fromISO,
        to: toISO,
        limit: defaultLimit
    };
}


async function loadMeetings() {
    const listEl = document.getElementById('meetingsList');
    const loadingEl = document.getElementById('loadingMeetings');
    const countEl = document.getElementById('meetingCount');

    if (!listEl || !loadingEl || !countEl) {
        console.error("Missing DOM elements", { listEl, loadingEl, countEl });
        return;
    }

    loadingEl.classList.remove('hidden');
    listEl.classList.add('hidden');

    const { q, from, to, limit } = readFilters();

    try {
        const body = { from, to, limit };
        if (q) body.search = q;

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
        meetingsData = data.meetings || data.data || [];
    } catch (err) {
        console.warn('Data fetch failed, injecting empty list.', err);
        meetingsData = [];
    }

    try {
        loadingEl.classList.add('hidden');
        listEl.classList.remove('hidden');
        countEl.textContent = meetingsData.length;
        renderMeetingsList();
    } catch (err) {
        console.error("Error in render process:", err);
        listEl.innerHTML = `<p style="color:red">Render Error: ${err.message}</p>`;
        loadingEl.classList.add('hidden');
        listEl.classList.remove('hidden');
    }
}

function renderMeetingsList() {
    const listEl = document.getElementById('meetingsList');

    if (meetingsData.length === 0) {
        listEl.innerHTML = `<div class="flex flex-col items-center justify-center p-6 text-center border border-dashed border-slate-800 rounded-lg opacity-60">
                <p class="text-[11px] text-slate-400 font-medium">No completed meetings found</p>
            </div>`;
        return;
    }

    let html = '';
    meetingsData.forEach((meeting) => {
        const isActive = activeMeetingId === meeting.id;
        const d = new Date(meeting.date);
        const dateStr = d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
        const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        const platformRaw = (meeting.platform || 'unknown').toLowerCase();
        let platformLabel = platformRaw, platformColors = '';

        if (platformRaw === 'zoom') { platformLabel = 'Zoom'; platformColors = 'text-blue-400 bg-blue-500/10 border-blue-500/20'; }
        else if (platformRaw === 'teams') { platformLabel = 'Teams'; platformColors = 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20'; }
        else if (platformRaw === 'google-meet' || platformRaw === 'google') { platformLabel = 'G-Meet'; platformColors = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'; }
        else { platformColors = 'text-slate-400 bg-slate-500/10 border-slate-500/20'; }

        html += `
            <div onclick="selectMeeting('${meeting.id}')" class="bg-slate-950/40 border ${isActive ? 'border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.1)]' : 'border-slate-800 hover:border-slate-700'} rounded-lg p-3 transition duration-200 cursor-pointer group">
                <div class="flex justify-between items-start mb-2">
                    <h3 class="text-[13px] font-semibold text-slate-200 group-hover:text-white leading-tight line-clamp-2 pr-2">${meeting.title || 'Untitled Session'}</h3>
                    <span class="px-1.5 py-[1px] rounded uppercase font-bold tracking-wider border ${platformColors} text-[9px] shrink-0 mt-0.5">${platformLabel}</span>
                </div>
                <div class="flex items-center justify-between text-[10px]">
                    <span class="text-slate-400 font-medium tracking-wide font-mono">${dateStr}</span>
                    <span class="bg-slate-900 border border-slate-700 px-1.5 rounded text-slate-500">${timeStr}</span>
                </div>
            </div>
        `;
    });
    listEl.innerHTML = html;
}

window.selectMeeting = async function(id) {
    activeMeetingId = id;
    renderMeetingsList();

    const meeting = meetingsData.find(m => m.id === id);
    if (!meeting) return;

    document.getElementById('emptyState').classList.add('hidden');
    const activeView = document.getElementById('activeView');
    activeView.classList.remove('hidden');
    activeView.classList.add('flex');

    const d = new Date(meeting.date);
    document.getElementById('mtgDate').textContent = `${d.toLocaleDateString()} at ${d.toLocaleTimeString()}`;
    document.getElementById('mtgTitle').textContent = meeting.title || 'Untitled Session';
    document.getElementById('mtgId').textContent = 'ID: ' + (meeting.meetingId || 'N/A');

    const pRaw = (meeting.platform || '').toLowerCase();
    const el = document.getElementById('mtgPlatform');
    el.textContent = pRaw === 'zoom' ? 'Zoom' : pRaw === 'teams' ? 'Teams' : pRaw.includes('google') ? 'G-Meet' : 'Platform';

    let pColor = '';
    if (pRaw === 'zoom') pColor = 'text-blue-400 bg-blue-500/10 border-blue-500/30';
    else if (pRaw === 'teams') pColor = 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30';
    else if (pRaw.includes('google')) pColor = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
    else pColor = 'text-slate-400 bg-slate-500/10 border-slate-500/30';
    el.className = `px-2 py-0.5 rounded text-[9px] uppercase font-bold tracking-wider border ${pColor}`;

    const audioPlayer = document.getElementById('audioPlayer');
    audioPlayer.src = meeting.audioUrl || '';

    document.getElementById('searchTranscript').value = '';

    console.log(meeting.transcripts);
    const rawText = await fetch(meeting.transcripts).then(r => r.text());
    const transcripts = parseTranscript(rawText);

    renderTranscripts(transcripts);

    // renderTranscripts(meeting.transcripts || []);
};

function getColor(speaker) {
    let hash = 0;
    for (let i = 0; i < speaker.length; i++) {
        hash += speaker.charCodeAt(i);
    }

    const colors = ['emerald', 'blue', 'indigo', 'orange', 'fuchsia'];
    return colors[hash % colors.length];
}

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

function renderTranscripts(transcripts) {
    const listEl = document.getElementById('transcriptList');

    if (transcripts.length === 0) {
        listEl.innerHTML = `
            <div class="flex flex-col items-center justify-center p-10 text-center opacity-60">
                <svg class="w-10 h-10 text-slate-500 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path></svg>
                <p class="text-xs text-slate-400 font-medium">No transcript available for this session</p>
            </div>
        `;
        return;
    }

    let html = '';

    transcripts.forEach((t) => {
        if (t.isSystem) {
            html += `
                <div class="flex gap-4 transcript-item">
                    <div class="w-10 h-10 shrink-0 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400">
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>
                    </div>
                    <div class="pt-0.5 w-full">
                        <div class="flex items-center gap-2 mb-1">
                            <span class="text-[11px] font-bold text-slate-300">System Log</span>
                            <span class="text-[10px] text-emerald-400 font-mono bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 uppercase tracking-widest">${t.time || 'SYS'}</span>
                        </div>
                        <p class="text-emerald-300/80 font-mono text-[11px] leading-relaxed p-2.5 bg-emerald-500/5 rounded-lg border border-emerald-500/10 transcript-text">${t.text}</p>
                    </div>
                </div>
            `;
        } else {
            const initials = t.speaker ? t.speaker.substring(0, 2).toUpperCase() : 'U';
            const colorMap = {
                'emerald': 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400',
                'blue': 'bg-blue-500/20 border-blue-500/30 text-blue-400',
                'indigo': 'bg-indigo-500/20 border-indigo-500/30 text-indigo-400',
                'orange': 'bg-orange-500/20 border-orange-500/30 text-orange-400',
                'fuchsia': 'bg-fuchsia-500/20 border-fuchsia-500/30 text-fuchsia-400',
            };
            const colorStyle = colorMap[t.color] || 'bg-slate-700 border-slate-600 text-white';

            html += `
                <div class="flex gap-4 transcript-item">
                    <div class="w-10 h-10 shrink-0 rounded-xl ${colorStyle} border flex items-center justify-center font-bold text-xs">
                        ${initials}
                    </div>
                    <div class="pt-1.5">
                        <div class="flex items-center gap-2 mb-1.5">
                            <span class="text-xs font-bold text-slate-200">${t.speaker || 'Unknown Speaker'}</span>
                            <span class="text-[10px] text-slate-500 font-mono tracking-wide">${t.time || '--:--'}</span>
                        </div>
                        <p class="text-slate-300 text-sm leading-relaxed transcript-text">${t.text}</p>
                    </div>
                </div>
            `;
        }
    });

    listEl.innerHTML = html;
}

