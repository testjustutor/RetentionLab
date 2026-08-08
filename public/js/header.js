/**
 * root/public/js/header.js
 * 
 * Merged header utilities:
 *  - Header config API
 *  - Header controller
 *  - Header role common (profile dropdown, logout)
 */

// ========== HEADER CONFIG API ==========

const BASE = '/api/header-config';

// Cache for header config
const HEADER_CONFIG_CACHE_KEY = 'rl_header_config';
const HEADER_CONFIG_INFLIGHT_KEY = '__rl_header_config_inflight__';

/**
 * Get cached header config
 * @returns {Object|null}
 */
async function getCachedHeaderConfig() {
  try {
    const raw = sessionStorage.getItem(HEADER_CONFIG_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Set cached header config
 * @param {Object} config
 */
async function setCachedHeaderConfig(config) {
  try {
    sessionStorage.setItem(HEADER_CONFIG_CACHE_KEY, JSON.stringify(config));
  } catch {
    // ignore
  }
}

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
  // Check cache first
  const cached = await getCachedHeaderConfig();
  if (cached) {
    return normaliseFullConfig(cached);
  }
  
  // In-flight deduplication
  if (globalThis[HEADER_CONFIG_INFLIGHT_KEY]) {
    const data = await globalThis[HEADER_CONFIG_INFLIGHT_KEY];
    if (data?.config) return normaliseFullConfig(data.config);
    return null;
  }
  
  const promise = (async () => {
    const data = await api(`${BASE}/me`, {}, 'fetchHeaderConfig', true);
    if (data?.config) {
      await setCachedHeaderConfig(data.config);
    }
    return data;
  })();
  
  globalThis[HEADER_CONFIG_INFLIGHT_KEY] = promise;
  
  try {
    const data = await promise;
    if (data?.config) return normaliseFullConfig(data.config);
    return null;
  } finally {
    delete globalThis[HEADER_CONFIG_INFLIGHT_KEY];
  }
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

// ========== HEADER CONTROLLER ==========

// Resolved once and cached for the lifetime of the page.
let headerConfig = null;

// ─── DOM helpers ──────────────────────────────────────────────────────────────

function $(id) {
  return document.getElementById(id);
}

function safeText(el, text) {
  if (!el) return;
  el.textContent = text ?? '';
}

// ─── Role detection ───────────────────────────────────────────────────────────

function normalizeRole(role) {
  if (!role) return null;
  return String(role).trim();
}

/**
 * Try to read the role from:
 *  1. <meta name="dashboard-role" content="...">  (per-page override)
 *  2. First path segment  (/admin/... → 'admin')
 *  3. window.currentUser.role_name  (set by other scripts if present)
 *
 * Returns null when none of the above matches a known role in the loaded config.
 */
function detectRoleFromMetaOrPath() {
  // 1) meta override
  const meta = document.querySelector('meta[name="dashboard-role"]');
  const metaRole = meta?.getAttribute('content');
  if (metaRole) return normalizeRole(metaRole);

  // 2) path segment
  const parts = (window.location.pathname || '').split('/').filter(Boolean);
  const maybeRole = parts[0];
  if (maybeRole && headerConfig?.roles?.[maybeRole]) return maybeRole;

  // 3) window.currentUser (defensive – injected by other scripts)
  const roleName = window.currentUser?.role_name;
  if (roleName) {
    const normalized = normalizeRole(roleName);
    if (normalized && headerConfig?.roles?.[normalized]) return normalized;
  }

  return null;
}

/**
 * Get the user's role_name from cache or API.
 * Used as the authoritative source after the config is loaded.
 */
async function fetchCurrentUserRoleFromApi() {
  try {
    // First try to get from user-profile-api cache
    const mod = await import('./auth.js');
    const user = await mod.fetchCurrentUser();
    
    if (user?.role_name) {
      return normalizeRole(user.role_name);
    }
    
    return null;
  } catch {
    return null;
  }
}

// ─── Page detection ───────────────────────────────────────────────────────────

/**
 * Resolve the current page key used to look up header_page_configs
 * in the database (which uses camelCase page keys).
 * 
 * Priority: <meta name="header-page" content="..."> → path fallback.
 * Uses generic kebab-case to camelCase conversion so any new page
 * added to the DB with matching page_key will automatically work.
 *
 * Examples:
 *   'sidebar-menu-management.html' → 'sidebarMenuManagement'
 *   'rubric-management.html'       → 'rubricManagement'
 *   'calendar-accounts.html'       → 'calendarAccounts'
 *   'add-user.html'                → 'addUser'
 *   'index.html'                   → 'dashboard'
 *   '' / '/'                       → 'dashboard'
 */
function detectPageId() {
  // 1) Check for <meta name="header-page" content="..."> first (highest priority)
  const meta = document.querySelector('meta[name="header-page"]');
  const metaPage = meta?.getAttribute('content');
  if (metaPage) return metaPage;

  const path = window.location.pathname || '';
  
  // Extract path segments
  const parts = path.split('/').filter(Boolean);
  if (!parts.length) return 'dashboard';
  
  // Check for index files
  const lastPart = parts[parts.length - 1];
  if (lastPart === 'index.html' || lastPart === 'index') {
    // For /admin/index.html → 'dashboard'
    // For /admin/session-quality/index.html → 'sessionQualityIndex'
    if (parts.length > 2) {
      const section = parts[parts.length - 2];
      const camelSection = section.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      return camelSection + 'Index';
    }
    return 'dashboard';
  }
  
  // Remove .html extension if present
  const fileName = lastPart.replace(/\.\w+$/, '');
  
  // Build page key from path segments
  // /admin/content/assets.html → contentAssets
  // /admin/evaluation/performance.html → evaluationPerformance
  // /admin/meetings/live.html → meetingsLive
  // /admin/rubric-management.html → rubricManagement
  
  if (parts.length >= 3) {
    // Multi-segment path: /admin/section/page.html
    const section = parts[parts.length - 2];
    const page = parts[parts.length - 1].replace(/\.\w+$/, '');
    
    // Convert both to camelCase and concatenate
    const camelSection = section.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    let camelPage = page.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    // Capitalize first letter of page segment for proper camelCase
    if (camelPage.length > 0) {
      camelPage = camelPage.charAt(0).toUpperCase() + camelPage.slice(1);
    }
    
    return camelSection + camelPage;
  } else if (parts.length === 2) {
    // Two segments: /admin/page.html or /admin/page
    const page = parts[parts.length - 1];
    
    // Special case: index.html → dashboard
    if (page === 'index.html' || page === 'index') return 'dashboard';
    
    // Convert to camelCase
    return page.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  }
  
  return 'dashboard';
}

// ─── DOM population ───────────────────────────────────────────────────────────

function hideOrShowStats(pageCfg) {
  const statsWrap = $('headerStats');
  if (!statsWrap) return;
  statsWrap.classList.toggle('hidden', !Boolean(pageCfg?.showStats));
}

/**
 * Set all navigation href values from the role's nav config.
 * Uses headerConfig.roles[roleKey] which is populated by normaliseFullConfig
 * in header-config-api.js.
 *
 * @param {string} roleKey  - e.g. 'admin'
 */
function setNavigationLinks(roleKey) {
  const roleCfg = headerConfig?.roles?.[roleKey];
  if (!roleCfg) return;

  const set = (id, href) => { const el = $(id); if (el && href) el.href = href; };

  // Top-bar nav buttons
  set('navHomeBtn',     roleCfg.home?.href);
  set('navEventsBtn',   roleCfg.events?.href);
  set('navArchivesBtn', roleCfg.archives?.href);

  // Profile dropdown links
  set('navDashboardBtn', roleCfg.home?.href);      // Dashboard = home link
  set('navProfileBtn',   roleCfg.profile?.href);
  set('navSettingsBtn',  roleCfg.settings?.href);
}

function applyTitleAndDescription(pageId) {
  const pageCfg = headerConfig?.pages?.[pageId];
  if (!pageCfg) return;

  safeText($('pageTitle'),       pageCfg.title);
  safeText($('pageDescription'), pageCfg.description);
  safeText($('headerRoleTitle'), pageCfg.roleTitle);
}

function initOptionalButtons(pageCfg) {
  if (!pageCfg?.buttons?.length) return;
  const container = $('headerButtons');
  if (!container) return;

  container.innerHTML = '';
  for (const btn of pageCfg.buttons) {
    if (!btn?.id) continue;
    const a = document.createElement('a');
    a.id        = btn.id;
    a.className = btn.className || 'px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-sm font-semibold hover:bg-slate-700 transition-colors';
    a.textContent = btn.label || btn.labelKey || '';
    if (btn.href)   a.href   = btn.href;
    if (btn.target) a.target = btn.target;
    container.appendChild(a);
  }
}

// ─── Profile dropdown ─────────────────────────────────────────────────────────

function initProfileDropdown() {
  const wrap = $('profileMenuWrap');
  const btn  = $('profileBtn');
  const menu = $('profileMenu');
  if (!wrap || !btn || !menu) return;

  const chevron = $('profileChevron');

  const setOpen = (open) => {
    menu.classList.toggle('hidden', !open);
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (chevron) chevron.style.transform = open ? 'rotate(180deg)' : '';
  };

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    setOpen(menu.classList.contains('hidden'));
  });

  document.addEventListener('click', (e) => { if (!wrap.contains(e.target)) setOpen(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });
}

// ─── Main entry ───────────────────────────────────────────────────────────────

let headerInitialized = false;

async function populateHeader() {
  if (headerInitialized) return;

  // ── Step 1: load config (uses /api/header-config/me by default) ─────────────
  //
  // fetchHeaderConfig() calls /me which uses the session cookie to determine the
  // role automatically. The returned object is already normalised:
  //   { roleId, roleName, roles: { [roleName]: nav }, pages: { [pageKey]: pageCfg } }
  //
  if (!headerConfig) {
    headerConfig = await fetchHeaderConfig();
  }

  // ── Step 2: determine role key ───────────────────────────────────────────────
  //
  // Primary source: roleName baked into the config response from the server.
  // Fallbacks (for development / legacy pages): meta tag, path, window.currentUser.
  // Last resort: call /api/auth/me separately (only if config didn't include a role).
  //
  let roleKey = headerConfig?.roleName || null;

  if (!roleKey) {
    // Config loaded but roleName missing — try client-side detection
    roleKey = detectRoleFromMetaOrPath();
  }

  if (!roleKey) {
    // No local signal — ask the auth endpoint and reload config for that role
    const apiRoleName = await fetchCurrentUserRoleFromApi();
    if (apiRoleName && apiRoleName !== headerConfig?.roleName) {
      // Config was for the wrong role (or wasn't loaded); reload for the correct one
      const freshConfig = await fetchHeaderConfigByRoleName(apiRoleName);
      if (freshConfig) headerConfig = freshConfig;
    }
    roleKey = apiRoleName || headerConfig?.roleName || null;
  }

  // ── Step 3: guard — config must be loaded ────────────────────────────────────

  if (!headerConfig) {
    console.error('HeaderController: header config could not be loaded');
    initProfileDropdown();
    initLogout();
    headerInitialized = true;
    return;
  }

  const pageId  = detectPageId();
  const pageCfg = headerConfig.pages?.[pageId] || headerConfig.pages?.dashboard;

  // ── Step 4: apply page config (always, even without a matched role) ───────────

  if (pageCfg) {
    applyTitleAndDescription(pageId);
    hideOrShowStats(pageCfg);
    initOptionalButtons(pageCfg);
  }

  // ── Step 5: apply nav links (only when we have a confirmed role) ──────────────

  if (roleKey && headerConfig.roles?.[roleKey]) {
    setNavigationLinks(roleKey);
  } else {
    // Log once; don't block the rest of the header from rendering
    console.warn(`HeaderController: no nav config for role "${roleKey}"`);
  }

  // ── Step 6: interactive behaviours ───────────────────────────────────────────

  initProfileDropdown();
  initLogout();

  // ── Step 7: render user profile ──────────────────────────────────────────────
  await initProfileRoleHeaderCommon();

  headerInitialized = true;
}

export async function init() {
  await populateHeader();
}

// ========== HEADER ROLE COMMON ==========

let initialized = false;

function safeInitialsFromName(name) {
  const n = (name || '').trim();
  if (!n) return '';
  return n
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function setText(id, text) {
  const el = $(id);
  if (el) el.textContent = text ?? '';
}

function initProfileFromStorage() {
  try {
    const raw = localStorage.getItem('rl_user') || sessionStorage.getItem('rl_user');
    const user = raw ? JSON.parse(raw) : null;
    if (!user) return null;

    const name = user.name || user.email?.split('@')[0] || 'User';
    const email = user.email || '';
    setText('profileAvatar', safeInitialsFromName(name));
    setText('profileName', name);
    setText('dropdownName', name);
    setText('profileEmail', email);
    setText('dropdownEmail', email);
    setText('userRole', user.role_name || '');

    return { user };
  } catch {
    return null;
  }
}

async function fetchAndRenderProfile() {
  try {
    const mod = await import('./auth.js');
    const user = await mod.fetchCurrentUser();

    const displayName = (user.first_name || user.last_name)
      ? `${(user.first_name || '').trim()} ${(user.last_name || '').trim()}`.trim()
      : (user.name || user.email || 'User');

    const email = user.email || '';
    const initials = safeInitialsFromName(displayName);
    
    setText('userRole', user.role_name || '');
    setText('profileAvatar', initials);
    setText('profileName', displayName);
    setText('dropdownName', displayName);
    setText('profileEmail', email);
    setText('dropdownEmail', email);

    // Optional session widgets (defensive)
    setText('userName', displayName);
    setText('userEmail', email);

    // Cache for other legacy scripts
    try {
      localStorage.setItem('rl_user', JSON.stringify(user));
      sessionStorage.setItem('rl_user', JSON.stringify(user));
    } catch {
      // ignore
    }

    return { user };
  } catch {
    return initProfileFromStorage();
  }
}

function initDropdownBehavior() {
  const wrap = $('profileMenuWrap');
  const btn = $('profileBtn');
  const menu = $('profileMenu');
  if (!wrap || !btn || !menu) return false;

  const chevron = $('profileChevron');

  const setOpen = (open) => {
    menu.classList.toggle('hidden', !open);
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (chevron) chevron.style.transform = open ? 'rotate(180deg)' : '';
  };

  // Toggle on click
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    const isOpen = !menu.classList.contains('hidden');
    setOpen(!isOpen);
  });

  // Outside click
  document.addEventListener('click', (e) => {
    if (!wrap.contains(e.target)) setOpen(false);
  });

  // Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') setOpen(false);
  });

  return true;
}

