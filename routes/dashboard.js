/**
 * root/routes/dashboard.js
 */
const express = require('express');
const router = express.Router();
const AdminModel = require('../models/AdminModel');
const { requireAuth } = require('../middleware/auth');
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

module.exports = router;
