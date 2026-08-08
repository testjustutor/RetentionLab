/**
 * Decisions Insights Controller
 * Provides dynamic decision data from session evaluations and coaching feedback
 */
const { db } = require('../../database/db');

const controller = {
  /**
   * GET /api/insights/decisions
   * Get decisions and recommendations from sessions
   */
  async getDecisions(req, res) {
    try {
      const user = req.user;
      const { from_date, to_date, instructor_id, decision_type } = req.body;

      // Get decisions from session final evaluations (recommended_action field)
      let sql = `
        SELECT 
          sfe.id,
          sfe.session_id,
          sfe.recommended_action as decision_text,
          sfe.summary_narrative as context,
          sfe.overall_session_rating,
          sfe.teacher_performance,
          sfe.student_engagement,
          sfe.learning_impact,
          sfe.parent_communication_readiness,
          m.title as meeting_title,
          m.scheduled_start_time as meeting_date,
          CONCAT(u.first_name, ' ', u.last_name) as instructor_name,
          u.id as instructor_id
        FROM session_final_evaluation sfe
        JOIN meeting_sessions ms ON ms.id = sfe.session_id
        JOIN meetings m ON m.id = ms.meeting_id
        JOIN users u ON LOWER(u.email) = LOWER(m.calendar_account)
        WHERE 1=1
          AND sfe.recommended_action IS NOT NULL
          AND sfe.recommended_action != ''
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

      // Filter by decision type (based on overall_session_rating)
      if (decision_type) {
        if (decision_type === 'positive') {
          sql += ' AND sfe.overall_session_rating IN ("Excellent", "Good")';
        } else if (decision_type === 'improvement') {
          sql += ' AND sfe.overall_session_rating IN ("Average", "Needs Improvement")';
        }
      }

      sql += ' ORDER BY m.scheduled_start_time DESC LIMIT 100';

      const decisions = await new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows || []));
      });

      // Also get decisions from teacher coaching feedback
      let coachingSql = `
        SELECT 
          tcf.id,
          tcf.meeting_id,
          tcf.recommended_action as decision_text,
          'coaching' as decision_source,
          'medium' as priority,
          'pending' as status,
          m.title as meeting_title,
          m.scheduled_start_time as meeting_date,
          CONCAT(u.first_name, ' ', u.last_name) as instructor_name,
          u.id as instructor_id
        FROM teacher_coaching_feedback tcf
        JOIN meetings m ON m.id = tcf.meeting_id
        JOIN users u ON LOWER(u.email) = LOWER(m.calendar_account)
        WHERE 1=1
          AND tcf.recommended_action IS NOT NULL
          AND tcf.recommended_action != ''
      `;
      const coachingParams = [];

      if (user.role_name === 'admin') {
        coachingSql += ' AND u.company_id = ?';
        coachingParams.push(user.company_id);
      }
      if (from_date) {
        coachingSql += ' AND m.scheduled_start_time >= ?';
        coachingParams.push(from_date + ' 00:00:00');
      }
      if (to_date) {
        coachingSql += ' AND m.scheduled_start_time <= ?';
        coachingParams.push(to_date + ' 23:59:59');
      }
      if (instructor_id) {
        coachingSql += ' AND u.id = ?';
        coachingParams.push(parseInt(instructor_id));
      }

      coachingSql += ' ORDER BY m.scheduled_start_time DESC LIMIT 100';

      const coachingDecisions = await new Promise((resolve, reject) => {
        db.all(coachingSql, coachingParams, (err, rows) => err ? reject(err) : resolve(rows || []));
      });

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