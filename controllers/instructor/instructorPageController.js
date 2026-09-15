/**
 * controllers/instructor/instructorPageController.js
 * Handles serving the Instructor portal HTML pages.
 * No SQL here — page metadata/validation comes from InstructorPageModel.
 *
 * Self-contained duplicate of the generic page-serving logic, isolated
 * for Instructor so the shared routes/pages.js (login / sidebar / header /
 * meetings / evaluations / reports / profile / content / insights) is untouched.
 * Mirrors controllers/reviewer/reviewerPageController.js / controllers/student/studentPageController.js.
 */
const fs = require('fs');
const path = require('path');
const InstructorPageModel = require('../../models/instructor/InstructorPageModel');

const INSTRUCTOR_DIR = path.join(__dirname, '..', '..', 'public', 'instructor');
const HOME_FILE = 'index.html';

/** Resolve + serve an HTML file, falling back to index if it doesn't exist. */
function serveOrFallback(res, file) {
  const abs = path.join(INSTRUCTOR_DIR, file);
  if (fs.existsSync(abs)) return res.sendFile(abs);
  // Unknown / removed page -> safe fallback so sendFile never 500s.
  return res.sendFile(path.join(INSTRUCTOR_DIR, HOME_FILE));
}

function cleanPage(page) {
  return String(page || '').replace(/\.html$/i, '');
}

const controller = {
  /** GET /instructor and /instructor/ -> index. */
  serveHome: (req, res) => serveOrFallback(res, HOME_FILE),

  /** GET /instructor/:page -> serve single-level page (default index). */
  serveSingle(req, res) {
    const page = cleanPage(req.params.page) || 'index';
    const file = InstructorPageModel.resolveSingleFile(page);
    return serveOrFallback(res, file);
  }
};

module.exports = controller;
