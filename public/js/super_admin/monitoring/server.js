/**
 * public/js/super_admin/monitoring/server.js
 */

const MAX_DATA_POINTS = 30; // Keep last 30 data points
let cpuHistory = [];
let memHistory = [];
let downloadHistory = [];
let uploadHistory = [];
let chartLabels = [];

// ─── Canvas References ────────────────────────────────────────────────────────
let cpuMemCtx = null;
let networkCtx = null;
let cpuMemCanvas = null;
let networkCanvas = null;

document.addEventListener('DOMContentLoaded', () => {
    // Initialize canvases
    cpuMemCanvas = document.getElementById('cpuMemChart');
    networkCanvas = document.getElementById('networkChart');
    
    if (cpuMemCanvas) {
        cpuMemCtx = cpuMemCanvas.getContext('2d');
        resizeCanvas(cpuMemCanvas);
    }
    if (networkCanvas) {
        networkCtx = networkCanvas.getContext('2d');
        resizeCanvas(networkCanvas);
    }
    
    // Handle window resize
    window.addEventListener('resize', () => {
        resizeCanvas(cpuMemCanvas);
        resizeCanvas(networkCanvas);
        drawCpuMemChart();
        drawNetworkChart();
    });

    loadServerData();
    // Refresh every 3 seconds for smooth real-time updates
    setInterval(loadServerData, 3000);
});

function resizeCanvas(canvas) {
    if (!canvas) return;
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width || 300;
    canvas.height = rect.height || 128;
}

async function loadServerData() {
    try {
        const response = await fetch('/api/monitoring/server');
        if (!response.ok) throw new Error('Fetch failed');
        const data = await response.json();
        renderServerView(data);
    } catch (err) {
        console.warn('Failed to fetch API data, using fallback.', err);
        const fallback = {
            stats: {
                status: "ONLINE",
                activeBots: "0 / 50",
                cpuUsage: "0%",
                memoryUsage: "0%"
            },
            system: {
                nodeVersion: "v20.10.0",
                uptime: "0m",
                cpuCores: 0,
                cpuUsage: "0%",
                cpuUsageRaw: 0,
                cpuLoad1min: "0",
                cpuLoad5min: "0",
                cpuLoad15min: "0",
                memoryPercent: "0%",
                memoryPercentRaw: 0,
                memoryUsed: "0 GB",
                memoryTotal: "0 GB",
                heapUsed: "0 GB",
                rss: "0 GB",
                storageUsed: "0 GB",
                storageUsedRaw: 0,
                storageTotal: "0 GB",
                storageTotalRaw: 0,
                storagePercent: "0%",
                storagePercentRaw: 0,
                appStorage: "0 GB",
                dbSize: "0 MB",
                dbConnections: 0,
                platform: "win32",
                hostname: "localhost",
                networkIO: { 
                    bytesReceived: "0 MB", bytesSent: "0 MB",
                    downloadSpeed: 0, downloadSpeedFormatted: "0 B/s",
                    uploadSpeed: 0, uploadSpeedFormatted: "0 B/s"
                }
            }
        };
        renderServerView(fallback);
    }
}

function renderServerView(data) {
    const sys = data.system || {};
    const stats = data.stats || {};

    // ─── Update Chart Data ──────────────────────────────────────────────
    const now = new Date();
    const timeLabel = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    
    chartLabels.push(timeLabel);
    cpuHistory.push(sys.cpuUsageRaw || 0);
    memHistory.push(sys.memoryPercentRaw || 0);
    downloadHistory.push(sys.networkIO ? (sys.networkIO.downloadSpeed || 0) : 0);
    uploadHistory.push(sys.networkIO ? (sys.networkIO.uploadSpeed || 0) : 0);
    
    // Keep only last N points
    if (chartLabels.length > MAX_DATA_POINTS) {
        chartLabels.shift();
        cpuHistory.shift();
        memHistory.shift();
        downloadHistory.shift();
        uploadHistory.shift();
    }

    // ─── KPI Cards ──────────────────────────────────────────────────────
    const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    
    setText('statusText', stats.status || 'ONLINE');
    setText('kpiCpuUsage', sys.cpuUsage || '0%');
    setText('kpiMemoryUsage', sys.memoryPercent || '0%');
    setText('kpiDiskUsage', sys.storagePercent || '0%');
    setText('kpiActiveBots', stats.activeBots || '0 / 50');

    // ─── System Info ────────────────────────────────────────────────────
    setText('nodeVersion', sys.nodeVersion || '--');
    setText('platform', sys.platform || '--');
    setText('hostname', sys.hostname || '--');
    setText('serverUptime', sys.uptime || '--');
    setText('cpuCores', (sys.cpuCores || 0) + ' cores');

    // ─── CPU & Memory Bars ──────────────────────────────────────────────
    setText('cpuUsage', sys.cpuUsage || '0%');
    const cpuBar = document.getElementById('cpuUsageBar');
    if (cpuBar) cpuBar.style.width = sys.cpuUsage || '0%';

    setText('memoryUsage', sys.memoryPercent || '0%');
    const memBar = document.getElementById('memoryUsageBar');
    if (memBar) memBar.style.width = sys.memoryPercent || '0%';
    setText('memoryUsed', 'Used: ' + (sys.memoryUsed || '0 GB'));
    setText('memoryTotal', 'Total: ' + (sys.memoryTotal || '0 GB'));

    // ─── Process Memory ─────────────────────────────────────────────────
    setText('heapUsed', sys.heapUsed || '0 GB');
    setText('rss', sys.rss || '0 GB');
    setText('appStorage', sys.appStorage || '0 GB');

    // ─── Storage & Database ─────────────────────────────────────────────
    setText('storageUsage', sys.storagePercent || '0%');
    const storageBar = document.getElementById('storageUsageBar');
    if (storageBar) storageBar.style.width = sys.storagePercent || '0%';
    setText('storageUsed', 'Used: ' + (sys.storageUsed || '0 GB'));
    setText('storageTotal', 'Total: ' + (sys.storageTotal || '0 GB'));
    setText('dbSize', sys.dbSize || '0 MB');
    setText('dbConnections', sys.dbConnections || 0);

    // ─── Network Speed ──────────────────────────────────────────────────
    if (sys.networkIO) {
        const net = sys.networkIO;
        setText('downloadSpeed', net.downloadSpeedFormatted || '0 B/s');
        setText('uploadSpeed', net.uploadSpeedFormatted || '0 B/s');
        setText('bytesReceived', net.bytesReceived || '0 MB');
        setText('bytesSent', net.bytesSent || '0 MB');
        
        // Network speed bars (relative to 10 MB/s max for visual)
        const maxSpeed = 10 * 1024 * 1024; // 10 MB/s as reference
        const dlPercent = Math.min((net.downloadSpeed / maxSpeed) * 100, 100);
        const ulPercent = Math.min((net.uploadSpeed / maxSpeed) * 100, 100);
        
        const dlBar = document.getElementById('downloadSpeedBar');
        if (dlBar) dlBar.style.width = dlPercent + '%';
        const ulBar = document.getElementById('uploadSpeedBar');
        if (ulBar) ulBar.style.width = ulPercent + '%';
    }

    // ─── System Load ────────────────────────────────────────────────────
    setText('load1min', sys.cpuUsage || '0%');

    // ─── Draw Charts ────────────────────────────────────────────────────
    drawCpuMemChart();
    drawNetworkChart();
}

