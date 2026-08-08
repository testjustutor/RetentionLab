/**
 * Engagement Insights Controller
 * Provides dynamic engagement metrics from session quality data
 */
const SessionQualityReportsModel = require('../../models/session-quality/SessionQualityReportsModel');
const MeetingModel = require('../../models/meetings/MeetingModel');
const { db } = require('../../database/db');

const controller = {
  /**
   * GET /api/insights/engagement
   * Get engagement insights for admin dashboard
   */
  async getEngagementInsights(req, res) {
    try {
      const user = req.user;
      const { from_date, to_date, instructor_id } = req.body;

      // Build base query
      let sql = `
        SELECT 
          sqr.meeting_id,
          sqr.student_engagement,
          sqr.learning_impact,
          sqr.overall_rating,
          sqr.percentage_score,
          sqr.confidence_level,
          sqr.executive_summary,
          m.title as meeting_title,
          m.scheduled_start_time as meeting_date,
          m.calendar_account as instructor_email,
          CONCAT(u.first_name, ' ', u.last_name) as instructor_name,
          u.id as instructor_id
        FROM session_quality_reports sqr
        JOIN meetings m ON m.id = sqr.meeting_id
        JOIN users u ON LOWER(u.email) = LOWER(m.calendar_account)
        WHERE 1=1
      `;
      const params = [];

      // Filter by company (admin sees their company's data)
      if (user.role_name === 'admin') {
        sql += ' AND u.company_id = ?';
        params.push(user.company_id);
      }

      // Filter by date range
      if (from_date) {
        sql += ' AND m.scheduled_start_time >= ?';
        params.push(from_date + ' 00:00:00');
      }
      if (to_date) {
        sql += ' AND m.scheduled_start_time <= ?';
        params.push(to_date + ' 23:59:59');
      }

      // Filter by instructor
      if (instructor_id) {
        sql += ' AND u.id = ?';
        params.push(parseInt(instructor_id));
      }

      // Only get meetings with quality reports
      sql += ' AND sqr.student_engagement IS NOT NULL';
      sql += ' ORDER BY m.scheduled_start_time DESC LIMIT 100';

      const reports = await new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows || []));
      });

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
  }
};

module.exports = controller;