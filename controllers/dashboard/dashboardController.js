/**
 * controllers/dashboard/dashboardController.js
 * Dashboard logic.
 */
const AdminModel = require('../../models/admin/AdminModel');
const DashboardModel = require('../../models/dashboard/DashboardModel');
const os = require('os');

const controller = {
  async getDashboard(req, res) {
    try {
      const counts = await AdminModel.getDashboardCounts();
      res.json({ data: counts });
    } catch (err) { res.status(500).json({ error: err.message }); }
  },

  async getSuperAdmin(req, res) {
    try {
      const counts = await AdminModel.getDashboardCounts();
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const systemLoad = ((totalMem - freeMem) / totalMem * 100).toFixed(1);
      let activeSchedules = 0, totalUsers = 0;
      counts.forEach(c => {
        if (c.table === 'meetings') activeSchedules = c.count;
        if (c.table === 'users') totalUsers = c.count;
      });
      const apiRequests = (totalUsers * 100) + 1200;
      const gatewayFlags = 0;
      const deployments = [
        { id: 'dep-xyz', service: 'core-database', environment: 'Production Cluster', status: 'Deployed', time: '10 mins ago' },
        { id: 'dep-abc', service: 'api-mesh-router', environment: 'Global Edge CDN', status: 'Active', time: '2 hours ago' }
      ];
      res.json({ activeSchedules, systemLoad, apiRequests, gatewayFlags, deployments });
    } catch (err) { res.status(500).json({ error: err.message }); }
  },

  async getSuperAdminStats(req, res) {
    try {
      const days = parseInt(req.query.days) || 7;
      const companies = await DashboardModel.getAllCompanies();
      const totalCompanies = companies.length;
      const activeCompanies = companies.filter(c => c.status === 'active').length;
      const newCompanies = companies.filter(c => {
        const d = new Date(c.created_at);
        const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30);
        return d >= cutoff;
      }).length;

      const users = await DashboardModel.getAllUsersWithDetails();
      const totalUsers = users.length;
      const activeUsers = users.filter(u => u.status === 'active').length;
      const usersByRole = {};
      users.forEach(u => {
        const role = u.role_name || 'unknown';
        usersByRole[role] = (usersByRole[role] || 0) + 1;
      });
      const newUsers = users.filter(u => {
        const d = new Date(u.created_at);
        const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 7);
        return d >= cutoff;
      }).length;

      const meetings = await DashboardModel.getRecentMeetingsWithOwner(200);
      const totalMeetings = meetings.length;
      const inProgressMeetings = meetings.filter(m => m.status === 'in_progress' || m.status === 'joining').length;
      const completedMeetings = meetings.filter(m => m.status === 'completed').length;
      const scheduledMeetings = meetings.filter(m => m.status === 'scheduled' || m.status === 'pending').length;

      const trendData = [];
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const count = meetings.filter(m => {
          if (!m.start_time) return false;
          return new Date(m.start_time).toISOString().split('T')[0] === dateStr;
        }).length;
        trendData.push({ date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), count });
      }

      const recentUsers = users.slice(0, 10).map(u => ({
        id: u.id, name: `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email,
        email: u.email, role: u.role_name || 'N/A', company: u.company_name || 'N/A', status: u.status, created_at: u.created_at
      }));

      const recentMeetings = meetings.slice(0, 10).map(m => ({
        id: m.id, title: m.title || m.meeting_id || 'Untitled', status: m.status || 'unknown',
        owner: m.owner_name || 'N/A', start_time: m.start_time, duration: m.duration || null
      }));

      const uptime = Math.floor(process.uptime());
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const memUsage = ((totalMem - freeMem) / totalMem * 100).toFixed(1);
      const cpuLoad = os.loadavg ? os.loadavg()[0]?.toFixed(1) : '0.0';

      const userTrends = [];
      for (let i = 13; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const count = users.filter(u => {
          if (!u.created_at) return false;
          return new Date(u.created_at).toISOString().split('T')[0] === dateStr;
        }).length;
        userTrends.push({ date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), count });
      }

      res.json({
        success: true,
        stats: {
          companies: { total: totalCompanies, active: activeCompanies, new: newCompanies },
          users: { total: totalUsers, active: activeUsers, new: newUsers, byRole: usersByRole },
          meetings: { total: totalMeetings, inProgress: inProgressMeetings, completed: completedMeetings, scheduled: scheduledMeetings },
          system: { uptime, memUsage, cpuLoad, totalMem, freeMem },
          trends: { meetingTrends: trendData, userTrends },
          recentUsers, recentMeetings
        }
      });
    } catch (err) {
      console.error('[Dashboard] Error fetching stats:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  }
};

module.exports = controller;