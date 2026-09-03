/**
 * controllers/headerConfigController.js
 * Header configuration logic.
 */
const { HeaderConfigModel } = require('../../models/header/HeaderConfigModel');
const RolesModel = require('../../models/roles/RolesModel');

const ok = (res, data, status = 200) => res.status(status).json({ success: true, ...data });
const fail = (res, message, status = 400) => res.status(status).json({ success: false, error: message });
const serverErr = (res, err, context) => {
  console.error(`[HeaderConfig] ${context}:`, err);
  return res.status(500).json({ success: false, error: err.message || 'Internal server error' });
};

function parseRoleId(raw) {
  const id = parseInt(raw, 10);
  return (!isNaN(id) && id > 0) ? id : null;
}

const controller = {
  async getRoles(req, res) {
    try {
      const roles = await RolesModel.getAllRoles();
      return ok(res, { roles });
    } catch (err) {
      return serverErr(res, err, 'getRoles');
    }
  },

  async getFullConfigByRoleId(req, res) {
    const roleId = parseRoleId(req.params.roleId);
    if (!roleId) return fail(res, 'roleId must be a positive integer');
    try {
      const config = await HeaderConfigModel.getFullConfigByRoleId(roleId);
      if (!config) return fail(res, `No header config found for role id ${roleId}`, 404);
      return ok(res, { config });
    } catch (err) {
      return serverErr(res, err, 'getFullConfigByRoleId');
    }
  },

  async getFullConfigByRoleName(req, res) {
    const { roleName } = req.params;
    if (!roleName || typeof roleName !== 'string') return fail(res, 'roleName is required');
    try {
      const config = await HeaderConfigModel.getFullConfigByRoleName(roleName);
      if (!config) return fail(res, `No header config found for role "${roleName}"`, 404);
      return ok(res, { config });
    } catch (err) {
      return serverErr(res, err, 'getFullConfigByRoleName');
    }
  },

  async getMyConfig(req, res) {
    const roleId = parseRoleId(req.user?.role_id);
    const roleName = req.user?.role_name;
    try {
      let config = null;
      if (roleId) config = await HeaderConfigModel.getFullConfigByRoleId(roleId);
      if (!config && roleName) config = await HeaderConfigModel.getFullConfigByRoleName(roleName);
      if (!config) return fail(res, 'Header config not found for your role', 404);
      return ok(res, { config });
    } catch (err) {
      return serverErr(res, err, 'getFullConfigForUser');
    }
  },

  async getAllNav(req, res) {
    const activeOnly = req.query.activeOnly === 'true';
    try {
      const navConfigs = await HeaderConfigModel.getAllNav({ activeOnly });
      return ok(res, { navConfigs });
    } catch (err) {
      return serverErr(res, err, 'getAllNav');
    }
  },

  async getNavByRoleId(req, res) {
    const roleId = parseRoleId(req.params.roleId);
    if (!roleId) return fail(res, 'roleId must be a positive integer');
    try {
      const navConfig = await HeaderConfigModel.getNavByRoleId(roleId);
      if (!navConfig) return fail(res, `Nav config not found for role id ${roleId}`, 404);
      return ok(res, { navConfig });
    } catch (err) {
      return serverErr(res, err, 'getNavByRoleId');
    }
  },

  async getNavByRoleName(req, res) {
    const { roleName } = req.params;
    if (!roleName) return fail(res, 'roleName is required');
    try {
      const navConfig = await HeaderConfigModel.getNavByRoleName(roleName);
      if (!navConfig) return fail(res, `Nav config not found for role "${roleName}"`, 404);
      return ok(res, { navConfig });
    } catch (err) {
      return serverErr(res, err, 'getNavByRoleName');
    }
  },

  async createNav(req, res) {
    const { roleId: rawRoleId, nav } = req.body;
    const roleId = parseRoleId(rawRoleId);
    if (!roleId) return fail(res, 'roleId must be a positive integer');
    if (!nav || typeof nav !== 'object') return fail(res, 'nav must be an object of nav items');
    try {
      const result = await HeaderConfigModel.createNav(roleId, nav, { createdBy: req.user?.id });
      return ok(res, { result }, 201);
    } catch (err) {
      if (err.message?.includes('UNIQUE')) return fail(res, `Nav config already exists for role id ${roleId}. Use PUT to update.`, 409);
      return serverErr(res, err, 'createNav');
    }
  },

  async updateNav(req, res) {
    const roleId = parseRoleId(req.params.roleId);
    if (!roleId) return fail(res, 'roleId must be a positive integer');
    const { nav, isActive } = req.body;
    const fields = { updatedBy: req.user?.id };
    if (nav !== undefined) fields.nav = nav;
    if (isActive !== undefined) fields.isActive = isActive;
    if (Object.keys(fields).length === 1) return fail(res, 'Provide at least one field to update: nav, isActive');
    try {
      const result = await HeaderConfigModel.updateNav(roleId, fields);
      if (result.changes === 0) return fail(res, `Nav config not found or already deleted for role id ${roleId}`, 404);
      return ok(res, { result });
    } catch (err) {
      return serverErr(res, err, 'updateNav');
    }
  },

  async upsertNav(req, res) {
    const roleId = parseRoleId(req.params.roleId);
    if (!roleId) return fail(res, 'roleId must be a positive integer');
    const { nav } = req.body;
    if (!nav || typeof nav !== 'object') return fail(res, 'nav must be an object of nav items');
    try {
      const result = await HeaderConfigModel.upsertNav(roleId, nav, { userId: req.user?.id });
      return ok(res, { result });
    } catch (err) {
      return serverErr(res, err, 'upsertNav');
    }
  },

  async deleteNav(req, res) {
    const roleId = parseRoleId(req.params.roleId);
    if (!roleId) return fail(res, 'roleId must be a positive integer');
    try {
      const result = await HeaderConfigModel.deleteNav(roleId, req.user?.id);
      if (result.changes === 0) return fail(res, `Nav config not found or already deleted for role id ${roleId}`, 404);
      return ok(res, { result });
    } catch (err) {
      return serverErr(res, err, 'deleteNav');
    }
  },

  async getAllForAdmin(req, res) {
    try {
      const roles = await RolesModel.getAllRoles();
      const grouped = await HeaderConfigModel.getAllPagesGroupedByRole({ activeOnly: false });
      const result = roles.map(role => {
        const group = grouped[role.role_name];
        const pages = group ? Object.values(group.pages) : [];
        return { id: role.id, role_name: role.role_name, description: role.description, pages };
      });
      return ok(res, { roles: result });
    } catch (err) {
      return serverErr(res, err, 'getAllForAdmin');
    }
  },

  async togglePageStatus(req, res) {
    const { roleId: rawRoleId, pageKey, isActive } = req.body;
    const roleId = parseRoleId(rawRoleId);
    if (!roleId) return fail(res, 'roleId must be a positive integer');
    if (!pageKey) return fail(res, 'pageKey is required');
    if (isActive === undefined) return fail(res, 'isActive is required');
    try {
      const result = await HeaderConfigModel.updatePage(roleId, pageKey, { isActive, updatedBy: req.user?.id });
      if (result.changes === 0) return fail(res, `Page config "${pageKey}" not found for role id ${roleId}`, 404);
      return ok(res, { result });
    } catch (err) {
      return serverErr(res, err, 'togglePageStatus');
    }
  },

  async getAllPagesGroupedByRole(req, res) {
    const activeOnly = req.query.activeOnly === 'true';
    try {
      const grouped = await HeaderConfigModel.getAllPagesGroupedByRole({ activeOnly });
      return ok(res, { grouped });
    } catch (err) {
      return serverErr(res, err, 'getAllPagesGroupedByRole');
    }
  },

  async getPagesByRoleId(req, res) {
    const roleId = parseRoleId(req.params.roleId);
    if (!roleId) return fail(res, 'roleId must be a positive integer');
    const activeOnly = req.query.activeOnly === 'true';
    try {
      const pages = await HeaderConfigModel.getPagesByRoleId(roleId, { activeOnly });
      return ok(res, { pages });
    } catch (err) {
      return serverErr(res, err, 'getPagesByRoleId');
    }
  },

  async getPagesByRoleName(req, res) {
    const { roleName } = req.params;
    if (!roleName) return fail(res, 'roleName is required');
    const activeOnly = req.query.activeOnly === 'true';
    try {
      const pages = await HeaderConfigModel.getPagesByRoleName(roleName, { activeOnly });
      return ok(res, { pages });
    } catch (err) {
      return serverErr(res, err, 'getPagesByRoleName');
    }
  },

  async getPageByRoleAndKey(req, res) {
    const roleId = parseRoleId(req.params.roleId);
    if (!roleId) return fail(res, 'roleId must be a positive integer');
    const { pageKey } = req.params;
    if (!pageKey) return fail(res, 'pageKey is required');
    try {
      const page = await HeaderConfigModel.getPageByRoleAndKey(roleId, pageKey);
      if (!page) return fail(res, `Page config "${pageKey}" not found for role id ${roleId}`, 404);
      return ok(res, { page });
    } catch (err) {
      return serverErr(res, err, 'getPageByRoleAndKey');
    }
  },

  async createPage(req, res) {
    const { roleId: rawRoleId, pageKey, title, description, roleTitle, showStats, buttons } = req.body;
    const roleId = parseRoleId(rawRoleId);
    if (!roleId) return fail(res, 'roleId must be a positive integer');
    if (!pageKey) return fail(res, 'pageKey is required');
    if (!title) return fail(res, 'title is required');
    try {
      const result = await HeaderConfigModel.createPage(roleId, pageKey, { title, description, roleTitle, showStats, buttons }, { createdBy: req.user?.id });
      return ok(res, { result }, 201);
    } catch (err) {
      if (err.message?.includes('UNIQUE')) return fail(res, `Page config "${pageKey}" already exists for role id ${roleId}. Use PUT to update.`, 409);
      return serverErr(res, err, 'createPage');
    }
  },

  async updatePage(req, res) {
    const roleId = parseRoleId(req.params.roleId);
    if (!roleId) return fail(res, 'roleId must be a positive integer');
    const { pageKey } = req.params;
    const { title, description, roleTitle, showStats, buttons, isActive } = req.body;
    const fields = { updatedBy: req.user?.id };
    if (title !== undefined) fields.title = title;
    if (description !== undefined) fields.description = description;
    if (roleTitle !== undefined) fields.roleTitle = roleTitle;
    if (showStats !== undefined) fields.showStats = showStats;
    if (buttons !== undefined) fields.buttons = buttons;
    if (isActive !== undefined) fields.isActive = isActive;
    if (Object.keys(fields).length === 1) return fail(res, 'Provide at least one field to update');
    try {
      const result = await HeaderConfigModel.updatePage(roleId, pageKey, fields);
      if (result.changes === 0) return fail(res, `Page config "${pageKey}" not found for role id ${roleId}`, 404);
      return ok(res, { result });
    } catch (err) {
      return serverErr(res, err, 'updatePage');
    }
  },

  async upsertPage(req, res) {
    const roleId = parseRoleId(req.params.roleId);
    if (!roleId) return fail(res, 'roleId must be a positive integer');
    const { pageKey } = req.params;
    const { title, description, roleTitle, showStats, buttons } = req.body;
    if (!title) return fail(res, 'title is required');
    try {
      const result = await HeaderConfigModel.upsertPage(roleId, pageKey, { title, description, roleTitle, showStats, buttons }, { userId: req.user?.id });
      return ok(res, { result });
    } catch (err) {
      return serverErr(res, err, 'upsertPage');
    }
  },

  async deletePage(req, res) {
    const roleId = parseRoleId(req.params.roleId);
    if (!roleId) return fail(res, 'roleId must be a positive integer');
    const { pageKey } = req.params;
    try {
      const result = await HeaderConfigModel.deletePage(roleId, pageKey, req.user?.id);
      if (result.changes === 0) return fail(res, `Page config "${pageKey}" not found for role id ${roleId}`, 404);
      return ok(res, { result });
    } catch (err) {
      return serverErr(res, err, 'deletePage');
    }
  },

  async deleteAllPagesForRole(req, res) {
    const roleId = parseRoleId(req.params.roleId);
    if (!roleId) return fail(res, 'roleId must be a positive integer');
    try {
      const result = await HeaderConfigModel.deleteAllPagesForRole(roleId, req.user?.id);
      return ok(res, { result });
    } catch (err) {
      return serverErr(res, err, 'deleteAllPagesForRole');
    }
  },

  async seedForAllRoles(req, res) {
    try {
      const result = await HeaderConfigModel.seedForAllRoles();
      return ok(res, { result });
    } catch (err) {
      return serverErr(res, err, 'seedForAllRoles');
    }
  }
};

module.exports = controller;