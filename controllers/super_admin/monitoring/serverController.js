/**
 * controllers/super_admin/monitoring/serverController.js
 * Server monitoring data for the Super Admin panel.
 * Only calls models / built-ins — no SQL in the controller.
 */
const os = require('os');

const controller = {
  /**
   * GET /api/super_admin/monitoring/server
   * Collect system metrics via Node built-ins (no DB needed).
   */
  async getServer(req, res) {
    try {
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const data = {
        status: 'OK',
        uptime: process.uptime(),
        platform: os.platform(),
        hostname: os.hostname(),
        cpuCores: os.cpus().length,
        memoryTotal: totalMem,
        memoryFree: freeMem,
        memoryUsed: totalMem - freeMem,
        memoryPercent: Math.round(((totalMem - freeMem) / totalMem) * 100) / 100,
        cpuLoad: os.loadavg ? os.loadavg() : [0, 0, 0],
        nodeVersion: process.version
      };
      res.json(data);
    } catch (e) {
      res.status(500).json({ status: 'error', error: e.message });
    }
  }
};

module.exports = controller;