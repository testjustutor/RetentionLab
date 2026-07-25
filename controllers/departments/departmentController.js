/**
 * controllers/departmentController.js
 * Business logic for department CRUD and member management.
 */

const DepartmentsModel = require('../../models/departments/DepartmentsModel');

function ok(data, msg) { return { success: true, message: msg || null, ...(data || {}) }; }
function err(msg, code) { return { success: false, error: msg, statusCode: code || 500 }; }

const departmentController = {
  /** List departments for the current user's company */
  async list(req) {
    try {
      const companyId = req.user.company_id;
      if (!companyId) return err('No company associated', 400);
      const rows = await DepartmentsModel.listByCompany(companyId);
      return ok({ count: rows.length, data: rows });
    } catch (e) { return err(e.message); }
  },

  /** Get single department with members */
  async getById(req) {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return err('Invalid department ID', 400);
      const dept = await DepartmentsModel.getById(id);
      if (!dept) return err('Department not found', 404);
      if (dept.company_id !== req.user.company_id) return err('Forbidden', 403);
      const members = await DepartmentsModel.getMembers(id);
      return ok({ department: dept, members });
    } catch (e) { return err(e.message); }
  },

  /** Create department */
  async create(req) {
    try {
      const { name, description } = req.body;
      if (!name) return err('Name is required', 400);
      const companyId = req.user.company_id;
      if (!companyId) return err('No company associated', 400);
      const result = await DepartmentsModel.create({ name, description, company_id: companyId, created_by: req.user.id });
      return ok({ data: result }, 'Department created', 201);
    } catch (e) { return err(e.message); }
  },

  /** Update department */
  async update(req) {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return err('Invalid department ID', 400);
      const dept = await DepartmentsModel.getById(id);
      if (!dept) return err('Department not found', 404);
      if (dept.company_id !== req.user.company_id) return err('Forbidden', 403);
      const { name, description } = req.body;
      const result = await DepartmentsModel.update(id, { name, description, updated_by: req.user.id });
      return ok({ result }, 'Department updated');
    } catch (e) { return err(e.message); }
  },

  /** Delete department */
  async delete(req) {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return err('Invalid department ID', 400);
      const dept = await DepartmentsModel.getById(id);
      if (!dept) return err('Department not found', 404);
      if (dept.company_id !== req.user.company_id) return err('Forbidden', 403);
      const result = await DepartmentsModel.softDelete(id, req.user.id);
      return ok({ result }, 'Department deleted');
    } catch (e) { return err(e.message); }
  },

  /** Get members of a department */
  async listMembers(req) {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return err('Invalid department ID', 400);
      const dept = await DepartmentsModel.getById(id);
      if (!dept) return err('Department not found', 404);
      if (dept.company_id !== req.user.company_id) return err('Forbidden', 403);
      const members = await DepartmentsModel.getMembers(id);
      return ok({ count: members.length, data: members });
    } catch (e) { return err(e.message); }
  },

  /** Add member to department */
  async addMember(req) {
    try {
      const deptId = parseInt(req.params.id);
      const userId = parseInt(req.body.user_id);
      if (isNaN(deptId) || isNaN(userId)) return err('Invalid IDs', 400);
      const dept = await DepartmentsModel.getById(deptId);
      if (!dept) return err('Department not found', 404);
      if (dept.company_id !== req.user.company_id) return err('Forbidden', 403);
      const result = await DepartmentsModel.addMember(deptId, userId);
      return ok({ data: result }, 'Member added', 201);
    } catch (e) { return err(e.message); }
  },

  /** Remove member from department */
  async removeMember(req) {
    try {
      const deptId = parseInt(req.params.id);
      const userId = parseInt(req.params.userId);
      if (isNaN(deptId) || isNaN(userId)) return err('Invalid IDs', 400);
      const dept = await DepartmentsModel.getById(deptId);
      if (!dept) return err('Department not found', 404);
      if (dept.company_id !== req.user.company_id) return err('Forbidden', 403);
      const result = await DepartmentsModel.removeMember(deptId, userId);
      return ok({ result }, 'Member removed');
    } catch (e) { return err(e.message); }
  },
};

module.exports = departmentController;