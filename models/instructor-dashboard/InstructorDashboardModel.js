/**
 * root/models/InstructorDashboardModel.js
 */
const { db } = require('../../database/db');
const { logger } = require('../../utils/logger');

class InstructorDashboardModel {
  static async getDashboardStats(userId) {
    try {
      // Upcoming meetings (status not completed, owned by this user)
      const upcomingMeetings = await new Promise((resolve, reject) => {
        db.get(
          `SELECT COUNT(*) as count FROM meetings WHERE owner_user_id = ? AND status NOT IN ('completed', 'cancelled', 'stopped')`,
          [userId],
          (err, row) => err ? reject(err) : resolve(row?.count || 0)
        );
      });

      // Completed sessions (from meeting_sessions joined with meetings owned by user)
      const completedSessions = await new Promise((resolve, reject) => {
        db.get(
          `SELECT COUNT(*) as count FROM meeting_sessions ms JOIN meetings m ON m.meeting_id = ms.meeting_id WHERE m.owner_user_id = ? AND ms.end_time IS NOT NULL`,
          [userId],
          (err, row) => err ? reject(err) : resolve(row?.count || 0)
        );
      });

      // Average OQI score from meeting_assets for user's meetings
      const avgScore = await new Promise((resolve, reject) => {
        db.get(
          `SELECT AVG(ma.oqi_score) as avgScore FROM meeting_assets ma JOIN meetings m ON m.meeting_id = ma.meeting_id WHERE m.owner_user_id = ? AND ma.oqi_score IS NOT NULL`,
          [userId],
          (err, row) => err ? reject(err) : resolve(row?.avgScore ? parseFloat(row.avgScore).toFixed(1) : 0)
        );
      });

      // Content generated (assets with any file path for user's meetings)
      const contentGenerated = await new Promise((resolve, reject) => {
        db.get(
          `SELECT COUNT(*) as count FROM meeting_assets ma JOIN meetings m ON m.meeting_id = ma.meeting_id WHERE m.owner_user_id = ? AND (ma.transcript_path IS NOT NULL OR ma.summary_path IS NOT NULL OR ma.audio_path IS NOT NULL)`,
          [userId],
          (err, row) => err ? reject(err) : resolve(row?.count || 0)
        );
      });

      // Total meetings count
      const totalMeetings = await new Promise((resolve, reject) => {
        db.get(
          `SELECT COUNT(*) as count FROM meetings WHERE owner_user_id = ?`,
          [userId],
          (err, row) => err ? reject(err) : resolve(row?.count || 0)
        );
      });

      return {
        upcomingMeetings,
        completedSessions,
        avgScore: typeof avgScore === 'number' ? avgScore : parseFloat(avgScore) || 0,
        contentGenerated,
        totalMeetings
      };
    } catch (err) {
      logger.error('InstructorDashboardModel getDashboardStats error:', err);
      throw err;
    }
  }

  static async getRecentMeetings(userId, limit = 5) {
    try {
      return await new Promise((resolve, reject) => {
        db.all(
          `SELECT m.meeting_id, m.title, m.platform, m.start_time, m.status, ma.oqi_score
           FROM meetings m
           LEFT JOIN meeting_assets ma ON ma.meeting_id = m.meeting_id
           WHERE m.owner_user_id = ?
           ORDER BY m.created_at DESC
           LIMIT ?`,
          [userId, limit],
          (err, rows) => err ? reject(err) : resolve(rows || [])
        );
      });
    } catch (err) {
      logger.error('InstructorDashboardModel getRecentMeetings error:', err);
      throw err;
    }
  }

  static async getScoreTrend(userId, limit = 7) {
    try {
      return await new Promise((resolve, reject) => {
        db.all(
          `SELECT m.start_time, ma.oqi_score
           FROM meetings m
           JOIN meeting_assets ma ON ma.meeting_id = m.meeting_id
           WHERE m.owner_user_id = ? AND ma.oqi_score IS NOT NULL
           ORDER BY m.start_time DESC
           LIMIT ?`,
          [userId, limit],
          (err, rows) => err ? reject(err) : resolve(rows || [])
        );
      });
    } catch (err) {
      logger.error('InstructorDashboardModel getScoreTrend error:', err);
      throw err;
    }
  }

  static async getEvaluationBreakdown(userId) {
    try {
      return await new Promise((resolve, reject) => {
        db.all(
          `SELECT sfe.overall_session_rating, sfe.teacher_performance, sfe.student_engagement, sfe.learning_impact
           FROM session_final_evaluation sfe
           JOIN meetings m ON m.meeting_id = sfe.meeting_id
           WHERE m.owner_user_id = ?
           ORDER BY sfe.created_at DESC
           LIMIT 10`,
          [userId],
          (err, rows) => err ? reject(err) : resolve(rows || [])
        );
      });
    } catch (err) {
      logger.error('InstructorDashboardModel getEvaluationBreakdown error:', err);
      throw err;
    }
  }
}

module.exports = { InstructorDashboardModel };
