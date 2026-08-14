/**
 * controllers/settings/organizationController.js
 * Business logic for the organization settings page.
 * Controllers never write SQL - all DB access goes through Models.
 */
const OrganizationModel = require('../../models/settings/OrganizationModel');

function ok(data, msg) { return { success: true, message: msg || null, ...(data || {}) }; }
function err(msg, code) { return { success: false, error: msg, statusCode: code || 500 }; }

const controller = {
  /**
   * GET /api/admin/settings/organization
   * Return company profile + organization stats + departments.
   */
  async get(req) {
    try {
      const [profile, stats, departments] = await Promise.all([
        OrganizationModel.getProfile(req.user),
        OrganizationModel.getStats(req.user),
        OrganizationModel.getDepartments(req.user)
      ]);
      return ok({ profile, stats, departments });
    } catch (e) {
      return err(e.message);
    }
  },

  /**
   * PUT /api/admin/settings/organization
   * Company profile is FIXED / read-only. Admins can view but never modify it,
   * so this endpoint always rejects changes (403).
   */
  async update() {
    return err('Company profile is read-only and managed by RetentionLab', 403);
  }
};

module.exports = controller;