/**
 * models/DepartmentsModel.js
 * Department CRUD and member management.
 */
const { db } = require('../database/db');
const { logger } = require('../utils/logger');

class DepartmentsModel {
  /** List departments for a company (excludes soft-deleted) */
  static listByCompany(companyId) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT d.*, (SELECT COUNT(*) FROM department_members dm WHERE dm.department_id = d.id AND dm.deleted_at IS NULL) as member_count
         FROM departments d
         WHERE d.company_id = ? AND d.deleted_at IS NULL
         ORDER BY d.created_at DESC`,
        [companyId],
        (err, rows) => err ? reject(err) : resolve(rows || [])
      );
    });
  }

  /** Get a single department by ID */
  static getById(id) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT * FROM departments WHERE id = ? AND deleted_at IS NULL`,
        [id],
        (err, row) => err ? reject(err) : resolve(row || null)
      );
    });
  }

  /** Create a department */
  static create({ name, description, company_id, created_by }) {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO departments (name, description, company_id, created_by, created_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [name, description || null, company_id, created_by || null],
        function(err) {
          if (err) { logger.error('DepartmentsModel.create:', err); return reject(err); }
          resolve({ id: this.lastID, name, description, company_id });
        }
      );
    });
  }

  /** Update department name/description */
  static update(id, { name, description, updated_by }) {
    return new Promise((resolve, reject) => {
      const fields = [];
      const params = [];
      if (name !== undefined) { fields.push('name = ?'); params.push(name); }
      if (description !== undefined) { fields.push('description = ?'); params.push(description); }
      if (!fields.length) return resolve({ updated: false });
      fields.push('updated_by = ?', 'updated_at = CURRENT_TIMESTAMP');
      params.push(updated_by || null, id);
      db.run(`UPDATE departments SET ${fields.join(', ')} WHERE id = ? AND deleted_at IS NULL`, params, function(err) {
        if (err) { logger.error('DepartmentsModel.update:', err); return reject(err); }
        resolve({ updated: this.changes > 0 });
      });
    });
  }

  /** Soft delete a department */
  static softDelete(id, deleted_by) {
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE departments SET deleted_at = CURRENT_TIMESTAMP, deleted_by = ? WHERE id = ? AND deleted_at IS NULL`,
        [deleted_by || null, id],
        function(err) {
          if (err) { logger.error('DepartmentsModel.softDelete:', err); return reject(err); }
          resolve({ deleted: this.changes > 0 });
        }
      );
    });
  }

  /** Get members of a department with user details */
  static getMembers(departmentId) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT u.id, u.first_name, u.last_name, u.email, u.status, r.role_name,
                dm.id as member_id, dm.joined_at
         FROM department_members dm
         JOIN users u ON u.id = dm.user_id
         LEFT JOIN roles r ON r.id = u.role_id
         WHERE dm.department_id = ? AND dm.deleted_at IS NULL AND u.deleted_at IS NULL
         ORDER BY dm.joined_at DESC`,
        [departmentId],
        (err, rows) => err ? reject(err) : resolve(rows || [])
      );
    });
  }

  /** Add a member to a department */
  static addMember(departmentId, userId) {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO department_members (department_id, user_id, joined_at) VALUES (?, ?, CURRENT_TIMESTAMP)`,
        [departmentId, userId],
        function(err) {
          if (err) {
            if (err.message.includes('UNIQUE')) return reject(new Error('User is already a member of this department'));
            logger.error('DepartmentsModel.addMember:', err);
            return reject(err);
          }
          resolve({ id: this.lastID });
        }
      );
    });
  }

  /** Remove a member from a department */
  static removeMember(departmentId, userId) {
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE department_members SET deleted_at = CURRENT_TIMESTAMP WHERE department_id = ? AND user_id = ? AND deleted_at IS NULL`,
        [departmentId, userId],
        function(err) {
          if (err) { logger.error('DepartmentsModel.removeMember:', err); return reject(err); }
          resolve({ removed: this.changes > 0 });
        }
      );
    });
  }
}

module.exports = DepartmentsModel;