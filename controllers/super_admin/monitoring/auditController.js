/**
 * controllers/super_admin/monitoring/auditController.js
 * Audit log access for the Super Admin monitoring page.
 * Reads log files / returns recent audit entries — no SQL in controller.
 */
const fs = require('fs');
const path = require('path');

const controller = {
  /**
   * GET /api/super_admin/monitoring/audit
   * Return the most recent audit log entries (from the app's log directory).
   */
  async list(req, res) {
    try {
      const limit = parseInt(req.query.limit) || 100;
      const logsDir = path.join(__dirname, '..', '..', '..', 'logs');
      const entries = [];
      if (fs.existsSync(logsDir)) {
        const files = fs.readdirSync(logsDir).filter(f => f.endsWith('.log'));
        for (const file of files) {
          const full = path.join(logsDir, file);
          try {
            const lines = fs.readFileSync(full, 'utf8').split(/\r?\n/).filter(Boolean);
            lines.forEach(line => {
              try { entries.push(JSON.parse(line)); } catch (e) {
                entries.push({ timestamp: new Date().toISOString(), level: 'INFO', module: file, description: line });
              }
            });
          } catch (e) { /* skip unreadable file */ }
        }
      }
      entries.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
      res.json({ logs: entries.slice(0, limit) });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  }
};

module.exports = controller;