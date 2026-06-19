/**
 * root/public/js/header-controller.js
 *
 * Header controller (ES module)
 * Responsibilities:
 *  - fetch the role-based header config from /api/header-config/me
 *  - detect current page
 *  - populate title / description / role title
 *  - populate navigation links / buttons
 *  - optionally show/hide header stats
 *  - initialize profile dropdown and wire logout
 *
 * Contract:
 *  - Expects public/header.html to provide stable element ids.
 *  - No global variables.
 *  - Config shape (returned by fetchHeaderConfig / fetchHeaderConfigByRoleName):
 *      {
 *        roleId   : number,
 *        roleName : string,
 *        roles    : { [roleName]: { home, events, archives, profile, settings } },
 *        pages    : { [pageKey] : { title, description, roleTitle, showStats, buttons } }
 *      }
 */

import {
  fetchHeaderConfig,
  fetchHeaderConfigByRoleName,
} from './header-config-api.js';

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
 * Call /api/auth/me and return the user's role_name, or null on failure.
 * Used as the authoritative source after the config is loaded.
 */
async function fetchCurrentUserRoleFromApi() {
  try {
    const res  = await fetch('/api/auth/me', { method: 'GET', credentials: 'include' });
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = null; }

    if (!res.ok) return null;

    const user     = data?.user ?? data;
    const roleName = user?.role_name;
    if (!roleName) return null;

    return normalizeRole(roleName);
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
  const meta = document.querySelector('meta[name="header-page"]');
  const v = meta?.getAttribute('content');
  if (v) return v;

  const path = window.location.pathname || '';
  const last = path.split('/').filter(Boolean).pop() || '';
  if (!last) return 'dashboard';

  // Strip .html extension
  const baseName = last.replace(/\.\w+$/, '');

  // Index or dashboard → dashboard
  if (baseName === 'index' || baseName.includes('index')) return 'dashboard';

  // Convert kebab-case to camelCase:  "sidebar-menu-management" → "sidebarMenuManagement"
  // This matches the page_key values stored in header_page_configs table.
  const camelKey = baseName.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

  return camelKey || 'dashboard';
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
  // safeText($('headerRoleTitle'), pageCfg.roleTitle);  // uncomment if element exists
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

// ─── Logout ───────────────────────────────────────────────────────────────────

function initLogout() {
  const logoutBtn = $('navLogoutBtn');
  if (!logoutBtn) return;

  logoutBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    try { await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }); } catch { /* ignore */ }
    localStorage.removeItem('rl_user');
    localStorage.removeItem('rl_token');
    sessionStorage.clear();
    window.location.href = '/login.html';
  });
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

  headerInitialized = true;
}

export async function init() {
  await populateHeader();
}

// Auto-init on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', populateHeader);
} else {
  populateHeader();
}