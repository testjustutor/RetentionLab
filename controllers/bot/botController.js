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
const { logger } = require('../../utils/logger');

// ─── Network I/O tracking ─────────────────────────────────────────────────────
// Track cumulative bytes to calculate live speed (delta per interval)
let _prevNetStats = null;
let _prevNetTime = Date.now();

class BotController {
  /**
   * Get bot dashboard data with system metrics
   * GET /api/bot
   */
  static async getBotDashboard(req, res) {
    try {
      const stats = await BotModel.getStats();
      const activeCount = stats.activeCount || 0;
      const maxConcurrent = stats.maxConcurrent || 50;
      const totalInstances = stats.totalInstances || 0;

      // Get current time for logs
      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });

      // Build workers list from active instances
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

      // Get system metrics
      const systemMetrics = await BotController.getSystemMetrics();

      const botData = {
        stats: {
          status: activeCount > 0 ? 'ONLINE' : 'IDLE',
          activeBots: `${activeCount} / ${maxConcurrent}`,
          cpuUsage: systemMetrics.cpuUsage,
          memoryUsage: systemMetrics.memoryPercent
        },
        system: systemMetrics
      };

      res.json(botData);
    } catch (err) {
      logger.error('Controller(Bot): Error fetching bot dashboard data:', err);
      res.status(500).json({ status: 'error', message: err.message });
    }
  }

  /**
   * Get system metrics (CPU, Memory, Storage, Database, Network)
   * All values are real system data from the OS
   */
  static async getSystemMetrics() {
    try {
      // ─── CPU (real percentage from OS) ─────────────────────────────────
      const cpuCount = os.cpus().length;
      const cpuPercent = BotController.getRealCpuPercent();
      const cpuUsagePercent = Math.min(cpuPercent, 100).toFixed(1);

      // ─── Memory (real from OS) ─────────────────────────────────────────
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedMem = totalMem - freeMem;
      const memUsagePercent = ((usedMem / totalMem) * 100).toFixed(1);

      // Process memory (Node.js)
      const processMem = process.memoryUsage();
      const heapUsed = (processMem.heapUsed / (1024 * 1024 * 1024)).toFixed(2);
      const rss = (processMem.rss / (1024 * 1024 * 1024)).toFixed(2);

      // ─── Storage (real disk usage from OS) ─────────────────────────────
      const diskInfo = BotController.getRealDiskUsage();

      // ─── Database ──────────────────────────────────────────────────────
      const dbStats = await BotController.getDatabaseStats();

      // ─── Network (live speed tracking) ─────────────────────────────────
      const networkStats = BotController.getLiveNetworkSpeed();

      // ─── App-specific storage ──────────────────────────────────────────
      const appStorageGB = await BotController.getStorageSize();

      return {
        // CPU
        cpuCores: cpuCount,
        cpuUsage: cpuUsagePercent + '%',
        cpuUsageRaw: parseFloat(cpuUsagePercent),
        cpuLoad1min: cpuUsagePercent,
        cpuLoad5min: cpuUsagePercent,
        cpuLoad15min: cpuUsagePercent,
        
        // Memory
        memoryPercent: memUsagePercent + '%',
        memoryPercentRaw: parseFloat(memUsagePercent),
        memoryUsed: (usedMem / (1024 * 1024 * 1024)).toFixed(2) + ' GB',
        memoryUsedRaw: parseFloat((usedMem / (1024 * 1024 * 1024)).toFixed(2)),
        memoryTotal: (totalMem / (1024 * 1024 * 1024)).toFixed(2) + ' GB',
        memoryTotalRaw: parseFloat((totalMem / (1024 * 1024 * 1024)).toFixed(2)),
        heapUsed: heapUsed + ' GB',
        rss: rss + ' GB',
        
        // Storage (real disk)
        storageUsed: diskInfo.usedFormatted,
        storageUsedRaw: diskInfo.usedGB,
        storageTotal: diskInfo.totalFormatted,
        storageTotalRaw: diskInfo.totalGB,
        storagePercent: diskInfo.percentFormatted,
        storagePercentRaw: diskInfo.percent,
        
        // App storage
        appStorage: appStorageGB + ' GB',
        
        // Database
        dbSize: dbStats.size,
        dbSizeRaw: dbStats.sizeBytes,
        dbConnections: dbStats.connections,
        
        // System
        uptime: BotController.formatUptime(os.uptime()),
        nodeVersion: process.version,
        platform: os.platform(),
        hostname: os.hostname(),
        
        // Network (live speed)
        networkIO: networkStats
      };
    } catch (err) {
      logger.error('Controller(Bot): Error getting system metrics:', err);
      return BotController.getDefaultMetrics();
    }
  }

  /**
   * Get real CPU usage percentage from OS (works on Windows via wmic)
   */
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
        } catch (e) {
          // wmic timeout or error — fall through
        }
      } else {
        const load = os.loadavg();
        const cpus = os.cpus().length;
        if (load[0] > 0) {
          return Math.min((load[0] / cpus) * 100, 100);
        }
      }
      // Fallback: calculate from CPU ticks
      return BotController.calculateCpuFromTicks();
    } catch (e) {
      return BotController.calculateCpuFromTicks();
    }
  }

  /**
   * Calculate CPU usage from tick deltas (cross-platform fallback)
   */
  static calculateCpuFromTicks() {
    try {
      const cpus = os.cpus();
      let totalIdle = 0, totalTick = 0;
      for (const cpu of cpus) {
        for (const type in cpu.times) {
          totalTick += cpu.times[type];
        }
        totalIdle += cpu.times.idle;
      }
      const idle = totalIdle / cpus.length;
      const total = totalTick / cpus.length;
      return parseFloat((100 - (idle / total) * 100).toFixed(1));
    } catch (e) {
      return 0;
    }
  }

  /**
   * Get real disk usage from OS (Windows: wmic, Linux: df)
   */
  static getRealDiskUsage() {
    try {
      if (os.platform() === 'win32') {
        const out = execSync('wmic logicaldisk where drivetype=3 get caption,freespace,size', { encoding: 'utf8', shell: 'cmd.exe', timeout: 5000 });
        const lines = out.trim().split('\n').filter(l => l.trim());
        let totalGB = 0, freeGB = 0;
        for (let i = 1; i < lines.length; i++) {
          // Parse wmic output like: "C:  28260904960  166051692544"
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
        return {
          usedGB: parseFloat(usedGB.toFixed(2)),
          totalGB: parseFloat(totalGB.toFixed(2)),
          percent: parseFloat(percent.toFixed(1)),
          usedFormatted: usedGB.toFixed(2) + ' GB',
          totalFormatted: totalGB.toFixed(2) + ' GB',
          percentFormatted: percent.toFixed(1) + '%'
        };
      } else {
        // Linux: use df
        const out = execSync('df -B1 / | tail -1', { encoding: 'utf8', timeout: 5000 });
        const parts = out.trim().split(/\s+/);
        if (parts.length >= 4) {
          const total = parseFloat(parts[1]) / (1024 * 1024 * 1024);
          const used = parseFloat(parts[2]) / (1024 * 1024 * 1024);
          const percent = total > 0 ? (used / total) * 100 : 0;
          return {
            usedGB: parseFloat(used.toFixed(2)),
            totalGB: parseFloat(total.toFixed(2)),
            percent: parseFloat(percent.toFixed(1)),
            usedFormatted: used.toFixed(2) + ' GB',
            totalFormatted: total.toFixed(2) + ' GB',
            percentFormatted: percent.toFixed(1) + '%'
          };
        }
      }
    } catch (e) {
      logger.warn('Disk usage query failed:', e.message);
    }
    return { usedGB: 0, totalGB: 100, percent: 0, usedFormatted: '0 GB', totalFormatted: '100 GB', percentFormatted: '0%' };
  }

  /**
   * Get live network speed (upload/download per second)
   * Uses delta tracking between poll intervals
   */
  static getLiveNetworkSpeed() {
    try {
      const now = Date.now();
      const elapsed = (now - _prevNetTime) / 1000; // seconds since last poll
      
      // Get current cumulative bytes from OS
      let rxBytes = 0, txBytes = 0;
      
      if (os.platform() === 'win32') {
        // Windows: use netstat -e for interface statistics
        try {
          const out = execSync('netstat -e', { encoding: 'utf8', shell: 'cmd.exe', timeout: 5000 });
          const lines = out.trim().split('\n');
          for (const line of lines) {
            // Match "Bytes  2261993804  1212601136"
            const match = line.match(/Bytes\s+(\d+)\s+(\d+)/);
            if (match) {
              rxBytes = parseInt(match[1]) || 0;
              txBytes = parseInt(match[2]) || 0;
              break;
            }
          }
        } catch (e) {
          // Fallback
        }
      } else {
        // Linux: read /proc/net/dev
        try {
          const out = fs.readFileSync('/proc/net/dev', 'utf8');
          const lines = out.split('\n');
          for (const line of lines) {
            if (line.includes('eth0') || line.includes('ens') || line.includes('wlan')) {
              const parts = line.trim().split(/\s+/);
              if (parts.length >= 10) {
                rxBytes = parseInt(parts[1]) || 0;
                txBytes = parseInt(parts[9]) || 0;
              }
            }
          }
        } catch (e) {
          // Fallback
        }
      }

      // Calculate speed from delta
      let downloadSpeed = 0, uploadSpeed = 0;
      if (_prevNetStats && elapsed > 0.5) {
        const rxDelta = Math.max(0, rxBytes - _prevNetStats.rxBytes);
        const txDelta = Math.max(0, txBytes - _prevNetStats.txBytes);
        downloadSpeed = rxDelta / elapsed; // bytes/sec
        uploadSpeed = txDelta / elapsed;   // bytes/sec
      }

      // Store for next poll
      _prevNetStats = { rxBytes, txBytes };
      _prevNetTime = now;

      return {
        bytesReceived: (rxBytes / (1024 * 1024)).toFixed(2) + ' MB',
        bytesSent: (txBytes / (1024 * 1024)).toFixed(2) + ' MB',
        downloadSpeed: downloadSpeed,
        downloadSpeedFormatted: BotController.formatSpeed(downloadSpeed),
        uploadSpeed: uploadSpeed,
        uploadSpeedFormatted: BotController.formatSpeed(uploadSpeed)
      };
    } catch (err) {
      logger.warn('Network speed tracking failed:', err.message);
      return { 
        bytesReceived: '0 MB', bytesSent: '0 MB',
        downloadSpeed: 0, downloadSpeedFormatted: '0 B/s',
        uploadSpeed: 0, uploadSpeedFormatted: '0 B/s'
      };
    }
  }

  /**
   * Format bytes per second to human-readable
   */
  static formatSpeed(bytesPerSec) {
    if (bytesPerSec >= 1024 * 1024) return (bytesPerSec / (1024 * 1024)).toFixed(2) + ' MB/s';
    if (bytesPerSec >= 1024) return (bytesPerSec / 1024).toFixed(2) + ' KB/s';
    return bytesPerSec.toFixed(0) + ' B/s';
  }

  /**
   * Get storage directory size (app-specific)
   */
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
            if (stat.isFile()) {
              totalSize += stat.size;
            } else if (stat.isDirectory()) {
              scanDir(fullPath);
            }
          }
        };
        scanDir(storageDir);
      }
    } catch (err) {
      logger.warn('Storage scan failed:', err.message);
    }
    return (totalSize / (1024 * 1024 * 1024)).toFixed(2);
  }

  /**
   * Get database statistics (real size from MySQL)
   */
  static async getDatabaseStats() {
    try {
      const result = await new Promise((resolve, reject) => {
        db.get(
          "SELECT table_schema AS db_name, SUM(data_length + index_length) AS size FROM information_schema.tables WHERE table_schema = DATABASE()",
          (err, row) => {
            if (err) return reject(err);
            resolve(row);
          }
        );
      });

      const sizeBytes = result?.size || 0;
      const size = (sizeBytes / (1024 * 1024)).toFixed(2) + ' MB';
      
      // Get actual connection count
      let connections = 0;
      try {
        const connResult = await new Promise((resolve, reject) => {
          db.get("SHOW STATUS LIKE 'Threads_connected'", (err, row) => {
            if (err) return reject(err);
            resolve(row);
          });
        });
        connections = parseInt(connResult?.Value) || 0;
      } catch (err) {
        connections = 0;
      }

      return { size, sizeBytes, connections };
    } catch (err) {
      logger.warn('DB stats failed:', err.message);
      return { size: '0 MB', sizeBytes: 0, connections: 0 };
    }
  }

  /**
   * Format uptime in human-readable format
   */
  static formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
    return `${minutes}m ${secs}s`;
  }

  /**
   * Get default metrics for fallback
   */
  static getDefaultMetrics() {
    return {
      cpuCores: 0,
      cpuUsage: '0%',
      cpuUsageRaw: 0,
      cpuLoad1min: '0',
      cpuLoad5min: '0',
      cpuLoad15min: '0',
      memoryPercent: '0%',
      memoryPercentRaw: 0,
      memoryUsed: '0 GB',
      memoryUsedRaw: 0,
      memoryTotal: '0 GB',
      memoryTotalRaw: 0,
      heapUsed: '0 GB',
      rss: '0 GB',
      storageUsed: '0 GB',
      storageUsedRaw: 0,
      storageTotal: '0 GB',
      storageTotalRaw: 0,
      storagePercent: '0%',
      storagePercentRaw: 0,
      appStorage: '0 GB',
      dbSize: '0 MB',
      dbSizeRaw: 0,
      dbConnections: 0,
      uptime: '0m',
      nodeVersion: process.version,
      platform: os.platform(),
      hostname: os.hostname(),
      networkIO: { 
        bytesReceived: '0 MB', bytesSent: '0 MB',
        downloadSpeed: 0, downloadSpeedFormatted: '0 B/s',
        uploadSpeed: 0, uploadSpeedFormatted: '0 B/s'
      }
    };
  }
}

module.exports = BotController;