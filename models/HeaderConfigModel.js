/**
 * root/models/HeaderConfigModel.js
 */
const { db } = require('../database/db');
const { logger } = require('../utils/logger');

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
    roleName:    row.role_name,
    isActive:    !!row.is_active,
    createdAt:   row.created_at,
    updatedAt:   row.updated_at,
    deletedAt:   row.deleted_at,
    nav: {
      home:     { labelKey: 'nav.home',     href: row.home_href,      label: row.home_label },
      events:   { labelKey: 'nav.events',   href: row.events_href,    label: row.events_label },
      archives: { labelKey: 'nav.archives', href: row.archives_href,  label: row.archives_label },
      profile:  { labelKey: 'nav.profile',  href: row.profile_href,   label: row.profile_label },
      settings: { labelKey: 'nav.settings', href: row.settings_href,  label: row.settings_label }
    }
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
   * @param {object} nav         - e.g. { home: { href, label }, ... }
   * @param {object} [opts]
   * @param {number} [opts.createdBy]
   * @returns {Promise<{ id: number, roleId: number }>}
   */
  static createNav(roleId, nav, { createdBy = null } = {}) {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO header_role_configs 
         (role_id, home_href, home_label, events_href, events_label, archives_href, archives_label, 
          profile_href, profile_label, settings_href, settings_label, created_by, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          roleId,
          nav.home?.href || '/dashboard.html',
          nav.home?.label || 'Home',
          nav.events?.href || '/events.html',
          nav.events?.label || 'Events',
          nav.archives?.href || '/archives.html',
          nav.archives?.label || 'Archives',
          nav.profile?.href || '/profile.html',
          nav.profile?.label || 'Profile',
          nav.settings?.href || '/settings.html',
          nav.settings?.label || 'Settings',
          createdBy,
          createdBy
        ],
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
   */
  static updateNav(roleId, fields = {}) {
    return new Promise((resolve, reject) => {
      const setClauses = [];
      const params     = [];

      if ('nav' in fields) {
        const nav = fields.nav;
        setClauses.push('home_href = ?, home_label = ?, events_href = ?, events_label = ?, archives_href = ?, archives_label = ?, profile_href = ?, profile_label = ?, settings_href = ?, settings_label = ?');
        params.push(
          nav.home?.href || '/dashboard.html',
          nav.home?.label || 'Home',
          nav.events?.href || '/events.html',
          nav.events?.label || 'Events',
          nav.archives?.href || '/archives.html',
          nav.archives?.label || 'Archives',
          nav.profile?.href || '/profile.html',
          nav.profile?.label || 'Profile',
          nav.settings?.href || '/settings.html',
          nav.settings?.label || 'Settings'
        );
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
        `INSERT INTO header_role_configs 
         (role_id, home_href, home_label, events_href, events_label, archives_href, archives_label,
          profile_href, profile_label, settings_href, settings_label, created_by, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           home_href = VALUES(home_href),
           home_label = VALUES(home_label),
           events_href = VALUES(events_href),
           events_label = VALUES(events_label),
           archives_href = VALUES(archives_href),
           archives_label = VALUES(archives_label),
           profile_href = VALUES(profile_href),
           profile_label = VALUES(profile_label),
           settings_href = VALUES(settings_href),
           settings_label = VALUES(settings_label),
           updated_by = VALUES(updated_by),
           updated_at = CURRENT_TIMESTAMP,
           deleted_at = NULL`,
        [
          roleId,
          nav.home?.href || '/dashboard.html',
          nav.home?.label || 'Home',
          nav.events?.href || '/events.html',
          nav.events?.label || 'Events',
          nav.archives?.href || '/archives.html',
          nav.archives?.label || 'Archives',
          nav.profile?.href || '/profile.html',
          nav.profile?.label || 'Profile',
          nav.settings?.href || '/settings.html',
          nav.settings?.label || 'Settings',
          userId,
          userId
        ],
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
         ON DUPLICATE KEY UPDATE
           title        = VALUES(title),
           description  = VALUES(description),
           role_title   = VALUES(role_title),
           show_stats   = VALUES(show_stats),
           buttons_json = VALUES(buttons_json),
           updated_by   = VALUES(updated_by),
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
  // MENU ITEMS  — fetch sidebar menu structure from header_menu_items table
  // ══════════════════════════════════════════════════════════════════════════════

  /**
   * Get sidebar menu items for a role, rebuilding the nested structure.
   *
   * @param {number} roleId
   * @returns {Promise<Array>}  - array of menuItems with submenu structure
   */
  static async getMenuItemsByRoleId(roleId) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT id, menu_id, parent_id, label, icon, href, display_order, is_active, section, color
         FROM header_menu_items
         WHERE role_id = ? AND deleted_at IS NULL
         ORDER BY display_order ASC`,
        [roleId],
        (err, rows) => {
          if (err) return reject(err);

          // Build tree structure
          const items = {};
          const roots = [];

          for (const row of rows || []) {
            items[row.menu_id] = {
              id: row.menu_id,
              label: row.label,
              icon: row.icon,
              href: row.href,
              section: row.section || 'main',
              color: row.color || 'violet',
              submenu: null,
              isActive: !!row.is_active
            };
          }

          // Link children to parents
          for (const row of rows || []) {
            if (row.parent_id) {
              if (!items[row.parent_id]) {
                items[row.parent_id] = { id: row.parent_id, submenu: [] };
              }
              if (!items[row.parent_id].submenu) {
                items[row.parent_id].submenu = [];
              }
              items[row.parent_id].submenu.push(items[row.menu_id]);
            } else {
              roots.push(items[row.menu_id]);
            }
          }

          resolve(roots);
        }
      );
    });
  }

  /**
   * Get all menu items flat (including submenus with parent info) for a role.
   * Returns flat rows with parent_id for ease of editing.
   */
  static getMenuItemsFlatByRoleId(roleId) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT id, menu_id, parent_id, label, icon, href, display_order, is_active
         FROM header_menu_items
         WHERE role_id = ? AND deleted_at IS NULL
         ORDER BY display_order ASC`,
        [roleId],
        (err, rows) => {
          if (err) return reject(err);
          resolve(rows || []);
        }
      );
    });
  }

  /**
   * Insert a single menu item for a role.
   */
  static insertMenuItem(roleId, item) {
    return new Promise((resolve, reject) => {
      const { menu_id, parent_id = null, label, icon = null, href = null, display_order = 0, is_active = 1 } = item;
      if (!menu_id || !label) return reject(new Error('menu_id and label are required'));
      db.run(
        `INSERT INTO header_menu_items (role_id, menu_id, parent_id, label, icon, href, display_order, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [roleId, menu_id, parent_id, label, icon, href, display_order, is_active ? 1 : 0],
        function(err) {
          if (err) {
            if (err.message?.includes('UNIQUE')) return reject(new Error('A menu item with id "' + menu_id + '" already exists for this role'));
            return reject(err);
          }
          resolve({ id: this.lastID, menu_id });
        }
      );
    });
  }

  /**
   * Update a single menu item by its DB id.
   */
  static updateMenuItemById(id, updates) {
    return new Promise((resolve, reject) => {
      const fields = [];
      const params = [];
      if (updates.label !== undefined) { fields.push('label = ?'); params.push(updates.label); }
      if (updates.icon !== undefined) { fields.push('icon = ?'); params.push(updates.icon); }
      if (updates.href !== undefined) { fields.push('href = ?'); params.push(updates.href); }
      if (updates.parent_id !== undefined) { fields.push('parent_id = ?'); params.push(updates.parent_id); }
      if (updates.display_order !== undefined) { fields.push('display_order = ?'); params.push(updates.display_order); }
      if (updates.is_active !== undefined) { fields.push('is_active = ?'); params.push(updates.is_active ? 1 : 0); }
      if (fields.length === 0) return resolve({ updated: false });
      fields.push('updated_at = CURRENT_TIMESTAMP');
      params.push(id);
      db.run(`UPDATE header_menu_items SET ${fields.join(', ')} WHERE id = ?`, params, function(err) {
        if (err) return reject(err);
        resolve({ updated: this.changes > 0 });
      });
    });
  }

  /**
   * Delete a single menu item by its DB id.
   * Also deletes any children (submenu items) that reference it as parent.
   */
  static deleteMenuItemById(id) {
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        // Get menu_id of the item
        db.get('SELECT menu_id, parent_id FROM header_menu_items WHERE id = ?', [id], (err, row) => {
          if (err) return reject(err);
          if (!row) return resolve({ deleted: false });
          // Delete children that reference this menu_id as parent_id
          db.run('DELETE FROM header_menu_items WHERE parent_id = ?', [row.menu_id]);
          // Delete the item itself
          db.run('DELETE FROM header_menu_items WHERE id = ?', [id], function(err2) {
            if (err2) return reject(err2);
            resolve({ deleted: this.changes > 0 });
          });
        });
      });
    });
  }

  /**
   * Get all roles with their IDs
   */
  static getAllRoles() {
    return new Promise((resolve, reject) => {
      db.all('SELECT id, role_name, description FROM roles ORDER BY role_name ASC', [], (err, rows) => {
        if (err) return reject(err);
        resolve(rows || []);
      });
    });
  }

  /**
   * Seed menu items for a role from the sidebar menuItems structure.
   * Clears existing menu items and inserts new ones.
   *
   * @param {number} roleId
   * @param {Array} menuItems - array of { id, label, icon, href, submenu }
   * @returns {Promise<void>}
   */
  static async seedMenuItems(roleId, menuItems = []) {
    return new Promise((resolve, reject) => {
      // Delete existing menu items for this role
      const db_ref = require('../database/db').db;
      db_ref.run(
        `DELETE FROM header_menu_items WHERE role_id = ?`,
        [roleId],
        async (err) => {
          if (err) return reject(err);

          // Insert new menu items
          const insertAsync = (sql, params) => new Promise((res, rej) => {
            db_ref.run(sql, params, function(e) {
              if (e) return rej(e);
              res(this);
            });
          });

          try {
            let order = 0;
            for (const item of menuItems) {
              await insertAsync(
                `INSERT INTO header_menu_items 
                 (role_id, menu_id, parent_id, label, icon, href, display_order, is_active, section, color)
                 VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
                [roleId, item.id, null, item.label, item.icon || null, item.href || null, order++, item.section || 'main', item.color || 'violet']
              );

              // Insert submenu items
              if (item.submenu && Array.isArray(item.submenu)) {
                let subOrder = 0;
                for (const subItem of item.submenu) {
                  await insertAsync(
                    `INSERT INTO header_menu_items 
                     (role_id, menu_id, parent_id, label, icon, href, display_order, is_active, section, color)
                     VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
                    [roleId, subItem.id, item.id, subItem.label, null, subItem.href || null, subOrder++, item.section || 'main', item.color || 'violet']
                  );
                }
              }
            }
            resolve();
          } catch (err) {
            reject(err);
          }
        }
      );
    });
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // SEED  — idempotent, runs once on startup after roles are seeded
  // ══════════════════════════════════════════════════════════════════════════════

  /**
   * Seed nav + page configs for every role found in the roles table.
   * Safe to call on every startup — skips roles that already have a config.
   * Roles not in DEFAULT_NAV_BY_ROLE get the 'instructor' nav as a fallback.
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
    const updated = [];

    for (const role of roles) {
      // Check if nav config already exists (including soft-deleted — avoid UNIQUE violation)
      const existing = await new Promise((resolve, reject) => {
        db.get(
          `SELECT id FROM header_role_configs WHERE role_id = ? LIMIT 1`,
          [role.id],
          (err, row) => { if (err) return reject(err); resolve(row); }
        );
      });

      // Seed nav configs from seeder (single source of truth)
      const { seedHeaderRoleConfigs } = require('../database/headerRoleConfigSeeder');
      await seedHeaderRoleConfigs();

      // Seed menu items from seeder (single source of truth)
      const { seedHeaderMenuItems } = require('../database/headerMenuItemsSeeder');
      await seedHeaderMenuItems();

      // Seed page configs from seeder (single source of truth)
      const { seedHeaderPageConfigs } = require('../database/headerPageConfigsSeeder');
      await seedHeaderPageConfigs();

      if (!existing) {
        seeded.push(role.role_name);
      } else {
        updated.push(role.role_name);
      }
    }

    if (seeded.length)  logger.info(`HeaderConfigModel.seedForAllRoles: seeded  → [${seeded.join(', ')}]`);
    if (updated.length) logger.info(`HeaderConfigModel.seedForAllRoles: updated existing roles → [${updated.join(', ')}]`);

    return { seeded, updated };
  }
}

module.exports = { HeaderConfigModel };
