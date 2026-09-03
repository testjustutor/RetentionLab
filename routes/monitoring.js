/**
 * root/routes/monitoring.js
 * Server monitoring and performance routes
 */

const express = require('express');
const router = express.Router();
const BotController = require('../controllers/bot/botController');

// GET /api/monitoring/server - Server performance monitoring
router.get('/server', async (req, res) => {
  try {
    const data = await BotController.getBotDashboard(req, res);
    res.json(data);
  } catch (err) {
    console.error('Route(monitoring): Error fetching server monitoring data:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

module.exports = router;