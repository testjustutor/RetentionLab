/**
 * models/settings/OrganizationModel.js
 * Data access for the organization settings page.
 * All SQL lives here; controllers only call these methods.
 */
const { db } = require('../../database/db');
const { logger } = require('../../utils/logger');
const CompaniesModel = require('../companies/CompaniesModel');

class OrganizationModel {
  /**
   * Get the current user's company profile row.
   * @param {object} user - { role_name, company_id }
   * @returns {Promise<object|null>}
   */
  static getProfile(user) {
    if (!user.company_id) return Promise.resolve(null);
    return CompaniesModel.getCompanyById(user.company_id);
  }

  /**
   * Get organization-level counts. Company-scoped for admins.
   * @param {object} user - { role_name, company_id }
   * @returns {Promise<object>} { totalUsers, activeInstructors, totalDepartments, totalMeetings, totalScores }
   */
  static getStats(user) {
    return (async () => {
      const isAdmin = user.role_name === 'admin' && user.company_id;
      const cid = user.company_id;

      const run = (sql, params) => new Promise((res, rej) =>
        db.get(sql, params, (err, row) => err ? rej(err) : res(row || {})));

      let sql = 'SELECT COUNT(*) c FROM users WHERE is_deleted = 0' + (isAdmin ? ' AND company_id = ?' : '');
      const totalUsers = (await run(sql, isAdmin ? [cid] : [])).c || 0;

      sql = 'SELECT COUNT(*) c FROM users u JOIN roles r ON r.id = u.role_id ' +
        'WHERE u.status = ' + "'active'" + ' AND u.is_deleted = 0 ' +
        "AND r.role_name IN ('instructor', 'solo_instructor')" + (isAdmin ? ' AND u.company_id = ?' : '');
      const activeInstructors = (await run(sql, isAdmin ? [cid] : [])).c || 0;

      sql = 'SELECT COUNT(*) c FROM departments WHERE deleted_at IS NULL' + (isAdmin ? ' AND company_id = ?' : '');
      const totalDepartments = (await run(sql, isAdmin ? [cid] : [])).c || 0;

      sql = 'SELECT COUNT(*) c FROM meetings m JOIN users u ON LOWER(u.email) = LOWER(m.calendar_account) WHERE 1=1' + (isAdmin ? ' AND u.company_id = ?' : '');
      const totalMeetings = (await run(sql, isAdmin ? [cid] : [])).c || 0;

      sql = 'SELECT COUNT(*) c FROM meeting_scores ms JOIN meetings m ON m.id = ms.meeting_id JOIN users u ON LOWER(u.email) = LOWER(m.calendar_account) WHERE 1=1' + (isAdmin ? ' AND u.company_id = ?' : '');
      const totalScores = (await run(sql, isAdmin ? [cid] : [])).c || 0;

      return { totalUsers, activeInstructors, totalDepartments, totalMeetings, totalScores };
    })();
  }

  /**
   * Get departments with member counts. Company-scoped for admins.
   * @param {object} user - { role_name, company_id }
   * @returns {Promise<Array>} [{ id, name, member_count }]
   */
  static getDepartments(user) {
    return new Promise((resolve, reject) => {
      const isAdmin = user.role_name === 'admin' && user.company_id;
      let sql = `
        SELECT d.id, d.name, COUNT(dm.user_id) as member_count
        FROM departments d
        LEFT JOIN department_members dm
          ON dm.department_id = d.id AND dm.status = 'active' AND dm.deleted_at IS NULL
        WHERE d.deleted_at IS NULL
      `;
      const params = [];
      if (isAdmin) {
        sql += ' AND d.company_id = ?';
        params.push(user.company_id);
      }
      sql += ' GROUP BY d.id, d.name ORDER BY d.name';
      db.all(sql, params, (err, rows) => {
        if (err) {
          logger.error('Model(OrganizationModel): Error fetching departments:', err);
          return reject(err);
        }
        resolve(rows || []);
      });
    });
  }

  /**
   * Update the current user's company profile (whitelisted fields).
   * @param {object} user - { company_id }
   * @param {object} fields - raw body fields
   * @returns {Promise<object|null>} updated company row or null if none
   */
  static updateProfile(user, fields) {
    const allowed = ['company_name', 'company_code', 'domain', 'logo_url', 'status'];
    const changes = {};
    allowed.forEach((k) => {
      if (fields[k] !== undefined) changes[k] = fields[k];
    });
    if (!user.company_id) return Promise.resolve(null);
    return CompaniesModel.getCompanyById(user.company_id).then((company) => {
      if (!company) return null;
      return CompaniesModel.updateCompany(company.id, changes)
        .then(() => CompaniesModel.getCompanyById(company.id));
    });
  }
}

module.exports = OrganizationModel;