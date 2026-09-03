/**
 * models/reports/TeamReportModel.js
 * Data access for the team performance reports dashboard.
 * All SQL lives here; controllers only call these methods.
 */
const { db } = require('../../database/db');
const { logger } = require('../../utils/logger');

class TeamReportModel {
  /**
   * Get team membership (departments with active member user ids) for the company.
   * @param {object} user - { role_name, company_id }
   * @returns {Promise<Array>} [{ team_id, team_name, user_id }]
   */
  static getTeams(user) {
    return new Promise((resolve, reject) => {
      let sql = `
        SELECT d.id as team_id, d.name as team_name, dm.user_id
        FROM departments d
        LEFT JOIN department_members dm
          ON dm.department_id = d.id AND dm.status = 'active' AND dm.deleted_at IS NULL
        LEFT JOIN users u ON u.id = dm.user_id AND u.status = 'active' AND u.is_deleted = 0
        WHERE d.deleted_at IS NULL
      `;
      const params = [];
      if (user.role_name === 'admin') {
        sql += ' AND d.company_id = ?';
        params.push(user.company_id);
      }
      sql += ' ORDER BY d.name ASC';
      db.all(sql, params, (err, rows) => {
        if (err) {
          logger.error('Model(TeamReportModel): Error fetching teams:', err);
          return reject(err);
        }
        resolve(rows || []);
      });
    });
  }

  /**
   * Get meeting scores (with reviewer + instructor info) within the date range.
   * @param {object} filters - { from_date, to_date, instructor_id, days }
   * @returns {Promise<Array>} [{ reviewer_id, instructor_id, score, score_type, scored_at }]
   */
  static getScores(filters = {}) {
    return new Promise((resolve, reject) => {
      const { from_date, to_date, instructor_id, days = 30 } = filters;
      let sql = `
        SELECT ms.reviewer_id, ms.score, ms.score_type, ms.scored_at,
               u_instr.id as instructor_id
        FROM meeting_session_scores ms
        JOIN meetings m ON m.id = ms.meeting_id
        LEFT JOIN users u_instr ON LOWER(u_instr.email) = LOWER(m.calendar_account)
        WHERE 1=1
      `;
      const params = [];
      if (from_date && to_date) {
        sql += ' AND ms.scored_at >= ? AND ms.scored_at <= ?';
        params.push(from_date + ' 00:00:00', to_date + ' 23:59:59');
      } else {
        sql += ' AND ms.scored_at >= DATE_SUB(NOW(), INTERVAL ? DAY)';
        params.push(parseInt(days, 10));
      }
      if (instructor_id) {
        sql += ' AND u_instr.id = ?';
        params.push(parseInt(instructor_id, 10));
      }
      db.all(sql, params, (err, rows) => {
        if (err) {
          logger.error('Model(TeamReportModel): Error fetching team scores:', err);
          return reject(err);
        }
        resolve(rows || []);
      });
    });
  }

/**
   * Aggregate team performance (member count, avg score, score count, bins).
   * @param {object} user - { role_name, company_id }
   * @param {object} filters - { from_date, to_date, instructor_id }
   * @returns {Promise<{ teams: Array, stats: object }>}
   */
  static async getTeamPerformance(user, filters = {}) {
    const [teamRows, scores] = await Promise.all([
      TeamReportModel.getTeams(user),
      TeamReportModel.getScores(filters)
    ]);

    // Membership map: user_id -> teamId, and teamId -> aggregation bucket.
    const userTeam = {};
    const teamMap = {};
    teamRows.forEach((r) => {
      if (!teamMap[r.team_id]) {
        teamMap[r.team_id] = {
          id: r.team_id,
          name: r.team_name || 'Team',
          memberCount: 0,
          scoreCount: 0,
          sum: 0,
          high: 0,
          medium: 0,
          low: 0
        };
      }
      if (r.user_id) {
        teamMap[r.team_id].memberCount++;
        userTeam[r.user_id] = r.team_id;
      }
    });

    // Attribute each score to a user's team via reviewer_id.
    scores.forEach((s) => {
      const uid = Number(s.reviewer_id);
      const teamId = userTeam[uid];
      if (!teamId || !teamMap[teamId]) return;
      const t = teamMap[teamId];
      const v = Number(s.score) || 0;
      t.scoreCount++;
      t.sum += v;
      if (v >= 4) t.high++;
      else if (v >= 3) t.medium++;
      else t.low++;
    });

    const teams = Object.values(teamMap).map((t) => ({
      name: t.name,
      memberCount: t.memberCount,
      scoreCount: t.scoreCount,
      avgScore: t.scoreCount ? (t.sum / t.scoreCount).toFixed(1) : '0.0',
      high: t.high,
      medium: t.medium,
      low: t.low,
      participation: t.memberCount ? Math.round((t.scoreCount / Math.max(t.memberCount, 1)) * 100) : 0
    }));

    const totalMembers = teams.reduce((a, t) => a + t.memberCount, 0);
    const totalScores = teams.reduce((a, t) => a + t.scoreCount, 0);
    const avgPerformance = totalScores
      ? (teams.reduce((a, t) => a + (Number(t.avgScore) * t.scoreCount), 0) / totalScores).toFixed(1)
      : '0.0';

    return {
      teams,
      stats: {
        totalTeams: teams.length,
        totalMembers,
        avgPerformance,
        growthRate: '0.0'
      }
    };
  }

  /**
   * Active + calendar-connected instructors for the filter dropdown.
   * @param {object} user - { role_name, company_id }
   * @returns {Promise<Array>} [{ id, name, email }]
   */
  static getInstructors(user) {
    return new Promise((resolve, reject) => {
      let sql = `
        SELECT DISTINCT
          u.id,
          CONCAT(u.first_name, ' ', u.last_name) as name,
          u.email
        FROM users u
        JOIN roles r ON r.id = u.role_id
        LEFT JOIN calendar_connections cc ON cc.user_id = u.id
        WHERE r.role_name = 'instructor'
          AND u.status = 'active'
          AND u.is_deleted = 0
          AND cc.id IS NOT NULL
      `;
      const params = [];
      if (user.role_name === 'admin') {
        sql += ' AND u.company_id = ?';
        params.push(user.company_id);
      }
      sql += ' ORDER BY u.first_name, u.last_name';
      db.all(sql, params, (err, rows) => {
        if (err) {
          logger.error('Model(TeamReportModel): Error fetching instructors:', err);
          return reject(err);
        }
        resolve(rows || []);
      });
    });
  }

}

module.exports = TeamReportModel;