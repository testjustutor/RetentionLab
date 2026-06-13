/**
 * root/routes/header-config.js
 */
const express = require('express');
const router  = express.Router();

const { HeaderConfigModel } = require('../models/HeaderConfigModel');
const RolesModel             = require('../models/RolesModel');
const { requireAuth }       = require('../middleware/auth');

// ─── Shared response helpers ──────────────────────────────────────────────────

const ok      = (res, data, status = 200) => res.status(status).json({ success: true,  ...data });
const fail    = (res, message, status = 400) => res.status(status).json({ success: false, error: message });
const serverErr = (res, err, context) => {
  console.error(`[HeaderConfig] ${context}:`, err);
  return res.status(500).json({ success: false, error: err.message || 'Internal server error' });
};

// ─── Param guard helpers ──────────────────────────────────────────────────────

/** Parse and validate a positive integer from a route/query param. */
function parseRoleId(raw) {
  const id = parseInt(raw, 10);
  return (!isNaN(id) && id > 0) ? id : null;
}

/** All routes require a valid session. */
router.use(requireAuth);

/**
 * GET /header-config/roles
 * Returns the list of available roles and their IDs.
 */
router.get('/roles', async (req, res) => {
  try {
    const roles = await RolesModel.getAllRoles();
    return ok(res, { roles });
  } catch (err) {
    return serverErr(res, err, 'getRoles');
  }
});


// ══════════════════════════════════════════════════════════════════════════════
// COMBINED  —  full header config (nav + pages) for one role
// These are the primary endpoints consumed by the front end.
// ══════════════════════════════════════════════════════════════════════════════

/**
 * GET /header-config/role/:roleId
 * Returns the complete header config (nav + pages) for a role by numeric ID.
 * The logged-in user's own config:  GET /header-config/role/:roleId  where
 * roleId = req.user.role_id.
 */
router.get('/role/:roleId', async (req, res) => {
  const roleId = parseRoleId(req.params.roleId);
  if (!roleId) return fail(res, 'roleId must be a positive integer');

  try {
    const config = await HeaderConfigModel.getFullConfigByRoleId(roleId);
    if (!config) return fail(res, `No header config found for role id ${roleId}`, 404);
    return ok(res, { config });
  } catch (err) {
    return serverErr(res, err, 'getFullConfigByRoleId');
  }
});

/**
 * GET /header-config/role/name/:roleName
 * Returns the complete header config (nav + pages) for a role by name string.
 * Useful when you only have req.user.role_name from a JWT.
 */
router.get('/role/name/:roleName', async (req, res) => {
  const { roleName } = req.params;
  if (!roleName || typeof roleName !== 'string') return fail(res, 'roleName is required');

  try {
    const config = await HeaderConfigModel.getFullConfigByRoleName(roleName);
    if (!config) return fail(res, `No header config found for role "${roleName}"`, 404);
    return ok(res, { config });
  } catch (err) {
    return serverErr(res, err, 'getFullConfigByRoleName');
  }
});

/**
 * GET /header-config/me
 * Convenience shortcut — returns the full header config for the logged-in user's role.
 * Requires req.user.role_id to be set by the auth middleware.
 */
router.get('/me', async (req, res) => {
  const roleId = parseRoleId(req.user?.role_id);
  const roleName = req.user?.role_name;

  try {
    let config = null;

    if (roleId) {
      config = await HeaderConfigModel.getFullConfigByRoleId(roleId);
    }

    if (!config && roleName) {
      config = await HeaderConfigModel.getFullConfigByRoleName(roleName);
    }

    if (!config) {
      return fail(res, 'Header config not found for your role', 404);
    }

    return ok(res, { config });
  } catch (err) {
    return serverErr(res, err, 'getFullConfigForUser');
  }
});


// ══════════════════════════════════════════════════════════════════════════════
// NAV CONFIG  —  header_role_configs (one row per role)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * GET /header-config/nav
 * List nav configs for all roles.
 * Query: ?activeOnly=true   → only is_active = 1 rows
 */
