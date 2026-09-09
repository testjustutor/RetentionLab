/**
 * models/student/StudentPageModel.js
 * Registry for the Student portal pages.
 * Knows which HTML pages exist under public/student and how a URL maps to a file.
 * Mirrors models/super_admin/SuperAdminPageModel.js.
 */
class StudentPageModel {
  /**
   * Registry of Student pages (relative to public/student, without .html).
   */
  static getPages() {
    return {
      single: ['dashboard', 'reports', 'profile']
    };
  }

  /** True if the page name is a registered single-level page. */
  static isSingle(page) {
    return (this.getPages().single || []).includes(page);
  }

  /** Resolve a single-level page to a file path (falls back to dashboard). */
  static resolveSingleFile(page) {
    if (this.isSingle(page)) return `${page}.html`;
    return 'dashboard.html';
  }
}

module.exports = StudentPageModel;
