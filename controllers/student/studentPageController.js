/**
 * controllers/student/studentPageController.js
 * Handles serving the Student portal HTML pages.
 * No SQL here — page metadata/validation comes from StudentPageModel.
 *
 * Self-contained duplicate of the generic page-serving logic, isolated
 * for Student so the shared routes/pages.js (login / sidebar / header) is untouched.
 * Mirrors controllers/super_admin/superAdminPageController.js.
 */
const fs = require('fs');
const path = require('path');
const StudentPageModel = require('../../models/student/StudentPageModel');

const STUDENT_DIR = path.join(__dirname, '..', '..', 'public', 'student');
const DASHBOARD_FILE = 'dashboard.html';

/** Resolve + serve an HTML file, falling back to the dashboard if it doesn't exist. */
function serveOrFallback(res, file) {
  const abs = path.join(STUDENT_DIR, file);
  if (fs.existsSync(abs)) return res.sendFile(abs);
  // Unknown / removed page -> safe fallback so sendFile never 500s.
  return res.sendFile(path.join(STUDENT_DIR, DASHBOARD_FILE));
}

function cleanPage(page) {
  return String(page || '').replace(/\.html$/i, '');
}

const controller = {
  /** GET /student and /student/ -> dashboard. */
  serveHome: (req, res) => serveOrFallback(res, DASHBOARD_FILE),

  /** GET /student/:page -> serve single-level page (default dashboard). */
  serveSingle(req, res) {
    const page = cleanPage(req.params.page);
    const file = StudentPageModel.resolveSingleFile(page);
    return serveOrFallback(res, file);
  }
};

module.exports = controller;