router.get('/nav', async (req, res) => {
  const activeOnly = req.query.activeOnly === 'true';
  try {
    const navConfigs = await HeaderConfigModel.getAllNav({ activeOnly });
    return ok(res, { navConfigs });
  } catch (err) {
    return serverErr(res, err, 'getAllNav');
  }
});

/**
 * GET /header-config/nav/role/:roleId
 * Get nav config for a specific role by numeric ID.
 * Response includes roleName from the roles table join.
 */
router.get('/nav/role/:roleId', async (req, res) => {
  const roleId = parseRoleId(req.params.roleId);
  if (!roleId) return fail(res, 'roleId must be a positive integer');

  try {
    const navConfig = await HeaderConfigModel.getNavByRoleId(roleId);
    if (!navConfig) return fail(res, `Nav config not found for role id ${roleId}`, 404);
    return ok(res, { navConfig });
  } catch (err) {
    return serverErr(res, err, 'getNavByRoleId');
  }
});

/**
 * GET /header-config/nav/role/name/:roleName
 * Get nav config for a specific role by name string.
 */
router.get('/nav/role/name/:roleName', async (req, res) => {
  const { roleName } = req.params;
  if (!roleName) return fail(res, 'roleName is required');

  try {
    const navConfig = await HeaderConfigModel.getNavByRoleName(roleName);
    if (!navConfig) return fail(res, `Nav config not found for role "${roleName}"`, 404);
    return ok(res, { navConfig });
  } catch (err) {
    return serverErr(res, err, 'getNavByRoleName');
  }
});

/**
 * POST /header-config/nav
 * Create a nav config for a role (fails if one already exists).
 *
 * Body: { roleId: number, nav: { home, events, archives, profile, settings } }
 * Each nav item: { labelKey: string, href: string, target: '_self'|'_blank' }
 */
router.post('/nav', async (req, res) => {
  const { roleId: rawRoleId, nav } = req.body;
  const roleId = parseRoleId(rawRoleId);

  if (!roleId)                       return fail(res, 'roleId must be a positive integer');
  if (!nav || typeof nav !== 'object') return fail(res, 'nav must be an object of nav items');

  try {
    const result = await HeaderConfigModel.createNav(roleId, nav, { createdBy: req.user?.id });
    return ok(res, { result }, 201);
  } catch (err) {
    if (err.message?.includes('UNIQUE')) return fail(res, `Nav config already exists for role id ${roleId}. Use PUT to update.`, 409);
    return serverErr(res, err, 'createNav');
  }
});

/**
 * PUT /header-config/nav/role/:roleId
 * Full or partial update of a nav config for a role.
 * Pass only the fields you want to change.
 *
 * Body (all optional): { nav: object, isActive: boolean }
 */
router.put('/nav/role/:roleId', async (req, res) => {
  const roleId = parseRoleId(req.params.roleId);
  if (!roleId) return fail(res, 'roleId must be a positive integer');

  const { nav, isActive } = req.body;
  const fields = { updatedBy: req.user?.id };

  if (nav      !== undefined) fields.nav      = nav;
  if (isActive !== undefined) fields.isActive = isActive;

  if (Object.keys(fields).length === 1) return fail(res, 'Provide at least one field to update: nav, isActive');

  try {
    const result = await HeaderConfigModel.updateNav(roleId, fields);
    if (result.changes === 0) return fail(res, `Nav config not found or already deleted for role id ${roleId}`, 404);
    return ok(res, { result });
  } catch (err) {
    return serverErr(res, err, 'updateNav');
  }
});

/**
 * PUT /header-config/nav/role/:roleId/upsert
 * Insert-or-update in one call. Safe to call even when unsure if a row exists.
 *
 * Body: { nav: object }
 */
router.put('/nav/role/:roleId/upsert', async (req, res) => {
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
});

