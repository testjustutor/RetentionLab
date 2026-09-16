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
        // FIX: 'platforms' removed - no public/super_admin/monitoring/platforms.html
        // exists (only server.html and audit.html do). The settings section below
        // has its own separate 'platforms' entry, which does map to a real file
        // (public/super_admin/settings/platforms.html) and is unaffected.
        'monitoring': ['server', 'audit'],
        'people': ['add-user', 'manage-rubrics', 'manage-users', 'profile', 'user-settings'],
        'reports': ['meeting-ai-evaluation-report', 'meeting-ai-session-report'],
        'roles': ['roles-access', 'rubric-management'],
        'settings': ['bot-configuration', 'header-management', 'sidebar-menu-management', 'table-controls', 'user-defaults', 'ai-providers', 'platforms', 'calendar-integrations'],
        // FIX: 'deepgram-processing' removed - no matching .html file exists under
        // public/super_admin/content (only archives.html, assets.html and
        // video-processing.html do).
        'content': ['archives', 'assets', 'video-processing']
      },
      // FIX: was ['index', 'dashboard'], but neither public/super_admin/index.html
      // nor public/super_admin/dashboard.html exists (dashboard/ is a directory
      // containing dashboard/index.html, served via the nested registry above).
      // isSingle() always returned false for every real request anyway, so this
      // was dead config; emptied out so resolveSingleFile() explicitly always
      // falls back to dashboard/index.html, matching actual behavior.
      single: []
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