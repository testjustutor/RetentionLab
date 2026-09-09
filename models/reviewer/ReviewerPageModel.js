/**
 * models/reviewer/ReviewerPageModel.js
 * Registry for the Reviewer portal pages.
 * Knows which HTML pages exist under public/reviewer and how a URL maps to a file.
 * Mirrors models/student/StudentPageModel.js / models/super_admin/SuperAdminPageModel.js.
 */
class ReviewerPageModel {
  /**
   * Registry of Reviewer pages (relative to public/reviewer, without .html).
   */
  static getPages() {
    return {
      single: ['index', 'dashboard', 'sessions', 'evaluations', 'reviews', 'score', 'analytics', 'profile', 'evaluation-summary']
    };
  }

  /** True if the page name is a registered single-level page. */
  static isSingle(page) {
    return (this.getPages().single || []).includes(page);
  }

  /** Resolve a single-level page to a file path (falls back to index). */
  static resolveSingleFile(page) {
    if (this.isSingle(page)) return `${page}.html`;
    return 'index.html';
  }
}

module.exports = ReviewerPageModel;
