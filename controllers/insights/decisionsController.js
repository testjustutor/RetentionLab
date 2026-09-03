/**
 * Decisions Insights Controller
 * Provides dynamic decision data from session evaluations and coaching feedback
 */
const DecisionsModel = require('../../models/insights/DecisionsModel');

const controller = {
  /**
   * GET /api/insights/decisions
   * Get decisions and recommendations from sessions
   */
  async getDecisions(req, res) {
    try {
      const user = req.user;
      const { from_date, to_date, instructor_id, decision_type } = req.body;

      // Get decisions from session final evaluations (SQL lives in DecisionsModel)
      const decisions = await DecisionsModel.getEvaluationDecisions(user, { from_date, to_date, instructor_id, decision_type });

      // Get decisions from teacher coaching feedback (SQL lives in DecisionsModel)
      const coachingDecisions = await DecisionsModel.getCoachingDecisions(user, { from_date, to_date, instructor_id });

      // Combine all decisions
      const allDecisions = [
        ...decisions.map(d => ({
          ...d,
          decision_type: 'evaluation',
          source: 'Session Evaluation'
        })),
        ...coachingDecisions.map(d => ({
          ...d,
          decision_type: 'coaching',
          source: 'Coaching Feedback'
        }))
      ];

      // Calculate summary statistics
      const totalDecisions = allDecisions.length;
      const evaluationDecisions = decisions.length;
      const coachingDecisionsCount = coachingDecisions.length;

      // Rating distribution
      const ratingDistribution = {};
      decisions.forEach(d => {
        const rating = d.overall_session_rating || 'Not Rated';
        ratingDistribution[rating] = (ratingDistribution[rating] || 0) + 1;
      });

      // Performance metrics from decisions
      const avgTeacherPerformance = decisions.length > 0
        ? Math.round(decisions.reduce((sum, d) => sum + (parseFloat(d.teacher_performance) || 0), 0) / decisions.length)
        : 0;
      const avgStudentEngagement = decisions.length > 0
        ? Math.round(decisions.reduce((sum, d) => sum + (parseFloat(d.student_engagement) || 0), 0) / decisions.length)
        : 0;
      const avgLearningImpact = decisions.length > 0
        ? Math.round(decisions.reduce((sum, d) => sum + (parseFloat(d.learning_impact) || 0), 0) / decisions.length)
        : 0;

      // Instructor-wise breakdown
      const instructorStats = {};
      allDecisions.forEach(decision => {
        const instructorId = decision.instructor_id;
        if (!instructorStats[instructorId]) {
          instructorStats[instructorId] = {
            instructor_id: instructorId,
            instructor_name: decision.instructor_name,
            total_decisions: 0,
            evaluation_count: 0,
            coaching_count: 0
          };
        }
        instructorStats[instructorId].total_decisions++;
        if (decision.decision_type === 'evaluation') instructorStats[instructorId].evaluation_count++;
        if (decision.decision_type === 'coaching') instructorStats[instructorId].coaching_count++;
      });

      const instructorBreakdown = Object.values(instructorStats);

      // Recent decisions (last 10)
      const recentDecisions = allDecisions.slice(0, 10).map(d => ({
        id: d.id,
        decision_text: d.decision_text,
        decision_type: d.decision_type,
        source: d.source,
        meeting_title: d.meeting_title,
        meeting_date: d.meeting_date,
        instructor_name: d.instructor_name,
        overall_rating: d.overall_session_rating,
        context: d.context
      }));

      res.json({
        success: true,
        summary: {
          total_decisions: totalDecisions,
          evaluation_decisions: evaluationDecisions,
          coaching_decisions: coachingDecisionsCount,
          rating_distribution: ratingDistribution,
          avg_teacher_performance: avgTeacherPerformance,
          avg_student_engagement: avgStudentEngagement,
          avg_learning_impact: avgLearningImpact
        },
        instructor_breakdown: instructorBreakdown,
        recent_decisions: recentDecisions
      });
    } catch (err) {
      console.error('Decisions insights error:', err);
      res.status(500).json({ error: err.message, success: false });
    }
  }
};

module.exports = controller;