/**
 * DELETE /header-config/nav/role/:roleId
 * Soft-delete the nav config for a role.
 */
router.delete('/nav/role/:roleId', async (req, res) => {
  const roleId = parseRoleId(req.params.roleId);
  if (!roleId) return fail(res, 'roleId must be a positive integer');

  try {
    const result = await HeaderConfigModel.deleteNav(roleId, req.user?.id);
    if (result.changes === 0) return fail(res, `Nav config not found or already deleted for role id ${roleId}`, 404);
    return ok(res, { result });
  } catch (err) {
    return serverErr(res, err, 'deleteNav');
  }
});


// ══════════════════════════════════════════════════════════════════════════════
// PAGE CONFIG  —  header_page_configs (one row per role × page)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * GET /header-config/pages/all
 * All page configs across every role, grouped by role name.
 * Response: { grouped: { [roleName]: { roleId, roleName, pages: { [pageKey]: ... } } } }
 * Query: ?activeOnly=true
 */
router.get('/pages/all', async (req, res) => {
  const activeOnly = req.query.activeOnly === 'true';
  try {
    const grouped = await HeaderConfigModel.getAllPagesGroupedByRole({ activeOnly });
    return ok(res, { grouped });
  } catch (err) {
    return serverErr(res, err, 'getAllPagesGroupedByRole');
  }
});

/**
 * GET /header-config/pages/role/:roleId
 * All page configs for a specific role (by numeric id).
 * Query: ?activeOnly=true
 */
router.get('/pages/role/:roleId', async (req, res) => {
  const roleId = parseRoleId(req.params.roleId);
  if (!roleId) return fail(res, 'roleId must be a positive integer');

  const activeOnly = req.query.activeOnly === 'true';
  try {
    const pages = await HeaderConfigModel.getPagesByRoleId(roleId, { activeOnly });
    return ok(res, { pages });
  } catch (err) {
    return serverErr(res, err, 'getPagesByRoleId');
  }
});

/**
 * GET /header-config/pages/role/name/:roleName
 * All page configs for a specific role (by role name string).
 * Query: ?activeOnly=true
 */
router.get('/pages/role/name/:roleName', async (req, res) => {
  const { roleName } = req.params;
  if (!roleName) return fail(res, 'roleName is required');

  const activeOnly = req.query.activeOnly === 'true';
  try {
    const pages = await HeaderConfigModel.getPagesByRoleName(roleName, { activeOnly });
    return ok(res, { pages });
  } catch (err) {
    return serverErr(res, err, 'getPagesByRoleName');
  }
});

/**
 * GET /header-config/pages/role/:roleId/:pageKey
 * Single page config for a role + page key combination.
 */
router.get('/pages/role/:roleId/:pageKey', async (req, res) => {
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
});

/**
 * POST /header-config/pages
 * Create a page config entry for a role+page (fails if the pair already exists).
 *
 * Body: {
 *   roleId   : number,
 *   pageKey  : string,
 *   title    : string,
 *   description: string,
 *   roleTitle: string,       // optional, defaults to 'Console'
 *   showStats: boolean,      // optional, defaults to false
 *   buttons  : array         // optional, defaults to []
 * }
 */
router.post('/pages', async (req, res) => {
  const { roleId: rawRoleId, pageKey, title, description, roleTitle, showStats, buttons } = req.body;
  const roleId = parseRoleId(rawRoleId);

  if (!roleId)  return fail(res, 'roleId must be a positive integer');
  if (!pageKey) return fail(res, 'pageKey is required');
  if (!title)   return fail(res, 'title is required');

  const pageData = { title, description, roleTitle, showStats, buttons };

  try {
    const result = await HeaderConfigModel.createPage(roleId, pageKey, pageData, { createdBy: req.user?.id });
    return ok(res, { result }, 201);
  } catch (err) {
    if (err.message?.includes('UNIQUE')) return fail(res, `Page config "${pageKey}" already exists for role id ${roleId}. Use PUT to update.`, 409);
    return serverErr(res, err, 'createPage');
  }
});

