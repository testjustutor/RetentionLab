/**
 * root/models/HeaderConfigModel.js
 */
const { db } = require('../database/db');
const { logger } = require('../utils/logger');

// ─── Default seed data ────────────────────────────────────────────────────────
// Keyed by role_name (matches roles.role_name in the DB).
// Used only by seedForAllRoles(); never read at runtime.

const DEFAULT_NAV_BY_ROLE = {
  super_admin: {
    home:     { labelKey: 'nav.home',     href: '/super_admin/calendar-accounts.html', target: '_self'  },
    events:   { labelKey: 'nav.events',   href: '/super_admin/calendar-events.html',   target: '_blank' },
    archives: { labelKey: 'nav.archives', href: '/super_admin/archives.html',           target: '_blank' },
    profile:  { labelKey: 'nav.profile',  href: '/super_admin/profile.html',            target: '_self'  },
    settings: { labelKey: 'nav.settings', href: '/super_admin/settings.html',           target: '_self'  },
    sidebar: {
      menuItems: [
        { id: 'dashboard', label: 'Dashboard', icon: 'grid', href: '/super_admin/index.html', submenu: null },
        { id: 'operations', label: 'Operations', icon: 'settings', href: null, submenu: [
          { id: 'calendar-accounts', label: 'Calendar Accounts', href: '/super_admin/calendar-accounts.html' },
          { id: 'calendar-events', label: 'Calendar Events', href: '/super_admin/calendar-events.html' },
          { id: 'data-architecture', label: 'Data Architecture', href: '/super_admin/data-architecture.html' }
        ]},
        { id: 'content', label: 'Content Management', icon: 'folder', href: null, submenu: [
          { id: 'archives', label: 'Archives', href: '/super_admin/archives.html' },
          { id: 'assets', label: 'Assets', href: '/super_admin/assets.html' },
          { id: 'audit', label: 'Audit Log', href: '/super_admin/audit.html' }
        ]},
        { id: 'system', label: 'System', icon: 'shield', href: null, submenu: [
          { id: 'bot-management', label: 'Bot Management', href: '/super_admin/bot.html' },
          { id: 'settings', label: 'Settings', href: '/super_admin/settings.html' },
          { id: 'profile', label: 'Profile', href: '/super_admin/profile.html' }
        ]}
      ]
    }
  },
  admin: {
    home:     { labelKey: 'nav.home',     href: '/admin/calendar-accounts.html', target: '_self'  },
    events:   { labelKey: 'nav.events',   href: '/admin/calendar-events.html',   target: '_blank' },
    archives: { labelKey: 'nav.archives', href: '/admin/archives.html',          target: '_blank' },
    profile:  { labelKey: 'nav.profile',  href: '/admin/profile.html',           target: '_self'  },
    settings: { labelKey: 'nav.settings', href: '/admin/settings.html',          target: '_self'  },
    sidebar: {
      menuItems: [
        { id: 'dashboard', label: 'Dashboard', icon: 'grid', href: '/admin/index.html', submenu: null },
        { id: 'schedules', label: 'Schedules', icon: 'calendar', href: null, submenu: [
          { id: 'calendar-accounts', label: 'Accounts', href: '/admin/calendar-accounts.html' },
          { id: 'calendar-events', label: 'Events', href: '/admin/calendar-events.html' }
        ]},
        { id: 'content', label: 'Content', icon: 'folder', href: null, submenu: [
          { id: 'archives', label: 'Archives', href: '/admin/archives.html' }
        ]},
        { id: 'account', label: 'Account', icon: 'user', href: null, submenu: [
          { id: 'profile', label: 'Profile', href: '/admin/profile.html' },
          { id: 'settings', label: 'Settings', href: '/admin/settings.html' }
        ]}
      ]
    }
  },
  reviewer: {
    home:     { labelKey: 'nav.home',     href: '/reviewer/calendar-accounts.html', target: '_self'  },
    events:   { labelKey: 'nav.events',   href: '/reviewer/calendar-events.html',   target: '_blank' },
    archives: { labelKey: 'nav.archives', href: '/reviewer/archives.html',           target: '_blank' },
    profile:  { labelKey: 'nav.profile',  href: '/reviewer/profile.html',            target: '_self'  },
    settings: { labelKey: 'nav.settings', href: '/reviewer/settings.html',           target: '_self'  },
    sidebar: {
      menuItems: [
        { id: 'dashboard', label: 'Dashboard', icon: 'grid', href: '/reviewer/index.html', submenu: null },
        { id: 'schedules', label: 'Schedules', icon: 'calendar', href: null, submenu: [
          { id: 'calendar-accounts', label: 'Accounts', href: '/reviewer/calendar-accounts.html' },
          { id: 'calendar-events', label: 'Events', href: '/reviewer/calendar-events.html' }
        ]},
        { id: 'content', label: 'Archives', icon: 'folder', href: '/reviewer/archives.html', submenu: null },
        { id: 'account', label: 'Account', icon: 'user', href: null, submenu: [
          { id: 'profile', label: 'Profile', href: '/reviewer/profile.html' },
          { id: 'settings', label: 'Settings', href: '/reviewer/settings.html' }
        ]}
      ]
    }
  },
  employee: {
    home:     { labelKey: 'nav.home',     href: '/employee/calendar-accounts.html', target: '_self'  },
    events:   { labelKey: 'nav.events',   href: '/employee/calendar-events.html',   target: '_blank' },
    archives: { labelKey: 'nav.archives', href: '/employee/archives.html',           target: '_blank' },
    profile:  { labelKey: 'nav.profile',  href: '/employee/profile.html',            target: '_self'  },
    settings: { labelKey: 'nav.settings', href: '/employee/settings.html',           target: '_self'  },
    sidebar: {
      menuItems: [
        { id: 'dashboard', label: 'Dashboard', icon: 'grid', href: '/employee/index.html', submenu: null },
        { id: 'schedules', label: 'Schedules', icon: 'calendar', href: null, submenu: [
          { id: 'calendar-accounts', label: 'My Calendar', href: '/employee/calendar-accounts.html' },
          { id: 'calendar-events', label: 'Events', href: '/employee/calendar-events.html' }
        ]},
        { id: 'content', label: 'Archives', icon: 'folder', href: '/employee/archives.html', submenu: null },
        { id: 'account', label: 'Account', icon: 'user', href: null, submenu: [
          { id: 'profile', label: 'Profile', href: '/employee/profile.html' },
          { id: 'settings', label: 'Settings', href: '/employee/settings.html' }
        ]}
      ]
    }
  }
};

