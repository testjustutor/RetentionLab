/**
 * Analytics Insights Controller
 * Provides dynamic analytics data from session quality reports and meetings
 */
const AnalyticsModel = require('../../models/insights/AnalyticsModel');

const controller = {
  /**
   * POST /api/admin/insights/analytics
   * Get analytics data: meeting trends, score distribution, overall metrics
   */
  async getAnalytics(req, res) {
    try {
      const user = req.user;
      const { from_date, to_date } = req.body;

      // Get meeting trends (monthly counts)
      const meetingTrends = await AnalyticsModel.getMeetingTrends(user, { from_date, to_date });

      // Get score distribution (bands)
      const scoreDistribution = await AnalyticsModel.getScoreDistribution(user, { from_date, to_date });

      // Get overall metrics
      const overallMetrics = await AnalyticsModel.getOverallMetrics(user, { from_date, to_date });

      res.json({
        success: true,
        meeting_trends: meetingTrends,
        score_distribution: scoreDistribution,
        overall_metrics: overallMetrics || { total_sessions: 0, avg_score: 0, avg_engagement: 0, avg_learning_impact: 0 }
      });
    } catch (err) {
      console.error('Analytics insights error:', err);
      res.status(500).json({ error: err.message, success: false });
    }
  }
};

module.exports = controller;
