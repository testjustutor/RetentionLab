/**
 * Bot Controller
 * Handles bot dashboard and monitoring endpoints
 */

const os = require('os');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { db } = require('../../database/db');
const BotModel = require('../../models/bot/BotModel');
const MeetingModel = require('../../models/meetings/MeetingModel');
const botManager = require('../../services/shared/botManager');
const { logger } = require('../../utils/logger');

// ─── Network I/O tracking ─────────────────────────────────────────────────────
let _prevNetStats = null;
let _prevNetTime = Date.now();

class BotController {
  /**
   * Get all bot instances stats
   */
  static async getInstances(req, res) {
    try {
      const stats = botManager.getStats();
      res.json(stats);
    } catch (err) {
      logger.error('Controller(Bot): Bot instances error:', err);
      res.status(500).json({ error: err.message });
    }
  }

  /**
   * Start a bot manually
   */
  static async startBot(req, res) {
    try {
      const { platform, meetingId, passcode, webhookUrl, meetingUrl } = req.body;
      if (!meetingId || !platform) {
        return res.status(400).json({ error: 'meetingId and platform required' });
      }
      
      const result = await botManager.startBot(platform, meetingId, passcode, webhookUrl, meetingUrl);
      logger.info(`Controller(Bot): Immediate launch: ${meetingId} → ${result.success ? 'OK' : 'FAILED'}`);
      
      if (result && !result.success) {
        await MeetingModel.updateMeetingStatus(meetingId, 'failed');
      }
      
      res.json(result);
    } catch (err) {
      logger.error('Controller(Bot): Immediate start-bot error:', err);
      res.status(500).json({ error: err.message });
    }
  }