// Pages are identical across all roles in the default seed.
// To customise per-role pages, adjust the seed in seedForAllRoles().
const DEFAULT_PAGES = {
  dashboard:        { title: 'Console',            description: 'Dashboard overview',                                        roleTitle: 'Console', showStats: true,  buttons: [] },
  profile:          { title: 'My Profile',         description: 'View and update your profile',                              roleTitle: 'Console', showStats: false, buttons: [] },
  settings:         { title: 'Settings',           description: 'Manage your preferences',                                   roleTitle: 'Console', showStats: false, buttons: [] },
  archives:         { title: 'Archives',           description: 'Browse archived records',                                   roleTitle: 'Console', showStats: false, buttons: [] },
  events:           { title: 'Events',             description: 'View event timeline',                                       roleTitle: 'Console', showStats: false, buttons: [] },
  calendarAccounts: { title: 'Calendar Accounts',  description: 'Manage connected calendar accounts and email sources.',     roleTitle: 'Console', showStats: false, buttons: [] },
  bot:              { title: 'Bot Engine Console', description: 'Monitor real-time orchestrator instances and active bots.', roleTitle: 'Console', showStats: false, buttons: [] },
  assets:           { title: 'Media Assets',       description: 'View partitioned audio chunks and raw exports.',            roleTitle: 'Console', showStats: false, buttons: [] },
  audit:            { title: 'Audit Timeline',     description: 'Review system audit logs and compliance tracking.',         roleTitle: 'Console', showStats: false, buttons: [] },
  dataArchitecture: { title: 'Data Architecture',  description: 'Inspect schema models, retention flows, and topology.',    roleTitle: 'Console', showStats: false, buttons: [] }
};

// ─── Internal helpers ─────────────────────────────────────────────────────────

