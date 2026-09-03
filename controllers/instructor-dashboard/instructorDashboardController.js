/**
 * root/controllers/instructorDashboardController.js
 */
const { InstructorDashboardModel } = require('../../models/instructor-dashboard/InstructorDashboardModel');
const { requireAuth } = require('../../middleware/auth');

async function getDashboardStats(req, res) {
  try {
    const userId = req.user.id;
    const data = await InstructorDashboardModel.getDashboardStats(userId);
    res.json({ success: true, data });
  } catch (err) {
    console.error('InstructorDashboardController stats error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

async function getRecentMeetings(req, res) {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 5;
    const data = await InstructorDashboardModel.getRecentMeetings(userId, limit);
    res.json({ success: true, data });
  } catch (err) {
    console.error('InstructorDashboardController recentMeetings error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

async function getScoreTrend(req, res) {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 7;
    const data = await InstructorDashboardModel.getScoreTrend(userId, limit);
    res.json({ success: true, data });
  } catch (err) {
    console.error('InstructorDashboardController scoreTrend error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

async function getEvaluationBreakdown(req, res) {
  try {
    const userId = req.user.id;
    const data = await InstructorDashboardModel.getEvaluationBreakdown(userId);
    res.json({ success: true, data });
  } catch (err) {
    console.error('InstructorDashboardController evaluationBreakdown error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = {
  getDashboardStats,
  getRecentMeetings,
  getScoreTrend,
  getEvaluationBreakdown
};
