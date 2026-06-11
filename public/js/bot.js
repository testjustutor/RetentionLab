/**
 * root/public/js/bot.js
*/
document.addEventListener('DOMContentLoaded', () => {
    loadBotData();
    // Refresh every 10 seconds for real-time updates
    setInterval(loadBotData, 10000);
});

async function loadBotData() {
    try {
        const response = await fetch('/api/bot');
        if (!response.ok) throw new Error('Fetch failed');
        const data = await response.json();
        renderBotView(data);
    } catch (err) {
        console.warn('Failed to fetch API data, using fallback.', err);
        const fallback = {
            "stats": {
                "status": "ONLINE",
                "activeBots": "3 / 50",
                "gpuCompute": "14%",
                "taskQueue": "0"
            },
            "logs": [
                { "time": "10:41:01", "type": "SYSTEM", "typeColor": "indigo", "message": "Initializing orchestrator core..." },
                { "time": "10:41:02", "type": "BOOT", "typeColor": "blue", "message": "Connecting to Redis task queue... OK." },
                { "time": "10:41:02", "type": "BOOT", "typeColor": "blue", "message": "Loading VAD audio models into memory..." },
                { "time": "10:41:05", "type": "BOOT", "typeColor": "blue", "message": "FastWhisper alignment models loaded. GPU memory: 1,024MB." },
                { "time": "10:42:15", "type": "SPAWN", "typeColor": "emerald", "message": "Dispatching Bot 'Z-Observer-89X' to Zoom meeting..." },
                { "time": "10:42:19", "type": "WARN", "typeColor": "amber", "message": "Meeting requires passcode. Injecting credentials..." },
                { "time": "10:42:25", "type": "JOIN", "typeColor": "emerald", "message": "Bot admitted to meeting. Audio transport established." },
                { "time": "10:45:10", "type": "STREAM", "typeColor": "cyan", "message": "Receiving multi-channel audio chunks..." }
            ],
            "workers": [
                {
                    "id": "Bot 89X-ZM",
                    "status": "Recording",
                    "statusColor": "emerald",
                    "isPulsing": true,
                    "platform": "Zoom",
                    "meeting": "Product Sync",
                    "duration": "04:12",
                    "action": "Terminate"
                },
                {
                    "id": "Bot 14M-GM",
                    "status": "IDLE",
                    "statusColor": "blue",
                    "isPulsing": false,
                    "platform": "Google Meet",
                    "meeting": "Standby",
                    "duration": "--:--",
                    "action": "Waiting Task"
                }
            ]
        };
        renderBotView(fallback);
    }
}

function renderBotView(data) {
    // Default fallback structure
    const defaults = {
        "stats": {
            "status": "",
            "activeBots": "3 / 50",
            "gpuCompute": "14%",
            "taskQueue": "0"
        },
        "logs": [
            { "time": "10:41:01", "type": "SYSTEM", "typeColor": "indigo", "message": "Initializing orchestrator core..." }
        ],
        "workers": [
            {
                "id": "Bot 89X-ZM",
                "status": "Recording",
                "statusColor": "emerald",
                "isPulsing": true,
                "platform": "Zoom",
                "meeting": "Product Sync",
                "duration": "04:12",
                "action": "Terminate"
            }
        ]
    };

    // Merge API data with defaults - use API value if present, otherwise default
    const mergedData = {
        stats: {
            status: (data?.stats?.status !== undefined && data.stats.status !== null) ? data.stats.status : defaults.stats.status,
            activeBots: (data?.stats?.activeBots) ? data.stats.activeBots : defaults.stats.activeBots,
            gpuCompute: (data?.stats?.gpuCompute) ? data.stats.gpuCompute : defaults.stats.gpuCompute,
            taskQueue: (data?.stats?.taskQueue !== undefined && data.stats.taskQueue !== null) ? String(data.stats.taskQueue) : defaults.stats.taskQueue
        },
        logs: (data?.logs && Array.isArray(data.logs) && data.logs.length > 0) ? data.logs : defaults.logs,
        workers: (data?.workers && Array.isArray(data.workers) && data.workers.length > 0) ? data.workers : defaults.workers
    };

    // Render Stats (KPI Cards)
    const statusText = document.getElementById('statusText');
    if (statusText) statusText.textContent = mergedData.stats.status;

    const kpiActiveBots = document.getElementById('kpiActiveBots');
    if (kpiActiveBots) kpiActiveBots.textContent = mergedData.stats.activeBots;

    const kpiGpuCompute = document.getElementById('kpiGpuCompute');
    if (kpiGpuCompute) kpiGpuCompute.textContent = mergedData.stats.gpuCompute;

    const kpiTaskQueue = document.getElementById('kpiTaskQueue');
    if (kpiTaskQueue) kpiTaskQueue.textContent = mergedData.stats.taskQueue;

    // Render Terminal
    const terminal = document.getElementById('terminal');
    if (terminal) {
        let html = '';
        mergedData.logs.forEach(log => {
            html += `<div class="flex gap-3 mb-1"><span class="text-slate-600">${log.time || '--:--'}</span><span class="text-${log.typeColor || 'slate'}-400">[${log.type || 'LOG'}]</span><span class="text-slate-300">${log.message || ''}</span></div>`;
        });
        html += `<div class="flex gap-3 text-emerald-500 animate-pulse mt-2">_</div>`;
        terminal.innerHTML = html;
        terminal.scrollTop = terminal.scrollHeight;
    }

    // Render Workers
    const workersList = document.getElementById('workersList');
    if (workersList) {
        let html = '';
        mergedData.workers.forEach(w => {
            const statusColor = w.statusColor || 'slate';
            const pulseClass = w.isPulsing ? 'animate-pulse' : '';
            const isTerminatable = w.action === 'Terminate';
            const btnClass = isTerminatable
                ? 'bg-slate-800 hover:bg-rose-500/20 hover:text-rose-400 text-slate-300 border border-slate-700 hover:border-rose-500/30'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700';

            const btnContent = isTerminatable
                ? `<svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg> ${w.action}`
                : w.action;

            html += `
                <div class="bg-slate-950/50 border border-${statusColor}-500/30 rounded-lg p-2.5">
                    <div class="flex justify-between items-start mb-2">
                        <span class="text-xs font-bold text-slate-200">${w.id || 'Bot Unknown'}</span>
                        <span class="px-1.5 py-[1px] bg-${statusColor}-500/20 text-${statusColor}-400 text-[9px] uppercase font-bold tracking-wider rounded border border-${statusColor}-500/30 ${pulseClass}">${w.status || 'UNKNOWN'}</span>
                    </div>
                    <div class="flex justify-between items-center text-[10px] text-slate-400 font-mono mb-2">
                        <span>${w.platform || 'Unknown'} • ${w.meeting || 'No Meeting'}</span>
                        <span>${w.duration || '--:--'}</span>
                    </div>
                    <button class="w-full py-1.5 rounded transition text-[10px] font-semibold flex items-center justify-center gap-1 ${btnClass}">
                        ${btnContent}
                    </button>
                </div>
            `;
        });
        workersList.innerHTML = html;
    }
}