function safeParseJson(raw, fallback = null) {
  if (!raw) return fallback;
  try { return JSON.parse(raw); }
  catch (e) { logger.error('HeaderConfigModel JSON parse error:', e.message); return fallback; }
}

/** Hydrate a raw header_role_configs JOIN row into a clean object. */
function hydrateNavRow(row) {
  if (!row) return null;
  return {
    id:          row.id,
    roleId:      row.role_id,
    roleName:    row.role_name,         // ← from JOIN with roles
    isActive:    !!row.is_active,
    createdAt:   row.created_at,
    updatedAt:   row.updated_at,
    deletedAt:   row.deleted_at,
    nav:         safeParseJson(row.nav_json, {})
  };
}

/** Hydrate a raw header_page_configs JOIN row into a clean object. */
function hydratePageRow(row) {
  if (!row) return null;
  return {
    id:          row.id,
    roleId:      row.role_id,
    roleName:    row.role_name,         // ← from JOIN with roles
    pageKey:     row.page_key,
    title:       row.title,
    description: row.description,
    roleTitle:   row.role_title,
    showStats:   !!row.show_stats,
    buttons:     safeParseJson(row.buttons_json, []),
    isActive:    !!row.is_active,
    createdAt:   row.created_at,
    updatedAt:   row.updated_at,
    deletedAt:   row.deleted_at
  };
}

// Shared JOIN fragment reused in every nav query
const NAV_SELECT = `
  SELECT hrc.*, r.role_name
  FROM   header_role_configs hrc
  JOIN   roles r ON r.id = hrc.role_id
`;

// Shared JOIN fragment reused in every page query
const PAGE_SELECT = `
  SELECT hpc.*, r.role_name
  FROM   header_page_configs hpc
  JOIN   roles r ON r.id = hpc.role_id
`;

// ─── Model ────────────────────────────────────────────────────────────────────

class HeaderConfigModel {

  // ══════════════════════════════════════════════════════════════════════════════
  // NAV CONFIG  (header_role_configs)
  // One row per role — the navigation link map shown in the header.
  // ══════════════════════════════════════════════════════════════════════════════

