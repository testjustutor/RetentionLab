/**
 * root/public/js/assets.bundle.js
*/
document.addEventListener('DOMContentLoaded', () => {
    // Select first folder by default
    const firstBtn = document.querySelector('.sidebar-btn');
    if (firstBtn) {
        setActiveFolder(firstBtn);
    }

    // Attach click events to all sidebar buttons
    document.querySelectorAll('.sidebar-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            setActiveFolder(e.currentTarget);
        });
    });

    // Delegate clicks on asset items to open viewer
    const grid = document.getElementById('assetsGrid');
    if (grid) {
        grid.addEventListener('click', (e) => {
            const item = e.target.closest('.asset-item');
            if (!item) return;

            const name = item.dataset.name;
            const folder = item.dataset.folder;
            const ext = item.dataset.ext || '';

            openFileViewer(folder, name, ext);
        });
    }

    // Close viewer when clicking backdrop or close button
    const viewer = document.getElementById('assetsViewer');
    if (viewer) {
        viewer.addEventListener('click', (e) => {
            if (e.target.id === 'assetsViewer' || e.target.id === 'assetsViewerClose') {
                closeFileViewer();
            }
        });
    }
});

function setActiveFolder(btnElement) {
    // Reset all buttons to inactive state
    document.querySelectorAll('.sidebar-btn').forEach(b => {
        b.className = "sidebar-btn w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-800 text-slate-400 text-xs font-medium transition cursor-pointer";
        const iconContainer = b.querySelector('svg');
        if (iconContainer) iconContainer.className.baseVal = "w-4 h-4 text-slate-500 shrink-0";
    });

    // Set active specific classes
    btnElement.className = "sidebar-btn w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-600/10 text-violet-300 border border-violet-500/20 text-xs font-medium";
    const icon = btnElement.querySelector('svg');
    if (icon) icon.className.baseVal = "w-4 h-4 text-violet-400 shrink-0";

    const folderName = btnElement.getAttribute('data-folder');
    loadAssetsData(folderName);
}

async function loadAssetsData(folderName) {
    const grid = document.getElementById('assetsGrid');
    if (!grid) return;
    
    // Set loading state
    grid.innerHTML = '<div class="col-span-full py-8 text-center text-slate-500 text-sm">Loading assets...</div>';

    try {
        // Attempt to fetch from real API backend
        const apiUrl = '/api/assets/folder/' + folderName;
        console.debug(`[Assets] Fetching ${apiUrl}`);

        const response = await fetch(apiUrl);

        if (!response.ok) {
            const bodyText = await response.text();
            throw new Error(`API request failed: ${response.status} ${response.statusText} - ${bodyText}`);
        }

        const data = await response.json();
        let files = Array.isArray(data.files) ? data.files : [];

        renderAssets(files, folderName);
    } catch (err) {
        console.error('Failed to load from API.', err);
        const grid = document.getElementById('assetsGrid');
        grid.innerHTML = `
          <div class="col-span-full py-8 text-center text-red-400 text-sm">
            Failed to load directory contents.<br>
            <span class="text-xs text-red-300">${err.message}</span>
          </div>
        `;
    }
}

