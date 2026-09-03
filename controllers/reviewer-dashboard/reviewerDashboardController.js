/**
 * controllers/reviewer-dashboard/reviewerDashboardController.js
 * Reviewer dashboard controller
 */
const ReviewerDashboardModel = require('../../models/reviewers/ReviewerDashboardModel');

const controller = {
  async getStats(req, res) {
    try {
      const reviewerId = req.user.id;
      const reviews = await ReviewerDashboardModel.getReviewsByReviewer(reviewerId);
      const pending = reviews.filter(r => r.review_status === 'pending');
      const inProgress = reviews.filter(r => r.review_status === 'in_progress');
      const completed = reviews.filter(r => r.review_status === 'completed');
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const overdue = pending.filter(r => new Date(r.assigned_at) < sevenDaysAgo);
      const recentlyAssigned = reviews.filter(r => new Date(r.assigned_at) > sevenDaysAgo);
      const avgReviewTime = completed.length > 0
        ? Math.round(completed.reduce((sum, r) => {
            if (!r.reviewed_at) return sum;
            return sum + (new Date(r.reviewed_at) - new Date(r.assigned_at)) / (1000 * 60 * 60);
          }, 0) / completed.length)
        : 0;
      res.json({
        pending: pending.length, inProgress: inProgress.length, completed: completed.length,
        overdue: overdue.length, recentlyAssigned: recentlyAssigned.length,
        avgReviewTime: Math.round(avgReviewTime * 10) / 10, totalReviews: reviews.length
      });
    } catch (err) { res.status(500).json({ error: err.message }); }
  },
  async getRecentAssignments(req, res) {
    try {
      const reviewerId = req.user.id;
      const limit = parseInt(req.query.limit) || 5;
      const assignments = await ReviewerDashboardModel.getRecentAssignments(reviewerId, limit);
      res.json(assignments);
    } catch (err) { res.status(500).json({ error: err.message }); }
  },
  async getOverdue(req, res) {
    try {
      const reviewerId = req.user.id;
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const overdue = await ReviewerDashboardModel.getOverdueReviews(reviewerId, sevenDaysAgo);
      res.json(overdue);
    } catch (err) { res.status(500).json({ error: err.message }); }
  },
  async getPerformance(req, res) {
    try {
      const reviewerId = req.user.id;
      const completed = await ReviewerDashboardModel.getCompletedReviews(reviewerId);
      const avgTime = completed.length > 0
        ? Math.round(completed.reduce((sum, r) => {
            if (!r.reviewed_at) return sum;
            return sum + (new Date(r.reviewed_at) - new Date(r.assigned_at)) / (1000 * 60 * 60);
          }, 0) / completed.length)
        : 0;
      const eightWeeksAgo = new Date(Date.now() - 8 * 7 * 24 * 60 * 60 * 1000);
      const weeklyData = {};
      for (let i = 0; i < 8; i++) {
        const weekStart = new Date(eightWeeksAgo);
        weekStart.setDate(weekStart.getDate() + i * 7);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        const weekKey = `Week ${i + 1}`;
        weeklyData[weekKey] = completed.filter(r => {
          const reviewedAt = new Date(r.reviewed_at);
          return reviewedAt >= weekStart && reviewedAt <= weekEnd;
        }).length;
      }
      res.json({
        totalCompleted: completed.length,
        averageCompletionTime: Math.round(avgTime * 10) / 10,
        weeklyReviews: weeklyData,
        recentReviews: completed.slice(0, 5).map(r => ({
          meeting_title: r.meeting_title, completed_at: r.reviewed_at, status: r.review_status
        }))
      });
    } catch (err) { res.status(500).json({ error: err.message }); }
  }
};

module.exports = controller;