  /**
   * Create a nav config for a role.
   * Fails if a (non-deleted) row already exists for that role_id.
   *
   * @param {number} roleId
   * @param {object} nav         - e.g. { home: { labelKey, href, target }, ... }
   * @param {object} [opts]
   * @param {number} [opts.createdBy]
   * @returns {Promise<{ id: number, roleId: number }>}
   */
  static createNav(roleId, nav, { createdBy = null } = {}) {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO header_role_configs (role_id, nav_json, created_by, updated_by)
         VALUES (?, ?, ?, ?)`,
        [roleId, JSON.stringify(nav), createdBy, createdBy],
        function (err) {
          if (err) { logger.error('HeaderConfigModel.createNav:', err); return reject(err); }
          resolve({ id: this.lastID, roleId });
        }
      );
    });
  }

  /**
   * Get nav config for a single role, joined with role name.
   *
   * @param {number} roleId
   * @returns {Promise<{ id, roleId, roleName, nav, isActive, ... } | null>}
   */
  static getNavByRoleId(roleId) {
    return new Promise((resolve, reject) => {
      db.get(
        `${NAV_SELECT} WHERE hrc.role_id = ? AND hrc.deleted_at IS NULL LIMIT 1`,
        [roleId],
        (err, row) => {
          if (err) return reject(err);
          resolve(hydrateNavRow(row));
        }
      );
    });
  }

  /**
   * Get nav config looked up by role name string (e.g. 'admin').
   * Useful when you only have the role name from a JWT/session.
   *
   * @param {string} roleName
   * @returns {Promise<object|null>}
   */
  static getNavByRoleName(roleName) {
    return new Promise((resolve, reject) => {
      db.get(
        `${NAV_SELECT}
         WHERE r.role_name = ? AND hrc.deleted_at IS NULL LIMIT 1`,
        [roleName],
        (err, row) => {
          if (err) return reject(err);
          resolve(hydrateNavRow(row));
        }
      );
    });
  }

  /**
   * List nav configs for all roles (or only active ones).
   *
   * @param {object}  [opts]
   * @param {boolean} [opts.activeOnly=false]
   * @returns {Promise<object[]>}   array of hydrated nav rows, one per role
   */
  static getAllNav({ activeOnly = false } = {}) {
    return new Promise((resolve, reject) => {
      let sql = `${NAV_SELECT} WHERE hrc.deleted_at IS NULL`;
      if (activeOnly) sql += ` AND hrc.is_active = 1`;
      sql += ` ORDER BY r.role_name ASC`;
      db.all(sql, [], (err, rows) => {
        if (err) return reject(err);
        resolve((rows || []).map(hydrateNavRow));
      });
    });
  }

  /**
   * Update fields on an existing nav config row (looked up by roleId).
   * Only pass fields you want to change.
   *
   * @param {number} roleId
   * @param {object} fields  - any of { nav, isActive, updatedBy }
   * @returns {Promise<{ changes: number }>}
   *
   * @example
   * await HeaderConfigModel.updateNav(2, { nav: { home: { href: '/admin/home.html', ... } } });
   */
  static updateNav(roleId, fields = {}) {
    return new Promise((resolve, reject) => {
      const setClauses = [];
      const params     = [];

      if ('nav' in fields) {
        setClauses.push('nav_json = ?');
        params.push(JSON.stringify(fields.nav));
      }
      if ('isActive' in fields) {
        setClauses.push('is_active = ?');
        params.push(fields.isActive ? 1 : 0);
      }
      if ('updatedBy' in fields) {
        setClauses.push('updated_by = ?');
        params.push(fields.updatedBy);
      }
      if (setClauses.length === 0) return resolve({ changes: 0 });

      setClauses.push('updated_at = CURRENT_TIMESTAMP');
      params.push(roleId);

      db.run(
        `UPDATE header_role_configs SET ${setClauses.join(', ')}
         WHERE role_id = ? AND deleted_at IS NULL`,
        params,
        function (err) {
          if (err) { logger.error('HeaderConfigModel.updateNav:', err); return reject(err); }
          resolve({ changes: this.changes });
        }
      );
    });
  }

  /**
   * Upsert nav config for a role — inserts if missing, updates if present,
   * and un-deletes soft-deleted rows automatically.
   *
   * @param {number} roleId
   * @param {object} nav
   * @param {object} [opts]
   * @param {number} [opts.userId]
   * @returns {Promise<{ changes: number, lastID: number }>}
   */
  static upsertNav(roleId, nav, { userId = null } = {}) {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO header_role_configs (role_id, nav_json, created_by, updated_by)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(role_id) DO UPDATE SET
           nav_json   = excluded.nav_json,
           updated_by = excluded.updated_by,
           updated_at = CURRENT_TIMESTAMP,
           deleted_at = NULL`,
        [roleId, JSON.stringify(nav), userId, userId],
        function (err) {
          if (err) { logger.error('HeaderConfigModel.upsertNav:', err); return reject(err); }
          resolve({ changes: this.changes, lastID: this.lastID });
        }
      );
    });
  }

  /**
   * Soft-delete nav config for a role.
   *
   * @param {number} roleId
   * @param {number} [deletedBy]
   * @returns {Promise<{ changes: number }>}
   */
  static deleteNav(roleId, deletedBy = null) {
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE header_role_configs
         SET deleted_at = CURRENT_TIMESTAMP, updated_by = ?, updated_at = CURRENT_TIMESTAMP
         WHERE role_id = ? AND deleted_at IS NULL`,
        [deletedBy, roleId],
        function (err) {
          if (err) { logger.error('HeaderConfigModel.deleteNav:', err); return reject(err); }
          resolve({ changes: this.changes });
        }
      );
    });
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // PAGE CONFIG  (header_page_configs)
  // One row per (role × page) — page title, description, showStats, buttons.
  // ══════════════════════════════════════════════════════════════════════════════

  /**
   * Create a page config entry for a role+page combination.
   *
   * @param {number} roleId
   * @param {string} pageKey   - e.g. 'dashboard', 'settings'
   * @param {object} pageData  - { title, description, roleTitle, showStats, buttons }
   * @param {object} [opts]
   * @param {number} [opts.createdBy]
   * @returns {Promise<{ id: number, roleId: number, pageKey: string }>}
   */
  static createPage(roleId, pageKey, pageData, { createdBy = null } = {}) {
    return new Promise((resolve, reject) => {
      const { title = '', description = '', roleTitle = 'Console', showStats = false, buttons = [] } = pageData;
      db.run(
        `INSERT INTO header_page_configs
           (role_id, page_key, title, description, role_title, show_stats, buttons_json, created_by, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [roleId, pageKey, title, description, roleTitle, showStats ? 1 : 0,
         JSON.stringify(buttons), createdBy, createdBy],
        function (err) {
          if (err) { logger.error('HeaderConfigModel.createPage:', err); return reject(err); }
          resolve({ id: this.lastID, roleId, pageKey });
        }
      );
    });
  }

  /**
   * Get a single page config for a role+page, joined with role name.
   *
   * @param {number} roleId
   * @param {string} pageKey
   * @returns {Promise<object|null>}
   */
  static getPageByRoleAndKey(roleId, pageKey) {
    return new Promise((resolve, reject) => {
      db.get(
        `${PAGE_SELECT}
         WHERE hpc.role_id = ? AND hpc.page_key = ? AND hpc.deleted_at IS NULL
         LIMIT 1`,
        [roleId, pageKey],
        (err, row) => {
          if (err) return reject(err);
          resolve(hydratePageRow(row));
        }
      );
    });
  }

  /**
   * Get all page configs for a single role (identified by role_id),
   * joined with role name. Returns one entry per page_key.
   *
   * @param {number} roleId
   * @param {object} [opts]
   * @param {boolean} [opts.activeOnly=false]
   * @returns {Promise<object[]>}
   */
  static getPagesByRoleId(roleId, { activeOnly = false } = {}) {
    return new Promise((resolve, reject) => {
      let sql = `${PAGE_SELECT} WHERE hpc.role_id = ? AND hpc.deleted_at IS NULL`;
      if (activeOnly) sql += ` AND hpc.is_active = 1`;
      sql += ` ORDER BY hpc.page_key ASC`;
      db.all(sql, [roleId], (err, rows) => {
        if (err) return reject(err);
        resolve((rows || []).map(hydratePageRow));
      });
    });
  }

  /**
   * Get all page configs for a role identified by role name string.
   *
   * @param {string} roleName
   * @param {object} [opts]
   * @param {boolean} [opts.activeOnly=false]
   * @returns {Promise<object[]>}
   */
  static getPagesByRoleName(roleName, { activeOnly = false } = {}) {
    return new Promise((resolve, reject) => {
      let sql = `${PAGE_SELECT} WHERE r.role_name = ? AND hpc.deleted_at IS NULL`;
      if (activeOnly) sql += ` AND hpc.is_active = 1`;
      sql += ` ORDER BY hpc.page_key ASC`;
      db.all(sql, [roleName], (err, rows) => {
        if (err) return reject(err);
        resolve((rows || []).map(hydratePageRow));
      });
    });
  }

  /**
   * List ALL page configs across all roles, grouped by role.
   * Returns an object: { [roleName]: { roleName, roleId, pages: { [pageKey]: pageData } } }
   *
   * @param {object} [opts]
   * @param {boolean} [opts.activeOnly=false]
   * @returns {Promise<object>}
   */
  static async getAllPagesGroupedByRole({ activeOnly = false } = {}) {
    return new Promise((resolve, reject) => {
      let sql = `${PAGE_SELECT} WHERE hpc.deleted_at IS NULL`;
      if (activeOnly) sql += ` AND hpc.is_active = 1`;
      sql += ` ORDER BY r.role_name ASC, hpc.page_key ASC`;
      db.all(sql, [], (err, rows) => {
        if (err) return reject(err);
        const grouped = {};
        for (const row of rows || []) {
          const hydrated = hydratePageRow(row);
          if (!grouped[hydrated.roleName]) {
            grouped[hydrated.roleName] = { roleName: hydrated.roleName, roleId: hydrated.roleId, pages: {} };
          }
          grouped[hydrated.roleName].pages[hydrated.pageKey] = hydrated;
        }
        resolve(grouped);
      });
    });
  }

  /**
   * Update a page config entry (by roleId + pageKey). Pass only fields to change.
   *
   * @param {number} roleId
   * @param {string} pageKey
   * @param {object} fields  - any of { title, description, roleTitle, showStats, buttons, isActive, updatedBy }
   * @returns {Promise<{ changes: number }>}
   */
  static updatePage(roleId, pageKey, fields = {}) {
    return new Promise((resolve, reject) => {
      const setClauses = [];
      const params     = [];

      if ('title'       in fields) { setClauses.push('title = ?');        params.push(fields.title); }
      if ('description' in fields) { setClauses.push('description = ?');  params.push(fields.description); }
      if ('roleTitle'   in fields) { setClauses.push('role_title = ?');   params.push(fields.roleTitle); }
      if ('showStats'   in fields) { setClauses.push('show_stats = ?');   params.push(fields.showStats ? 1 : 0); }
      if ('buttons'     in fields) { setClauses.push('buttons_json = ?'); params.push(JSON.stringify(fields.buttons)); }
      if ('isActive'    in fields) { setClauses.push('is_active = ?');    params.push(fields.isActive ? 1 : 0); }
      if ('updatedBy'   in fields) { setClauses.push('updated_by = ?');   params.push(fields.updatedBy); }

      if (setClauses.length === 0) return resolve({ changes: 0 });

      setClauses.push('updated_at = CURRENT_TIMESTAMP');
      params.push(roleId, pageKey);

      db.run(
        `UPDATE header_page_configs SET ${setClauses.join(', ')}
         WHERE role_id = ? AND page_key = ? AND deleted_at IS NULL`,
        params,
        function (err) {
          if (err) { logger.error('HeaderConfigModel.updatePage:', err); return reject(err); }
          resolve({ changes: this.changes });
        }
      );
    });
  }

  /**
   * Upsert a page config entry — insert or update in one call.
   *
   * @param {number} roleId
   * @param {string} pageKey
   * @param {object} pageData  - { title, description, roleTitle, showStats, buttons }
   * @param {object} [opts]
   * @param {number} [opts.userId]
   * @returns {Promise<{ changes: number, lastID: number }>}
   */
  static upsertPage(roleId, pageKey, pageData, { userId = null } = {}) {
    return new Promise((resolve, reject) => {
      const { title = '', description = '', roleTitle = 'Console', showStats = false, buttons = [] } = pageData;
      db.run(
        `INSERT INTO header_page_configs
           (role_id, page_key, title, description, role_title, show_stats, buttons_json, created_by, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(role_id, page_key) DO UPDATE SET
           title        = excluded.title,
           description  = excluded.description,
           role_title   = excluded.role_title,
           show_stats   = excluded.show_stats,
           buttons_json = excluded.buttons_json,
           updated_by   = excluded.updated_by,
           updated_at   = CURRENT_TIMESTAMP,
           deleted_at   = NULL`,
        [roleId, pageKey, title, description, roleTitle, showStats ? 1 : 0,
         JSON.stringify(buttons), userId, userId],
        function (err) {
          if (err) { logger.error('HeaderConfigModel.upsertPage:', err); return reject(err); }
          resolve({ changes: this.changes, lastID: this.lastID });
        }
      );
    });
  }

  /**
   * Soft-delete a single page config entry.
   *
   * @param {number} roleId
   * @param {string} pageKey
   * @param {number} [deletedBy]
   * @returns {Promise<{ changes: number }>}
   */
  static deletePage(roleId, pageKey, deletedBy = null) {
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE header_page_configs
         SET deleted_at = CURRENT_TIMESTAMP, updated_by = ?, updated_at = CURRENT_TIMESTAMP
         WHERE role_id = ? AND page_key = ? AND deleted_at IS NULL`,
        [deletedBy, roleId, pageKey],
        function (err) {
          if (err) { logger.error('HeaderConfigModel.deletePage:', err); return reject(err); }
          resolve({ changes: this.changes });
        }
      );
    });
  }

  /**
   * Soft-delete ALL page configs for a role (e.g. when deactivating a role).
   *
   * @param {number} roleId
   * @param {number} [deletedBy]
   * @returns {Promise<{ changes: number }>}
   */
  static deleteAllPagesForRole(roleId, deletedBy = null) {
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE header_page_configs
         SET deleted_at = CURRENT_TIMESTAMP, updated_by = ?, updated_at = CURRENT_TIMESTAMP
         WHERE role_id = ? AND deleted_at IS NULL`,
        [deletedBy, roleId],
        function (err) {
          if (err) { logger.error('HeaderConfigModel.deleteAllPagesForRole:', err); return reject(err); }
          resolve({ changes: this.changes });
        }
      );
    });
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // COMBINED READ  — full header config for one role in one call
  // ══════════════════════════════════════════════════════════════════════════════

  /**
   * Return the complete header config for a role: nav links + all page configs.
   * This is the primary method called by your front-end controller.
   *
   * @param {number} roleId
   * @returns {Promise<{
   *   roleId: number,
   *   roleName: string,
   *   nav: object,
   *   pages: { [pageKey]: object }
   * } | null>}
   *
   * @example
   * const header = await HeaderConfigModel.getFullConfigByRoleId(req.user.role_id);
   * // header.roleName  → 'admin'
   * // header.nav.home  → { labelKey: 'nav.home', href: '/admin/...', target: '_self' }
   * // header.pages.dashboard → { title: 'Console', showStats: true, ... }
   */
  static async getFullConfigByRoleId(roleId) {
    const [navRow, pageRows] = await Promise.all([
      HeaderConfigModel.getNavByRoleId(roleId),
      HeaderConfigModel.getPagesByRoleId(roleId, { activeOnly: true })
    ]);

    if (!navRow) return null;

    const pages = {};
    for (const p of pageRows) pages[p.pageKey] = p;

    return {
      roleId:   navRow.roleId,
      roleName: navRow.roleName,
      nav:      navRow.nav,
      pages
    };
  }

  /**
   * Same as getFullConfigByRoleId but accepts a role name string.
   *
   * @param {string} roleName
   * @returns {Promise<object|null>}
   */
  static async getFullConfigByRoleName(roleName) {
    const [navRow, pageRows] = await Promise.all([
      HeaderConfigModel.getNavByRoleName(roleName),
      HeaderConfigModel.getPagesByRoleName(roleName, { activeOnly: true })
    ]);

    if (!navRow) return null;

    const pages = {};
    for (const p of pageRows) pages[p.pageKey] = p;

    return {
      roleId:   navRow.roleId,
      roleName: navRow.roleName,
      nav:      navRow.nav,
      pages
    };
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // SEED  — idempotent, runs once on startup after roles are seeded
  // ══════════════════════════════════════════════════════════════════════════════

  /**
   * Seed nav + page configs for every role found in the roles table.
   * Safe to call on every startup — skips roles that already have a config.
   * Roles not in DEFAULT_NAV_BY_ROLE get the 'employee' nav as a fallback.
   *
   * @returns {Promise<{ seeded: string[], skipped: string[] }>}
   */
  static async seedForAllRoles() {
    const roles = await new Promise((resolve, reject) => {
      db.all(`SELECT id, role_name FROM roles`, [], (err, rows) => {
        if (err) return reject(err);
        resolve(rows || []);
      });
    });

    const seeded  = [];
    const skipped = [];

    for (const role of roles) {
      // Check if nav config already exists (including soft-deleted — avoid UNIQUE violation)
      const existing = await new Promise((resolve, reject) => {
        db.get(
          `SELECT id FROM header_role_configs WHERE role_id = ? LIMIT 1`,
          [role.id],
          (err, row) => { if (err) return reject(err); resolve(row); }
        );
      });

      if (existing) {
        skipped.push(role.role_name);
        continue;
      }

      const nav = DEFAULT_NAV_BY_ROLE[role.role_name] || DEFAULT_NAV_BY_ROLE.employee;

      await HeaderConfigModel.upsertNav(role.id, nav);

      for (const [pageKey, pageData] of Object.entries(DEFAULT_PAGES)) {
        await HeaderConfigModel.upsertPage(role.id, pageKey, pageData);
      }

      seeded.push(role.role_name);
    }

    if (seeded.length)  logger.info(`HeaderConfigModel.seedForAllRoles: seeded  → [${seeded.join(', ')}]`);
    if (skipped.length) logger.info(`HeaderConfigModel.seedForAllRoles: skipped → [${skipped.join(', ')}]`);

    return { seeded, skipped };
  }
}

module.exports = { HeaderConfigModel, DEFAULT_NAV_BY_ROLE, DEFAULT_PAGES };