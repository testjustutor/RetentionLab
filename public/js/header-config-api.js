/**
 * root/public/js/header-config-api.js
 *
 * All HTTP calls to /api/header-config/*.
 * Every route defined in routes/headerConfig.js has a matching function here.
 *
 * Sections:
 *   1. Shared fetch helper
 *   2. Combined  — full config for one role  (primary, used by header-controller.js)
 *   3. Nav config CRUD
 *   4. Page config CRUD
 *   5. Seed (admin)
 */

// ─── 1. Shared fetch helper ───────────────────────────────────────────────────

const BASE = '/api/header-config';

/**
 * Internal: execute a fetch, parse JSON, throw on !success.
 * Returns the full parsed response body on success.
 * Returns null (never throws) when `silent` is true — used by fire-and-forget calls.
 *
 * @param {string}  url
 * @param {object}  [opts]       - fetch init options
 * @param {string}  [tag]        - label for console.error
 * @param {boolean} [silent]     - swallow errors and return null
 */
async function api(url, opts = {}, tag = 'header-config-api', silent = false) {
  try {
    const res = await fetch(url, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
      ...opts,
    });

    let data;
    try {
      data = await res.json();
    } catch {
      throw new Error(`Non-JSON response (${res.status}) from ${url}`);
    }

    if (!res.ok || !data?.success) {
      throw new Error(data?.error || `Request failed: ${res.status}`);
    }

    return data;
  } catch (err) {
    console.error(`[${tag}]`, err.message || err);
    if (silent) return null;
    throw err;
  }
}

function json(body) {
  return { body: JSON.stringify(body) };
}


// ─── 2. Combined — full config for one role ───────────────────────────────────
//
// These are the primary functions consumed by header-controller.js.
// The response shape is normalised so the controller can use it as-is:
//   { roleName, roleId, roles: { [roleName]: nav }, pages: { [pageKey]: pageCfg } }
//
// That mirrors the old static headerConfig object so header-controller.js needs
// no changes.

/**
 * Fetch the complete header config for the currently logged-in user's role.
 * Calls GET /api/header-config/me
 *
 * Returns a config object shaped like the old static headerConfig:
 * {
 *   roleId   : number,
 *   roleName : string,
 *   roles    : { [roleName]: { home, events, archives, profile, settings } },
 *   pages    : { [pageKey] : { title, description, roleTitle, showStats, buttons } }
 * }
 *
 * Returns null on any error (safe to call from populateHeader).
 */
export async function fetchHeaderConfig() {
  const data = await api(`${BASE}/me`, {}, 'fetchHeaderConfig', true);
  if (!data?.config) return null;
  return normaliseFullConfig(data.config);
}

/**
 * Fetch the complete header config for a role by its numeric id.
 * Calls GET /api/header-config/role/:roleId
 *
 * @param {number} roleId
 * @returns {object|null}  normalised config, or null on error
 */
export async function fetchHeaderConfigByRoleId(roleId) {
  const data = await api(`${BASE}/role/${roleId}`, {}, 'fetchHeaderConfigByRoleId', true);
  if (!data?.config) return null;
  return normaliseFullConfig(data.config);
}

/**
 * Fetch the complete header config for a role by its name string.
 * Calls GET /api/header-config/role/name/:roleName
 *
 * @param {string} roleName  - e.g. 'admin', 'super_admin'
 * @returns {object|null}
 */
export async function fetchHeaderConfigByRoleName(roleName) {
  const data = await api(`${BASE}/role/name/${encodeURIComponent(roleName)}`, {}, 'fetchHeaderConfigByRoleName', true);
  if (!data?.config) return null;
  return normaliseFullConfig(data.config);
}

/**
 * Transform the server response into the shape header-controller.js expects.
 *
 * Server returns:
 *   { roleId, roleName, nav: { home, events, ... }, pages: { dashboard: {...}, ... } }
 *
 * Controller expects (same shape as the old static headerConfig):
 *   { roleId, roleName, roles: { [roleName]: nav }, pages: { [pageKey]: pageCfg } }
 *
 * @param {{ roleId, roleName, nav, pages }} raw
 * @returns {{ roleId, roleName, roles, pages }}
 */
