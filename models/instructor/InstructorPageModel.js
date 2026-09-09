/**
 * models/instructor/InstructorPageModel.js
 * Registry for the Instructor portal pages.
 * Knows which HTML pages exist under public/instructor and how a URL maps to a file.
 * Mirrors models/reviewer/ReviewerPageModel.js / models/student/StudentPageModel.js.
 *
 * NOTE: content/* and insights/* (nested section pages) are intentionally NOT
 * listed here — those, plus the bare /meetings, /evaluations, /reports, /profile
 * URLs, are served by the shared routes/pages.js because they're used by BOTH
 * the instructor and solo_instructor roles via seeded sidebar menu hrefs that
 * point directly at those bare paths. Moving them here would break that
 * existing navigation. This model only covers instructor's own /instructor/:page?
 * namespace (single-level pages under public/instructor).
 */
class InstructorPageModel {
  /**
   * Registry of Instructor pages (relative to public/instructor, without .html).
   */
  static getPages() {
    return {
      single: ['index', 'dashboard', 'meetings', 'evaluations', 'reports', 'profile']
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

module.exports = InstructorPageModel;