// ─── Canvas Drawing Functions ─────────────────────────────────────────────────

function drawCpuMemChart() {
    if (!cpuMemCtx || !cpuMemCanvas) return;
    const ctx = cpuMemCtx;
    const w = cpuMemCanvas.width;
    const h = cpuMemCanvas.height;
    
    ctx.clearRect(0, 0, w, h);
    
    if (cpuHistory.length < 2) return;
    
    const padding = { top: 8, bottom: 16, left: 8, right: 8 };
    const chartW = w - padding.left - padding.right;
    const chartH = h - padding.top - padding.bottom;
    
    // Draw grid lines
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.1)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
        const y = padding.top + (chartH / 4) * i;
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(w - padding.right, y);
        ctx.stroke();
        
        // Y-axis labels
        ctx.fillStyle = 'rgba(148, 163, 184, 0.5)';
        ctx.font = '8px monospace';
        ctx.textAlign = 'right';
        ctx.fillText((100 - (i * 25)) + '%', padding.left - 2, y + 3);
    }
    
    // Draw CPU line
    drawLine(ctx, cpuHistory, padding, chartW, chartH, '#22d3ee', 1.5);
    
    // Draw Memory line
    drawLine(ctx, memHistory, padding, chartW, chartH, '#a78bfa', 1.5);
}

function drawNetworkChart() {
    if (!networkCtx || !networkCanvas) return;
    const ctx = networkCtx;
    const w = networkCanvas.width;
    const h = networkCanvas.height;
    
    ctx.clearRect(0, 0, w, h);
    
    if (downloadHistory.length < 2) return;
    
    const padding = { top: 8, bottom: 16, left: 8, right: 8 };
    const chartW = w - padding.left - padding.right;
    const chartH = h - padding.top - padding.bottom;
    
    // Draw grid lines
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.1)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
        const y = padding.top + (chartH / 4) * i;
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(w - padding.right, y);
        ctx.stroke();
    }
    
    // Find max value for scaling
    const allValues = [...downloadHistory, ...uploadHistory];
    const maxVal = Math.max(...allValues, 1);
    
    // Draw Download line
    drawLine(ctx, downloadHistory, padding, chartW, chartH, '#34d399', 1.5, maxVal);
    
    // Draw Upload line
    drawLine(ctx, uploadHistory, padding, chartW, chartH, '#f59e0b', 1.5, maxVal);
}

function drawLine(ctx, data, padding, chartW, chartH, color, lineWidth, maxVal) {
    if (data.length < 2) return;
    
    const max = maxVal || 100;
    const stepX = chartW / (data.length - 1);
    
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    
    data.forEach((val, i) => {
        const x = padding.left + i * stepX;
        const y = padding.top + chartH - (Math.min(val, max) / max) * chartH;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    
    ctx.stroke();
    
    // Draw fill under the line
    const lastIdx = data.length - 1;
    ctx.lineTo(padding.left + lastIdx * stepX, padding.top + chartH);
    ctx.lineTo(padding.left, padding.top + chartH);
    ctx.closePath();
    
    // Convert hex color to rgba for gradient fill
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    
    const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartH);
    gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.15)`);
    gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0.02)`);
    ctx.fillStyle = gradient;
    ctx.fill();
}