function normaliseFullConfig(raw) {
  if (!raw) return null;

  // Remap nav items: strip DB metadata, keep only { labelKey, href, target }
  const cleanNav = {};
  for (const [key, val] of Object.entries(raw.nav || {})) {
    cleanNav[key] = {
      labelKey: val.labelKey,
      href:     val.href,
      target:   val.target,
    };
  }

  // Remap pages: strip DB metadata, keep only display fields
  const cleanPages = {};
  for (const [pageKey, p] of Object.entries(raw.pages || {})) {
    cleanPages[pageKey] = {
      title:       p.title,
      description: p.description,
      roleTitle:   p.roleTitle,
      showStats:   p.showStats,
      buttons:     p.buttons || [],
    };
  }

  return {
    roleId:   raw.roleId,
    roleName: raw.roleName,
    // Nest nav under roleName so controller can do: config.roles[roleKey]
    roles: { [raw.roleName]: cleanNav },
    pages: cleanPages,
  };
}


// ─── 3. Nav config CRUD ───────────────────────────────────────────────────────

/**
 * List nav configs for all roles.
 * GET /api/header-config/nav
 *
 * @param {object}  [opts]
 * @param {boolean} [opts.activeOnly=false]
 * @returns {{ navConfigs: object[] }|null}
 */
export async function fetchAllNavConfigs({ activeOnly = false } = {}) {
  const qs = activeOnly ? '?activeOnly=true' : '';
  return api(`${BASE}/nav${qs}`, {}, 'fetchAllNavConfigs', true);
}

/**
 * Get nav config for a specific role by numeric id.
 * GET /api/header-config/nav/role/:roleId
 *
 * @param {number} roleId
 * @returns {{ navConfig: object }|null}
 */
export async function fetchNavByRoleId(roleId) {
  return api(`${BASE}/nav/role/${roleId}`, {}, 'fetchNavByRoleId', true);
}

/**
 * Get nav config for a specific role by name string.
 * GET /api/header-config/nav/role/name/:roleName
 *
 * @param {string} roleName
 * @returns {{ navConfig: object }|null}
 */
export async function fetchNavByRoleName(roleName) {
  return api(`${BASE}/nav/role/name/${encodeURIComponent(roleName)}`, {}, 'fetchNavByRoleName', true);
}

/**
 * Create a nav config for a role (fails if one already exists — use upsertNav).
 * POST /api/header-config/nav
 *
 * @param {number} roleId
 * @param {object} nav  - { home, events, archives, profile, settings }
 *                         Each item: { labelKey, href, target }
 * @returns {{ result: object }|null}
 */
export async function createNav(roleId, nav) {
  return api(`${BASE}/nav`, { method: 'POST', ...json({ roleId, nav }) }, 'createNav');
}

/**
 * Partial update of a nav config (only pass fields you want to change).
 * PUT /api/header-config/nav/role/:roleId
 *
 * @param {number} roleId
 * @param {object} fields  - any of { nav: object, isActive: boolean }
 * @returns {{ result: object }|null}
 */
export async function updateNav(roleId, fields) {
  return api(`${BASE}/nav/role/${roleId}`, { method: 'PUT', ...json(fields) }, 'updateNav');
}

/**
 * Insert-or-update a nav config in one call.
 * PUT /api/header-config/nav/role/:roleId/upsert
 *
 * @param {number} roleId
 * @param {object} nav
 * @returns {{ result: object }|null}
 */
export async function upsertNav(roleId, nav) {
  return api(`${BASE}/nav/role/${roleId}/upsert`, { method: 'PUT', ...json({ nav }) }, 'upsertNav');
}

/**
 * Soft-delete the nav config for a role.
 * DELETE /api/header-config/nav/role/:roleId
 *
 * @param {number} roleId
 * @returns {{ result: object }|null}
 */
export async function deleteNav(roleId) {
  return api(`${BASE}/nav/role/${roleId}`, { method: 'DELETE' }, 'deleteNav');
}


// ─── 4. Page config CRUD ─────────────────────────────────────────────────────

/**
 * List all page configs across every role, grouped by role name.
 * GET /api/header-config/pages/all
 *
 * @param {object}  [opts]
 * @param {boolean} [opts.activeOnly=false]
 * @returns {{ grouped: object }|null}
 *   grouped shape: { [roleName]: { roleId, roleName, pages: { [pageKey]: pageCfg } } }
 */
export async function fetchAllPagesGrouped({ activeOnly = false } = {}) {
  const qs = activeOnly ? '?activeOnly=true' : '';
  return api(`${BASE}/pages/all${qs}`, {}, 'fetchAllPagesGrouped', true);
}