  /**
   * Get bot status by meeting ID
   */
  static async getStatus(req, res) {
    try {
      const status = botManager.getStatus(req.params.meetingId);
      res.json(status);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  /**
   * Stop a bot
   */
  static async stopBot(req, res) {
    try {
      const result = await botManager.stopBot(req.params.meetingId);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  /**
   * Get queued meetings
   */
  static async getQueued(req, res) {
    try {
      const queued = await MeetingModel.getQueuedMeetings();
      res.json(queued || []);
    } catch (err) {
      logger.error('Controller(Bot): Queued list error:', err);
      res.status(500).json({ error: err.message });
    }
  }

  /**
   * Get bot dashboard data with system metrics
   */
  static async getBotDashboard(req, res) {
    try {
      const stats = await BotModel.getStats();
      const activeCount = stats.activeCount || 0;
      const maxConcurrent = stats.maxConcurrent || 50;
      const totalInstances = stats.totalInstances || 0;

      const workers = [];
      const instances = stats.instances || [];
      for (const instance of instances) {
        const statusMap = {
          'running': { display: 'Recording', color: 'emerald', pulse: true },
          'live': { display: 'Live', color: 'emerald', pulse: true },
          'joining': { display: 'Joining', color: 'blue', pulse: true },
          'starting': { display: 'Starting', color: 'blue', pulse: true },
          'idle': { display: 'IDLE', color: 'slate', pulse: false },
          'error': { display: 'Error', color: 'rose', pulse: false },
          'stopped': { display: 'Stopped', color: 'slate', pulse: false }
        };
        const statusInfo = statusMap[instance.status] || { display: 'Unknown', color: 'slate', pulse: false };

        workers.push({
          id: `Bot ${instance.meetingId.substring(0, 8).toUpperCase()}`,
          status: statusInfo.display,
          statusColor: statusInfo.color,
          isPulsing: statusInfo.pulse,
          platform: instance.platform || 'Unknown',
          meeting: instance.meetingTitle || 'Meeting',
          duration: instance.duration || '--:--',
          action: instance.status === 'running' || instance.status === 'live' ? 'Terminate' : 'Waiting Task'
        });
      }

      const systemMetrics = await BotController.getSystemMetrics();

      res.json({
        stats: {
          status: activeCount > 0 ? 'ONLINE' : 'IDLE',
          activeBots: `${activeCount} / ${maxConcurrent}`,
          cpuUsage: systemMetrics.cpuUsage,
          memoryUsage: systemMetrics.memoryPercent
        },
        system: systemMetrics
      });
    } catch (err) {
      logger.error('Controller(Bot): Error fetching bot dashboard data:', err);
      res.status(500).json({ status: 'error', message: err.message });
    }
  }

  static async getSystemMetrics() {
    try {
      const cpuCount = os.cpus().length;
      const cpuPercent = BotController.getRealCpuPercent();
      const cpuUsagePercent = Math.min(cpuPercent, 100).toFixed(1);
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedMem = totalMem - freeMem;
      const memUsagePercent = ((usedMem / totalMem) * 100).toFixed(1);
      const processMem = process.memoryUsage();
      const heapUsed = (processMem.heapUsed / (1024 * 1024 * 1024)).toFixed(2);
      const rss = (processMem.rss / (1024 * 1024 * 1024)).toFixed(2);
      const diskInfo = BotController.getRealDiskUsage();
      const dbStats = await BotController.getDatabaseStats();
      const networkStats = BotController.getLiveNetworkSpeed();
      const appStorageGB = await BotController.getStorageSize();

      return {
        cpuCores: cpuCount,
        cpuUsage: cpuUsagePercent + '%',
        cpuUsageRaw: parseFloat(cpuUsagePercent),
        cpuLoad1min: cpuUsagePercent,
        cpuLoad5min: cpuUsagePercent,
        cpuLoad15min: cpuUsagePercent,
        memoryPercent: memUsagePercent + '%',
        memoryPercentRaw: parseFloat(memUsagePercent),
        memoryUsed: (usedMem / (1024 * 1024 * 1024)).toFixed(2) + ' GB',
        memoryUsedRaw: parseFloat((usedMem / (1024 * 1024 * 1024)).toFixed(2)),
        memoryTotal: (totalMem / (1024 * 1024 * 1024)).toFixed(2) + ' GB',
        memoryTotalRaw: parseFloat((totalMem / (1024 * 1024 * 1024)).toFixed(2)),
        heapUsed: heapUsed + ' GB',
        rss: rss + ' GB',
        storageUsed: diskInfo.usedFormatted,
        storageUsedRaw: diskInfo.usedGB,
        storageTotal: diskInfo.totalFormatted,
        storageTotalRaw: diskInfo.totalGB,
        storagePercent: diskInfo.percentFormatted,
        storagePercentRaw: diskInfo.percent,
        appStorage: appStorageGB + ' GB',
        dbSize: dbStats.size,
        dbSizeRaw: dbStats.sizeBytes,
        dbConnections: dbStats.connections,
        uptime: BotController.formatUptime(os.uptime()),
        nodeVersion: process.version,
        platform: os.platform(),
        hostname: os.hostname(),
        networkIO: networkStats
      };
    } catch (err) {
      logger.error('Controller(Bot): Error getting system metrics:', err);
      return BotController.getDefaultMetrics();
    }
  }

  static getRealCpuPercent() {
    try {
      if (os.platform() === 'win32') {
        try {
          const out = execSync('wmic cpu get loadpercentage', { encoding: 'utf8', shell: 'cmd.exe', timeout: 5000 });
          const lines = out.trim().split('\n').filter(l => l.trim());
          if (lines.length >= 2) {
            const val = parseFloat(lines[1].trim());
            if (!isNaN(val)) return val;
          }
        } catch (e) {}
      } else {
        const load = os.loadavg();
        const cpus = os.cpus().length;
        if (load[0] > 0) {
          return Math.min((load[0] / cpus) * 100, 100);
        }
      }
      return BotController.calculateCpuFromTicks();
    } catch (e) {
      return BotController.calculateCpuFromTicks();
    }
  }

  static calculateCpuFromTicks() {
    try {
      const cpus = os.cpus();
      let totalIdle = 0, totalTick = 0;
      for (const cpu of cpus) {
        for (const type in cpu.times) { totalTick += cpu.times[type]; }
        totalIdle += cpu.times.idle;
      }
      const idle = totalIdle / cpus.length;
      const total = totalTick / cpus.length;
      return parseFloat((100 - (idle / total) * 100).toFixed(1));
    } catch (e) { return 0; }
  }

  static getRealDiskUsage() {
    try {
      if (os.platform() === 'win32') {
        const out = execSync('wmic logicaldisk where drivetype=3 get caption,freespace,size', { encoding: 'utf8', shell: 'cmd.exe', timeout: 5000 });
        const lines = out.trim().split('\n').filter(l => l.trim());
        let totalGB = 0, freeGB = 0;
        for (let i = 1; i < lines.length; i++) {
          const parts = lines[i].trim().split(/\s{2,}/);
          if (parts.length >= 3) {
            const free = parseFloat(parts[1].trim()) || 0;
            const total = parseFloat(parts[2].trim()) || 0;
            totalGB += total / (1024 * 1024 * 1024);
            freeGB += free / (1024 * 1024 * 1024);
          }
        }
        const usedGB = totalGB - freeGB;
        const percent = totalGB > 0 ? (usedGB / totalGB) * 100 : 0;
        return { usedGB: parseFloat(usedGB.toFixed(2)), totalGB: parseFloat(totalGB.toFixed(2)), percent: parseFloat(percent.toFixed(1)), usedFormatted: usedGB.toFixed(2) + ' GB', totalFormatted: totalGB.toFixed(2) + ' GB', percentFormatted: percent.toFixed(1) + '%' };
      } else {
        const out = execSync('df -B1 / | tail -1', { encoding: 'utf8', timeout: 5000 });
        const parts = out.trim().split(/\s+/);
        if (parts.length >= 4) {
          const total = parseFloat(parts[1]) / (1024 * 1024 * 1024);
          const used = parseFloat(parts[2]) / (1024 * 1024 * 1024);
          const percent = total > 0 ? (used / total) * 100 : 0;
          return { usedGB: parseFloat(used.toFixed(2)), totalGB: parseFloat(total.toFixed(2)), percent: parseFloat(percent.toFixed(1)), usedFormatted: used.toFixed(2) + ' GB', totalFormatted: total.toFixed(2) + ' GB', percentFormatted: percent.toFixed(1) + '%' };
        }
      }
    } catch (e) { logger.warn('Disk usage query failed:', e.message); }
    return { usedGB: 0, totalGB: 100, percent: 0, usedFormatted: '0 GB', totalFormatted: '100 GB', percentFormatted: '0%' };
  }

  static getLiveNetworkSpeed() {
    try {
      const now = Date.now();
      const elapsed = (now - _prevNetTime) / 1000;
      let rxBytes = 0, txBytes = 0;
      if (os.platform() === 'win32') {
        try {
          const out = execSync('netstat -e', { encoding: 'utf8', shell: 'cmd.exe', timeout: 5000 });
          const lines = out.trim().split('\n');
          for (const line of lines) {
            const match = line.match(/Bytes\s+(\d+)\s+(\d+)/);
            if (match) { rxBytes = parseInt(match[1]) || 0; txBytes = parseInt(match[2]) || 0; break; }
          }
        } catch (e) {}
      } else {
        try {
          const out = fs.readFileSync('/proc/net/dev', 'utf8');
          const lines = out.split('\n');
          for (const line of lines) {
            if (line.includes('eth0') || line.includes('ens') || line.includes('wlan')) {
              const parts = line.trim().split(/\s+/);
              if (parts.length >= 10) { rxBytes = parseInt(parts[1]) || 0; txBytes = parseInt(parts[9]) || 0; }
            }
          }
        } catch (e) {}
      }
      let downloadSpeed = 0, uploadSpeed = 0;
      if (_prevNetStats && elapsed > 0.5) {
        const rxDelta = Math.max(0, rxBytes - _prevNetStats.rxBytes);
        const txDelta = Math.max(0, txBytes - _prevNetStats.txBytes);
        downloadSpeed = rxDelta / elapsed;
        uploadSpeed = txDelta / elapsed;
      }
      _prevNetStats = { rxBytes, txBytes };
      _prevNetTime = now;
      return { bytesReceived: (rxBytes / (1024 * 1024)).toFixed(2) + ' MB', bytesSent: (txBytes / (1024 * 1024)).toFixed(2) + ' MB', downloadSpeed, downloadSpeedFormatted: BotController.formatSpeed(downloadSpeed), uploadSpeed, uploadSpeedFormatted: BotController.formatSpeed(uploadSpeed) };
    } catch (err) {
      return { bytesReceived: '0 MB', bytesSent: '0 MB', downloadSpeed: 0, downloadSpeedFormatted: '0 B/s', uploadSpeed: 0, uploadSpeedFormatted: '0 B/s' };
    }
  }

  static formatSpeed(bytesPerSec) {
    if (bytesPerSec >= 1024 * 1024) return (bytesPerSec / (1024 * 1024)).toFixed(2) + ' MB/s';
    if (bytesPerSec >= 1024) return (bytesPerSec / 1024).toFixed(2) + ' KB/s';
    return bytesPerSec.toFixed(0) + ' B/s';
  }

  static async getStorageSize() {
    let totalSize = 0;
    try {
      const storageDir = path.join(__dirname, '..', '..', 'storage');
      if (fs.existsSync(storageDir)) {
        const scanDir = (dir) => {
          const files = fs.readdirSync(dir);
          for (const file of files) {
            const fullPath = path.join(dir, file);
            const stat = fs.statSync(fullPath);
            if (stat.isFile()) { totalSize += stat.size; } else if (stat.isDirectory()) { scanDir(fullPath); }
          }
        };
        scanDir(storageDir);
      }
    } catch (err) { logger.warn('Storage scan failed:', err.message); }
    return (totalSize / (1024 * 1024 * 1024)).toFixed(2);
  }

  static async getDatabaseStats() {
    try {
      const result = await new Promise((resolve, reject) => {
        db.get("SELECT table_schema AS db_name, SUM(data_length + index_length) AS size FROM information_schema.tables WHERE table_schema = DATABASE()", (err, row) => err ? reject(err) : resolve(row));
      });
      const sizeBytes = result?.size || 0;
      const size = (sizeBytes / (1024 * 1024)).toFixed(2) + ' MB';
      let connections = 0;
      try {
        const connResult = await new Promise((resolve, reject) => {
          db.get("SHOW STATUS LIKE 'Threads_connected'", (err, row) => err ? reject(err) : resolve(row));
        });
        connections = parseInt(connResult?.Value) || 0;
      } catch (err) { connections = 0; }
      return { size, sizeBytes, connections };
    } catch (err) { return { size: '0 MB', sizeBytes: 0, connections: 0 }; }
  }

  static formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
    return `${minutes}m ${secs}s`;
  }

  static getDefaultMetrics() {
    return {
      cpuCores: 0, cpuUsage: '0%', cpuUsageRaw: 0, cpuLoad1min: '0', cpuLoad5min: '0', cpuLoad15min: '0',
      memoryPercent: '0%', memoryPercentRaw: 0, memoryUsed: '0 GB', memoryUsedRaw: 0, memoryTotal: '0 GB', memoryTotalRaw: 0,
      heapUsed: '0 GB', rss: '0 GB',
      storageUsed: '0 GB', storageUsedRaw: 0, storageTotal: '0 GB', storageTotalRaw: 0, storagePercent: '0%', storagePercentRaw: 0,
      appStorage: '0 GB', dbSize: '0 MB', dbSizeRaw: 0, dbConnections: 0,
      uptime: '0m', nodeVersion: process.version, platform: os.platform(), hostname: os.hostname(),
      networkIO: { bytesReceived: '0 MB', bytesSent: '0 MB', downloadSpeed: 0, downloadSpeedFormatted: '0 B/s', uploadSpeed: 0, uploadSpeedFormatted: '0 B/s' }
    };
  }
}

module.exports = BotController;