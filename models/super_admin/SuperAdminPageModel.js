/**
 * models/super_admin/SuperAdminPageModel.js
 * Data access / registry for the Super Admin panel pages.
 * Knows which HTML pages exist under public/super_admin and how a URL maps to a file.
 * This keeps page metadata out of controllers and routes (Model layer).
 */
class SuperAdminPageModel {
  /**
   * Registry of Super Admin pages (relative to public/super_admin, without .html).
   * - nested: section -> [page names]
   * - single: flat page names served directly under /super_admin/<name>
   */
  static getPages() {
    return {
      nested: {
        'dashboard': ['index'],
        'monitoring': ['server', 'platforms', 'audit'],
        'people': ['access-control', 'add-user', 'manage-rubrics', 'manage-users', 'profile', 'user-settings'],
        'reports': [],
        'roles': ['roles-access', 'rubric-management'],
        'settings': ['bot-configuration', 'header-management', 'sidebar-menu-management', 'table-controls', 'user-defaults', 'ai-providers', 'platforms'],
        'content': ['archives', 'assets']
      },
      single: ['index', 'dashboard']
    };
  }

  /** True if the page name is a registered single-level page. */
  static isSingle(page) {
    return (this.getPages().single || []).includes(page);
  }

  /** True if a section/page combination is registered. */
  static isNested(section, page) {
    const list = this.getPages().nested[section];
    return !!(list && list.includes(page));
  }

  /** Resolve a nested (section/page) route to a file path or null. */
  static resolveNestedFile(section, page) {
    if (!this.isNested(section, page)) return null;
    return `${section}/${page}.html`;
  }

  /** Resolve a single-level page to a file path or null (falls back to dashboard). */
  static resolveSingleFile(page) {
    if (this.isSingle(page)) return `${page}.html`;
    return 'dashboard/index.html';
  }
}

module.exports = SuperAdminPageModel;