/**
 * List all page configs for a specific role by numeric id.
 * GET /api/header-config/pages/role/:roleId
 *
 * @param {number} roleId
 * @param {object} [opts]
 * @param {boolean} [opts.activeOnly=false]
 * @returns {{ pages: object[] }|null}
 */
export async function fetchPagesByRoleId(roleId, { activeOnly = false } = {}) {
  const qs = activeOnly ? '?activeOnly=true' : '';
  return api(`${BASE}/pages/role/${roleId}${qs}`, {}, 'fetchPagesByRoleId', true);
}

/**
 * List all page configs for a role by name string.
 * GET /api/header-config/pages/role/name/:roleName
 *
 * @param {string}  roleName
 * @param {object}  [opts]
 * @param {boolean} [opts.activeOnly=false]
 * @returns {{ pages: object[] }|null}
 */
export async function fetchPagesByRoleName(roleName, { activeOnly = false } = {}) {
  const qs = activeOnly ? '?activeOnly=true' : '';
  return api(
    `${BASE}/pages/role/name/${encodeURIComponent(roleName)}${qs}`,
    {},
    'fetchPagesByRoleName',
    true
  );
}

/**
 * Get a single page config for a role + page key.
 * GET /api/header-config/pages/role/:roleId/:pageKey
 *
 * @param {number} roleId
 * @param {string} pageKey  - e.g. 'dashboard', 'settings'
 * @returns {{ page: object }|null}
 */
export async function fetchPageByRoleAndKey(roleId, pageKey) {
  return api(`${BASE}/pages/role/${roleId}/${pageKey}`, {}, 'fetchPageByRoleAndKey', true);
}

/**
 * Create a page config entry for a role+page (fails if pair already exists).
 * POST /api/header-config/pages
 *
 * @param {number} roleId
 * @param {string} pageKey
 * @param {object} pageData  - { title, description, roleTitle?, showStats?, buttons? }
 * @returns {{ result: object }|null}
 */
export async function createPage(roleId, pageKey, pageData) {
  return api(`${BASE}/pages`, { method: 'POST', ...json({ roleId, pageKey, ...pageData }) }, 'createPage');
}

/**
 * Partial update of a page config. Pass only the fields you want to change.
 * PUT /api/header-config/pages/role/:roleId/:pageKey
 *
 * @param {number} roleId
 * @param {string} pageKey
 * @param {object} fields  - any of { title, description, roleTitle, showStats, buttons, isActive }
 * @returns {{ result: object }|null}
 */
export async function updatePage(roleId, pageKey, fields) {
  return api(
    `${BASE}/pages/role/${roleId}/${pageKey}`,
    { method: 'PUT', ...json(fields) },
    'updatePage'
  );
}

/**
 * Insert-or-update a page config in one call.
 * PUT /api/header-config/pages/role/:roleId/:pageKey/upsert
 *
 * @param {number} roleId
 * @param {string} pageKey
 * @param {object} pageData  - { title, description, roleTitle?, showStats?, buttons? }
 * @returns {{ result: object }|null}
 */
export async function upsertPage(roleId, pageKey, pageData) {
  return api(
    `${BASE}/pages/role/${roleId}/${pageKey}/upsert`,
    { method: 'PUT', ...json(pageData) },
    'upsertPage'
  );
}

/**
 * Soft-delete a single page config entry.
 * DELETE /api/header-config/pages/role/:roleId/:pageKey
 *
 * @param {number} roleId
 * @param {string} pageKey
 * @returns {{ result: object }|null}
 */
export async function deletePage(roleId, pageKey) {
  return api(
    `${BASE}/pages/role/${roleId}/${pageKey}`,
    { method: 'DELETE' },
    'deletePage'
  );
}

/**
 * Soft-delete ALL page configs for a role at once.
 * DELETE /api/header-config/pages/role/:roleId
 *
 * @param {number} roleId
 * @returns {{ result: object }|null}
 */
export async function deleteAllPagesForRole(roleId) {
  return api(`${BASE}/pages/role/${roleId}`, { method: 'DELETE' }, 'deleteAllPagesForRole');
}


// ─── 5. Seed (admin) ──────────────────────────────────────────────────────────

/**
 * Trigger idempotent seed of nav + page configs for all roles.
 * POST /api/header-config/seed
 *
 * Safe to call repeatedly. Skips roles that already have configs.
 *
 * @returns {{ result: { seeded: string[], skipped: string[] } }|null}
 */
export async function seedHeaderConfigs() {
  return api(`${BASE}/seed`, { method: 'POST' }, 'seedHeaderConfigs');
}