function initLogout() {
  const logoutBtn = $('navLogoutBtn') || $('logoutButton');
  if (!logoutBtn) return false;

  const doLogout = async (e) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();

    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch {
      // ignore
    }

    try {
      localStorage.removeItem('rl_user');
      localStorage.removeItem('rl_token');
      sessionStorage.clear();
    } catch {
      // ignore
    }

    window.location.href = '/login.html';
  };

  logoutBtn.addEventListener('click', doLogout);
  window.handleLogout = doLogout;

  return true;
}

function initLegacyGlobals() {
  window.toggleProfileMenu = () => {
    const wrap = $('profileMenuWrap');
    const menu = $('profileMenu');
    const chevron = $('profileChevron');
    if (!wrap || !menu) return;

    const isOpen = !menu.classList.contains('hidden');
    menu.classList.toggle('hidden', isOpen);
    if (chevron) chevron.style.transform = isOpen ? '' : 'rotate(180deg)';
  };

  if (!window.handleLogout) {
    window.handleLogout = async (e) => {
      if (e && typeof e.preventDefault === 'function') e.preventDefault();
      try {
        await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
      } catch {
        // ignore
      }
      try {
        localStorage.removeItem('rl_user');
        localStorage.removeItem('rl_token');
        sessionStorage.clear();
      } catch {
        // ignore
      }
      window.location.href = '/login.html';
    };
  }
}

async function initProfileRoleHeaderCommon(_opts = {}) {
  if (initialized) return;

  const hasMarkup = $('profileMenuWrap') && $('profileBtn') && $('profileMenu');
  if (!hasMarkup) return;

  // REMOVED: initDropdownBehavior(); — handled by header-controller.js
  // REMOVED: initLogout();           — handled by header-controller.js

  await fetchAndRenderProfile();

  initialized = true;
}

// Legacy compatibility (classic script style callers)
(function attachLegacy(global) {
  try {
    global.initProfileRoleHeaderCommon = initProfileRoleHeaderCommon;
  } catch {
    // ignore
  }

  // Backward compat name used by older code (if present)
  try {
    global.initRoleHeaderCommon = initProfileRoleHeaderCommon;
  } catch {
    // ignore
  }
})(typeof window !== 'undefined' ? window : {});

export { initProfileRoleHeaderCommon, initDropdownBehavior, initLogout };