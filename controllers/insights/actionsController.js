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

      // Get action items from teacher coaching feedback
      let sql = `
        SELECT
          tcf.id,
          tcf.meeting_id,
          tcf.recommended_action as action_text,
          'medium' as priority,
          'pending' as status,
          tcf.created_at,
          m.title as meeting_title,
          m.scheduled_start_time as meeting_date,
          CONCAT(u.first_name, ' ', u.last_name) as instructor_name,
          u.id as instructor_id
        FROM teacher_coaching_feedback tcf
        JOIN meetings m ON m.id = tcf.meeting_id
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

      // Filter by status (tables don't have status column - all are pending)
      // Only filter if status is not 'pending'
      if (status && status !== 'pending') {
        sql += ' AND 1=0';
      }

      sql += ' ORDER BY tcf.created_at DESC LIMIT 100';

      const actionItems = await ActionsModel.getCoachingActionItems(user, { from_date, to_date, instructor_id, status });

      // Also get better alternatives as action items
      let altSql = `
        SELECT
          tba.id,
          tba.meeting_id,
          tba.better_alternative as action_text,
          'medium' as priority,
          'pending' as status,
          tba.created_at,
          m.title as meeting_title,
          m.scheduled_start_time as meeting_date,
          CONCAT(u.first_name, ' ', u.last_name) as instructor_name,
          u.id as instructor_id
        FROM teacher_better_alternatives tba
        JOIN meetings m ON m.id = tba.meeting_id
        JOIN users u ON LOWER(u.email) = LOWER(m.calendar_account)
        WHERE 1=1
      `;
      const altParams = [...params];

      if (user.role_name === 'admin') {
        altSql += ' AND u.company_id = ?';
        altParams.push(user.company_id);
      }
      if (from_date) {
        altSql += ' AND m.scheduled_start_time >= ?';
        altParams.push(from_date + ' 00:00:00');
      }
      if (to_date) {
        altSql += ' AND m.scheduled_start_time <= ?';
        altParams.push(to_date + ' 23:59:59');
      }
      if (instructor_id) {
        altSql += ' AND u.id = ?';
        altParams.push(parseInt(instructor_id));
      }
      // Filter by status (tables don't have status column - all are pending)
      if (status && status !== 'pending') {
        altSql += ' AND 1=0';
      }

      altSql += ' ORDER BY tba.created_at DESC LIMIT 100';

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