function renderAssets(files, folderName) {
    const grid = document.getElementById('assetsGrid');
    
    // Update header to reflect current folder and counts
    const headerTitleSpan = document.getElementById('assetsHeaderPath');
    if (headerTitleSpan) {
        headerTitleSpan.textContent = `/storage/${folderName} (${files.length} items)`;
    }

    if (!files || files.length === 0) {
        grid.innerHTML = '<div class="col-span-full py-8 text-center text-slate-500 text-sm">No files in this directory.</div>';
        return;
    }

    let html = '';
    
    files.forEach(file => {
        let iconHtml = '';
        let iconColorClass = 'text-slate-600 group-hover:text-violet-400';
        let bgColorClass = 'group-hover:opacity-100 bg-violet-500/5';
        let frameClass = 'group-hover:border-violet-500/30';
        let activeBorder = 'hover:border-violet-500/40 hover:bg-violet-900/10';

        const ext = (file.ext || '').toLowerCase();

        if (ext === '.mp3') {
            // Audio mp3 icon
            iconHtml = '<svg class="w-8 h-8 transition mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z"></path></svg>';
            iconColorClass = 'text-blue-500/70 group-hover:text-blue-400';
            bgColorClass = 'bg-blue-500/5 group-hover:opacity-100';
            frameClass = 'group-hover:border-blue-500/30';
            activeBorder = 'hover:border-blue-500/40 hover:bg-blue-900/10';
        } else if (ext === '.wav') {
            // Waveform icon
            iconHtml = '<svg class="w-8 h-8 transition mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M3 13h2l2 3 2-6 2 4 2-8 2 6 2-3 2 7h2"></path></svg>';
            iconColorClass = 'text-cyan-500/70 group-hover:text-cyan-400';
            bgColorClass = 'bg-cyan-500/5 group-hover:opacity-100';
            frameClass = 'group-hover:border-cyan-500/30';
            activeBorder = 'hover:border-cyan-500/40 hover:bg-cyan-900/10';
        } else if (ext === '.json') {
            // Code/JSON icon
            iconHtml = '<svg class="w-8 h-8 transition mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5"></path></svg>';
            iconColorClass = 'text-amber-500/70 group-hover:text-amber-400';
            bgColorClass = 'bg-amber-500/5 group-hover:opacity-100';
            frameClass = 'group-hover:border-amber-500/30';
            activeBorder = 'hover:border-amber-500/40 hover:bg-amber-900/10';
        } else {
            // Text/Document icon
            iconHtml = '<svg class="w-8 h-8 transition mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"></path></svg>';
            iconColorClass = 'text-emerald-500/70 group-hover:text-emerald-400';
            bgColorClass = 'bg-emerald-500/5 group-hover:opacity-100';
            frameClass = 'group-hover:border-emerald-500/30';
            activeBorder = 'hover:border-emerald-500/40 hover:bg-emerald-900/10';
        }

        html += `
            <div class="bg-slate-950/40 rounded-xl border border-slate-800 p-3 ${activeBorder} transition cursor-pointer group flex flex-col asset-item" data-name="${escapeHtml(file.name)}" data-folder="${escapeHtml(folderName)}" data-ext="${escapeHtml(file.ext || '')}">
                <div class="w-full aspect-video bg-slate-900 rounded-lg border border-slate-800 flex flex-col items-center justify-center mb-3 ${frameClass} transition relative overflow-hidden">
                    <div class="absolute inset-0 opacity-0 transition ${bgColorClass}"></div>
                    <div class="${iconColorClass}">
                        ${iconHtml}
                    </div>
                    <span class="font-mono text-[9px] px-2 py-0.5 rounded bg-slate-950 text-slate-500 border border-slate-800">${file.ext}</span>
                </div>
                <div class="flex justify-between items-start mb-1 h-8">
                    <span class="text-[11px] font-semibold text-slate-300 leading-tight line-clamp-2" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</span>
                </div>
                <div class="flex justify-between items-center mt-auto pt-2 border-t border-slate-800/60">
                    <span class="text-[9px] text-slate-500 font-mono">${escapeHtml(file.size)}</span>
                    <span class="text-[9px] text-slate-500 truncate ml-1">${escapeHtml(file.type)}</span>
                </div>
            </div>
        `;
    });
    
    grid.innerHTML = html;
}

function openFileViewer(folderName, fileName, ext) {
    const viewer = document.getElementById('assetsViewer');
    if (!viewer) return;

    const inner = document.getElementById('assetsViewerContent');
    if (!inner) return;

    // Reset content
    inner.innerHTML = '<div class="p-4 text-sm text-slate-400">Loading...</div>';
    viewer.classList.remove('hidden');

    const url = `/api/assets/folder/${encodeURIComponent(folderName)}/file/${encodeURIComponent(fileName)}`;

    // Audio files - use direct streaming
    const lower = (ext || '').toLowerCase();
    if (lower === '.mp3' || lower === '.wav' || lower === '.m4a' || lower === '.ogg') {
        inner.innerHTML = `
            <div class="p-4">
                <div class="mb-3 text-sm text-slate-300">${escapeHtml(fileName)}</div>
                <audio controls style="width:100%" src="${url}"></audio>
            </div>
        `;
        return;
    }

    // For text/json - fetch content from API
    fetch(url)
        .then(r => {
            if (!r.ok) throw new Error(`Fetch failed: ${r.status} ${r.statusText}`);
            return r.json();
        })
        .then(payload => {
            const content = payload.content || '';
            const mime = payload.mime || '';

            if (mime.includes('application/json') || (ext || '').toLowerCase() === '.json') {
                try {
                    const parsed = JSON.parse(content);
                    inner.innerHTML = `<pre class=\"p-4 text-sm text-slate-200 overflow-auto\">${escapeHtml(JSON.stringify(parsed, null, 2))}</pre>`;
                } catch (e) {
                    inner.innerHTML = `<pre class=\"p-4 text-sm text-slate-200 overflow-auto\">${escapeHtml(content)}</pre>`;
                }
                return;
            }

            // default text
            inner.innerHTML = `<pre class=\"p-4 text-sm text-slate-200 overflow-auto\">${escapeHtml(content)}</pre>`;
        })
        .catch(err => {
            inner.innerHTML = `<div class=\"p-4 text-sm text-red-400\">Failed to load file: ${escapeHtml(err.message)}</div>`;
        });
}

function closeFileViewer() {
    const viewer = document.getElementById('assetsViewer');
    if (viewer) viewer.classList.add('hidden');
}

// Basic escaping to avoid HTML injection when rendering file names
function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>\\"']/g, function (s) {
        return ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        })[s];
    });
}
