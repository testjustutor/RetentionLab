/**
 * Engagement Insights Controller
 * Provides dynamic engagement metrics from session quality data
 */
const EngagementModel = require('../../models/insights/EngagementModel');

const controller = {
  /**
   * GET /api/insights/engagement
   * Get engagement insights for admin dashboard
   */
  async getEngagementInsights(req, res) {
    try {
      const user = req.user;
      const { from_date, to_date, instructor_id } = req.body;

      // Get engagement reports (SQL lives in EngagementModel)
      const reports = await EngagementModel.getEngagementReports(user, { from_date, to_date, instructor_id });

      // Calculate aggregate metrics
      const totalSessions = reports.length;
      const avgEngagement = totalSessions > 0
        ? Math.round(reports.reduce((sum, r) => sum + (parseFloat(r.student_engagement) || 0), 0) / totalSessions)
        : 0;
      const avgLearningImpact = totalSessions > 0
        ? Math.round(reports.reduce((sum, r) => sum + (parseFloat(r.learning_impact) || 0), 0) / totalSessions)
        : 0;
      const avgScore = totalSessions > 0
        ? Math.round(reports.reduce((sum, r) => sum + (parseFloat(r.percentage_score) || 0), 0) / totalSessions)
        : 0;

      // Engagement level distribution
      const engagementLevels = { high: 0, medium: 0, low: 0 };
      reports.forEach(r => {
        const engagement = parseFloat(r.student_engagement) || 0;
        if (engagement >= 70) engagementLevels.high++;
        else if (engagement >= 40) engagementLevels.medium++;
        else engagementLevels.low++;
      });

      // Rating distribution
      const ratingDistribution = {};
      reports.forEach(r => {
        const rating = r.overall_rating || 'Not Rated';
        ratingDistribution[rating] = (ratingDistribution[rating] || 0) + 1;
      });

      // Get instructor-wise breakdown
      const instructorStats = {};
      reports.forEach(r => {
        const instructorId = r.instructor_id;
        if (!instructorStats[instructorId]) {
          instructorStats[instructorId] = {
            instructor_id: instructorId,
            instructor_name: r.instructor_name,
            session_count: 0,
            total_engagement: 0,
            total_learning_impact: 0
          };
        }
        instructorStats[instructorId].session_count++;
        instructorStats[instructorId].total_engagement += parseFloat(r.student_engagement) || 0;
        instructorStats[instructorId].total_learning_impact += parseFloat(r.learning_impact) || 0;
      });

      // Calculate averages for instructors
      const instructorBreakdown = Object.values(instructorStats).map(inst => ({
        instructor_id: inst.instructor_id,
        instructor_name: inst.instructor_name,
        session_count: inst.session_count,
        avg_engagement: Math.round(inst.total_engagement / inst.session_count),
        avg_learning_impact: Math.round(inst.total_learning_impact / inst.session_count)
      }));

      // Recent sessions with engagement data
      const recentSessions = reports.slice(0, 10).map(r => ({
        meeting_id: r.meeting_id,
        meeting_title: r.meeting_title,
        meeting_date: r.meeting_date,
        instructor_name: r.instructor_name,
        student_engagement: r.student_engagement,
        learning_impact: r.learning_impact,
        overall_rating: r.overall_rating,
        percentage_score: r.percentage_score
      }));

      res.json({
        success: true,
        summary: {
          total_sessions: totalSessions,
          avg_engagement: avgEngagement,
          avg_learning_impact: avgLearningImpact,
          avg_score: avgScore,
          engagement_levels: engagementLevels,
          rating_distribution: ratingDistribution
        },
        instructor_breakdown: instructorBreakdown,
        recent_sessions: recentSessions
      });
    } catch (err) {
      console.error('Engagement insights error:', err);
      res.status(500).json({ error: err.message, success: false });
    }
  },

  /**
   * GET /api/admin/insights/instructors
   * Get instructor list for insights filter dropdowns (SQL lives in EngagementModel).
   */
  async getInstructors(req, res) {
    try {
      const instructors = await EngagementModel.getInstructors(req.user);
      res.json({ success: true, instructors });
    } catch (err) {
      console.error('Engagement instructors error:', err);
      res.status(500).json({ error: err.message, success: false });
    }
  }
};

module.exports = controller;
