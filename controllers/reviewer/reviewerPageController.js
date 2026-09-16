/**
 * controllers/reviewer/reviewerPageController.js
 * Handles serving the Reviewer portal HTML pages.
 * No SQL here — page metadata/validation comes from ReviewerPageModel.
 *
 * Self-contained duplicate of the generic page-serving logic, isolated
 * for Reviewer so the shared routes/pages.js (login / sidebar / header) is untouched.
 * Mirrors controllers/student/studentPageController.js / controllers/super_admin/superAdminPageController.js.
 */
const fs = require('fs');
const path = require('path');
const ReviewerPageModel = require('../../models/reviewer/ReviewerPageModel');

const REVIEWER_DIR = path.join(__dirname, '..', '..', 'public', 'reviewer');
// FIX: was 'index.html', which is a thin static shell (profile card + 2
// links, no data-loading script). 'dashboard.html' is the real dashboard -
// stat tiles (pending/in-progress/completed/avg time), recent assignments,
// overdue reviews, all populated by js/reviewer/dashboard.js - so GET
// /reviewer and /reviewer/ were serving the wrong page. index.html is still
// reachable directly at /reviewer/index for anyone who wants the shell.
const HOME_FILE = 'dashboard.html';

/** Resolve + serve an HTML file, falling back to index if it doesn't exist. */
function serveOrFallback(res, file) {
  const abs = path.join(REVIEWER_DIR, file);
  if (fs.existsSync(abs)) return res.sendFile(abs);
  // Unknown / removed page -> safe fallback so sendFile never 500s.
  return res.sendFile(path.join(REVIEWER_DIR, HOME_FILE));
}

function cleanPage(page) {
  return String(page || '').replace(/\.html$/i, '');
}

const controller = {
  /** GET /reviewer and /reviewer/ -> index. */
  serveHome: (req, res) => serveOrFallback(res, HOME_FILE),

  /** GET /reviewer/:page -> serve single-level page (default index). */
  serveSingle(req, res) {
    const page = cleanPage(req.params.page) || 'index';
    const file = ReviewerPageModel.resolveSingleFile(page);
    return serveOrFallback(res, file);
  }
};

module.exports = controller;