/**
 * PUT /header-config/pages/role/:roleId/:pageKey
 * Partial update of a page config. Pass only the fields you want to change.
 *
 * Body (all optional): { title, description, roleTitle, showStats, buttons, isActive }
 */
router.put('/pages/role/:roleId/:pageKey', async (req, res) => {
  const roleId = parseRoleId(req.params.roleId);
  if (!roleId) return fail(res, 'roleId must be a positive integer');

  const { pageKey } = req.params;
  const { title, description, roleTitle, showStats, buttons, isActive } = req.body;

  const fields = { updatedBy: req.user?.id };
  if (title       !== undefined) fields.title       = title;
  if (description !== undefined) fields.description = description;
  if (roleTitle   !== undefined) fields.roleTitle   = roleTitle;
  if (showStats   !== undefined) fields.showStats   = showStats;
  if (buttons     !== undefined) fields.buttons     = buttons;
  if (isActive    !== undefined) fields.isActive    = isActive;

  if (Object.keys(fields).length === 1) return fail(res, 'Provide at least one field to update');

  try {
    const result = await HeaderConfigModel.updatePage(roleId, pageKey, fields);
    if (result.changes === 0) return fail(res, `Page config "${pageKey}" not found for role id ${roleId}`, 404);
    return ok(res, { result });
  } catch (err) {
    return serverErr(res, err, 'updatePage');
  }
});

/**
 * PUT /header-config/pages/role/:roleId/:pageKey/upsert
 * Insert-or-update a page config in one call.
 *
 * Body: { title, description, roleTitle, showStats, buttons }
 */
router.put('/pages/role/:roleId/:pageKey/upsert', async (req, res) => {
  const roleId = parseRoleId(req.params.roleId);
  if (!roleId) return fail(res, 'roleId must be a positive integer');

  const { pageKey } = req.params;
  const { title, description, roleTitle, showStats, buttons } = req.body;

  if (!title) return fail(res, 'title is required');

  try {
    const result = await HeaderConfigModel.upsertPage(
      roleId, pageKey,
      { title, description, roleTitle, showStats, buttons },
      { userId: req.user?.id }
    );
    return ok(res, { result });
  } catch (err) {
    return serverErr(res, err, 'upsertPage');
  }
});

/**
 * DELETE /header-config/pages/role/:roleId/:pageKey
 * Soft-delete a single page config entry.
 */
router.delete('/pages/role/:roleId/:pageKey', async (req, res) => {
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
});

/**
 * DELETE /header-config/pages/role/:roleId
 * Soft-delete ALL page configs for a role at once (e.g. when retiring a role).
 */
router.delete('/pages/role/:roleId', async (req, res) => {
  const roleId = parseRoleId(req.params.roleId);
  if (!roleId) return fail(res, 'roleId must be a positive integer');

  try {
    const result = await HeaderConfigModel.deleteAllPagesForRole(roleId, req.user?.id);
    return ok(res, { result });
  } catch (err) {
    return serverErr(res, err, 'deleteAllPagesForRole');
  }
});


// ══════════════════════════════════════════════════════════════════════════════
// SEED  —  admin-only endpoint to re-seed configs for all roles
// ══════════════════════════════════════════════════════════════════════════════

/**
 * POST /header-config/seed
 * Idempotent seed — inserts default nav + page configs for every role in the
 * roles table that doesn't already have a config. Safe to call repeatedly.
 *
 * Restrict this to super_admin in your auth middleware if needed.
 */
router.post('/seed', async (req, res) => {
  try {
    const result = await HeaderConfigModel.seedForAllRoles();
    return ok(res, { result });
  } catch (err) {
    return serverErr(res, err, 'seedForAllRoles');
  }
});


module.exports = router;