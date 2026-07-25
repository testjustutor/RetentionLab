/**
 * root/routes/dashboard.js
 */
const express = require('express');
const router = express.Router();
const AdminModel = require('../models/admin/AdminModel');
const { requireAuth, requireRole } = require('../middleware/auth');
const os = require('os');

router.get('/', requireAuth, async (req, res) => {
  try {
    const counts = await AdminModel.getDashboardCounts();
    res.json({ data: counts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/super_admin', requireAuth, async (req, res) => {
  try {
    const counts = await AdminModel.getDashboardCounts();
    
    // Calculate memory usage (system load proxy)
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const systemLoad = ((totalMem - freeMem) / totalMem * 100).toFixed(1);
    
    let activeSchedules = 0;
    let totalUsers = 0;
    
    counts.forEach(c => {
      if (c.table === 'meetings') activeSchedules = c.count;
      if (c.table === 'users') totalUsers = c.count;
    });

    const apiRequests = (totalUsers * 100) + 1200; // Proxy calculation
    const gatewayFlags = 0; 
    
    // Mock deployments since we don't have a deployment table yet
    const deployments = [
      { id: 'dep-xyz', service: 'core-database', environment: 'Production Cluster', status: 'Deployed', time: '10 mins ago' },
      { id: 'dep-abc', service: 'api-mesh-router', environment: 'Global Edge CDN', status: 'Active', time: '2 hours ago' }
    ];

    res.json({ 
      activeSchedules,
      systemLoad,
      apiRequests,
      gatewayFlags,
      deployments
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/dashboard/super-admin/stats
 * Aggregated dashboard stats for super admin
 * Returns real-time counts, trends, and recent activity
 */
router.get('/super-admin/stats', requireAuth, requireRole('super_admin'), async (req, res) => {
  try {
    const { runAsync, allAsync, getAsync } = require('../database/db');

    const days = parseInt(req.query.days) || 7;

    // 1. Company stats
    const companies = await allAsync(`SELECT id, company_name, status, created_at FROM companies WHERE deleted_at IS NULL ORDER BY created_at DESC`);
    const totalCompanies = companies.length;
    const activeCompanies = companies.filter(c => c.status === 'active').length;
    const newCompanies = companies.filter(c => {
      const d = new Date(c.created_at);
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 30);
      return d >= cutoff;
    }).length;

    // 2. User stats
    const users = await allAsync(`
      SELECT u.id, u.first_name, u.last_name, u.email, u.status, u.created_at, u.company_id, 
             r.role_name, c.company_name
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      LEFT JOIN companies c ON u.company_id = c.id
      WHERE u.deleted_at IS NULL
      ORDER BY u.created_at DESC
    `);
    const totalUsers = users.length;
    const activeUsers = users.filter(u => u.status === 'active').length;
    const usersByRole = {};
    users.forEach(u => {
      const role = u.role_name || 'unknown';
      usersByRole[role] = (usersByRole[role] || 0) + 1;
    });
    const newUsers = users.filter(u => {
      const d = new Date(u.created_at);
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 7);
      return d >= cutoff;
    }).length;

    // 3. Meeting stats
    const meetings = await allAsync(`
      SELECT m.*, CONCAT(u.first_name, ' ', u.last_name) as owner_name
      FROM meetings m
      LEFT JOIN users u ON u.id = m.created_by
      ORDER BY m.start_time DESC
      LIMIT 200
    `);
    const totalMeetings = meetings.length;
    const inProgressMeetings = meetings.filter(m => m.status === 'in_progress' || m.status === 'joining').length;
    const completedMeetings = meetings.filter(m => m.status === 'completed').length;
    const scheduledMeetings = meetings.filter(m => m.status === 'scheduled' || m.status === 'pending').length;

    // 4. Meeting trends (meetings per day for last N days)
    const trendData = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const count = meetings.filter(m => {
        if (!m.start_time) return false;
        const mDate = new Date(m.start_time).toISOString().split('T')[0];
        return mDate === dateStr;
      }).length;
      trendData.push({
        date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        count
      });
    }

    // 5. Recent users (last 10)
    const recentUsers = users.slice(0, 10).map(u => ({
      id: u.id,
      name: `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email,
      email: u.email,
      role: u.role_name || 'N/A',
      company: u.company_name || 'N/A',
      status: u.status,
      created_at: u.created_at
    }));

    // 6. Recent meetings (last 10)
    const recentMeetings = meetings.slice(0, 10).map(m => ({
      id: m.id,
      title: m.title || m.meeting_id || 'Untitled',
      status: m.status || 'unknown',
      owner: m.owner_name || 'N/A',
      start_time: m.start_time,
      duration: m.duration || null
    }));

    // 7. System metrics
    const uptime = Math.floor(process.uptime());
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const memUsage = ((totalMem - freeMem) / totalMem * 100).toFixed(1);
    const cpuLoad = os.loadavg ? os.loadavg()[0]?.toFixed(1) : '0.0';

    // 8. User signup trends (users per day for last 14 days)
    const userTrends = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const count = users.filter(u => {
        if (!u.created_at) return false;
        const uDate = new Date(u.created_at).toISOString().split('T')[0];
        return uDate === dateStr;
      }).length;
      userTrends.push({
        date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        count
      });
    }

    res.json({
      success: true,
      stats: {
        companies: { total: totalCompanies, active: activeCompanies, new: newCompanies },
        users: { total: totalUsers, active: activeUsers, new: newUsers, byRole: usersByRole },
        meetings: { total: totalMeetings, inProgress: inProgressMeetings, completed: completedMeetings, scheduled: scheduledMeetings },
        system: { uptime, memUsage, cpuLoad, totalMem, freeMem },
        trends: { meetingTrends: trendData, userTrends },
        recentUsers,
        recentMeetings
      }
    });
  } catch (err) {
    console.error('[Dashboard] Error fetching stats:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
