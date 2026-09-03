/**
 * Action Items Insights Controller
 * Provides dynamic action items from coaching feedback and session quality data
 */
const ActionsModel = require('../../models/insights/ActionsModel');

const controller = {
  /**
   * GET /api/insights/actions
   * Get action items and coaching recommendations
   */
  async getActionItems(req, res) {
    try {
      const user = req.user;
      const { from_date, to_date, instructor_id, status } = req.body;

      // Get action items from teacher coaching feedback (SQL lives in ActionsModel)
      const actionItems = await ActionsModel.getCoachingActionItems(user, { from_date, to_date, instructor_id, status });

      // Get better alternatives as action items (SQL lives in ActionsModel)
      const alternatives = await ActionsModel.getBetterAlternatives(user, { from_date, to_date, instructor_id, status });

      // Combine and deduplicate
      const allActions = [
        ...actionItems.map(item => ({ ...item, type: 'coaching_feedback' })),
        ...alternatives.map(item => ({ ...item, type: 'better_alternative' }))
      ];

      // Calculate summary statistics
      const totalActions = allActions.length;
      const pendingActions = allActions.filter(a => a.status === 'pending').length;
      const inProgressActions = allActions.filter(a => a.status === 'in_progress').length;
      const completedActions = allActions.filter(a => a.status === 'completed').length;

      // Priority distribution
      const priorityDistribution = { high: 0, medium: 0, low: 0 };
      allActions.forEach(action => {
        const priority = (action.priority || 'medium').toLowerCase();
        if (priorityDistribution.hasOwnProperty(priority)) {
          priorityDistribution[priority]++;
        } else {
          priorityDistribution.medium++;
        }
      });

      // Instructor-wise breakdown
      const instructorStats = {};
      allActions.forEach(action => {
        const instructorId = action.instructor_id;
        if (!instructorStats[instructorId]) {
          instructorStats[instructorId] = {
            instructor_id: instructorId,
            instructor_name: action.instructor_name,
            total_actions: 0,
            pending: 0,
            in_progress: 0,
            completed: 0
          };
        }
        instructorStats[instructorId].total_actions++;
        if (action.status === 'pending') instructorStats[instructorId].pending++;
        else if (action.status === 'in_progress') instructorStats[instructorId].in_progress++;
        else if (action.status === 'completed') instructorStats[instructorId].completed++;
      });

      const instructorBreakdown = Object.values(instructorStats);

      // Recent action items (last 10)
      const recentActions = allActions.slice(0, 10).map(action => ({
        id: action.id,
        type: action.type,
        action_text: action.action_text,
        priority: action.priority,
        status: action.status,
        meeting_title: action.meeting_title,
        meeting_date: action.meeting_date,
        instructor_name: action.instructor_name,
        created_at: action.created_at
      }));

      res.json({
        success: true,
        summary: {
          total_actions: totalActions,
          pending: pendingActions,
          in_progress: inProgressActions,
          completed: completedActions,
          priority_distribution: priorityDistribution
        },
        instructor_breakdown: instructorBreakdown,
        recent_actions: recentActions
      });
    } catch (err) {
      console.error('Action items insights error:', err);
      res.status(500).json({ error: err.message, success: false });
    }
  }
};

module.exports = controller;
