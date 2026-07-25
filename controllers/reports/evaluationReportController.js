/**
 * controllers/evaluationReportController.js
 * Business logic for evaluation reports dashboard.
 */

const { db } = require('../../database/db');

function ok(data, msg) { return { success: true, message: msg || null, ...(data || {}) }; }
function err(msg, code) { return { success: false, error: msg, statusCode: code || 500 }; }

const controller = {
  /**
   * GET /api/evaluations/reports/summary
   * Returns evaluation statistics for the reports dashboard
   */
  async getSummary(req) {
    try {
      const days = parseInt(req.query.days) || 30;
      const companyId = req.user?.company_id;

      // Get scores with meeting and reviewer info
      const scoresSql = `
        SELECT ms.*, 
               m.title as meeting_title, 
               m.platform, 
               m.start_time as meeting_date,
               CONCAT(u.first_name, ' ', u.last_name) as reviewer_name
        FROM meeting_scores ms
        LEFT JOIN meetings m ON m.meeting_id = ms.meeting_id
        LEFT JOIN users u ON u.id = ms.reviewer_id
        WHERE ms.scored_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
           OR ms.scored_at IS NULL
        ORDER BY ms.scored_at DESC
        LIMIT 500
      `;

      const scores = await new Promise((resolve, reject) => {
        db.all(scoresSql, [days], (err, rows) => err ? reject(err) : resolve(rows || []));
      });

      // Get meetings list
      const meetingsSql = `
        SELECT m.*,
               CONCAT(u.first_name, ' ', u.last_name) as owner_name,
               u.email as owner_email
        FROM meetings m
        LEFT JOIN users u ON u.id = m.owner_user_id
        WHERE m.start_time >= DATE_SUB(NOW(), INTERVAL ? DAY)
           OR m.start_time IS NULL
        ORDER BY m.start_time DESC
        LIMIT 100
      `;

      const meetings = await new Promise((resolve, reject) => {
        db.all(meetingsSql, [days], (err, rows) => err ? reject(err) : resolve(rows || []));
      });

      // Calculate stats
      const aiScores = scores.filter(s => s.score_type === 'AI');
      const humanScores = scores.filter(s => s.score_type === 'HUMAN');

      const avgAi = aiScores.length ? (aiScores.reduce((sum, s) => sum + (+s.score || 0), 0) / aiScores.length).toFixed(1) : '0.0';
      const avgHuman = humanScores.length ? (humanScores.reduce((sum, s) => sum + (+s.score || 0), 0) / humanScores.length).toFixed(1) : '0.0';

      // Count unique rubrics/categories
      const rubricGroups = new Set(scores.map(s => s.category_id || s.rubric_id).filter(Boolean));
      
      // Count unique reviewers
      const reviewerIds = new Set(scores.map(s => s.reviewer_id).filter(Boolean));

      return ok({
        scores,
        meetings,
        stats: {
          totalMeetings: meetings.length,
          totalScores: scores.length,
          avgAiScore: avgAi,
          avgHumanScore: avgHuman,
          totalRubrics: rubricGroups.size,
          totalReviewers: reviewerIds.size
        }
      });
    } catch (e) {
      return err(e.message);
    }
  }
};

module.exports = controller;