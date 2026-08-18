/**
 * controllers/super_admin/superAdminPageController.js
 * Handles serving the Super Admin panel HTML pages.
 * No SQL here — page metadata/validation comes from SuperAdminPageModel.
 *
 * This is a Self-contained duplicate of the generic page-serving logic, isolated
 * for Super Admin so the shared routes/pages.js (login / sidebar / header) is untouched.
 */
const fs = require('fs');
const path = require('path');
const SuperAdminPageModel = require('../../models/super_admin/SuperAdminPageModel');

const SUPER_ADMIN_DIR = path.join(__dirname, '..', '..', 'public', 'super_admin');
const DASHBOARD_FILE = 'dashboard/index.html';

/** Resolve + serve an HTML file, falling back to the dashboard if it doesn't exist. */
function serveOrFallback(res, file) {
  const abs = path.join(SUPER_ADMIN_DIR, file);
  if (fs.existsSync(abs)) return res.sendFile(abs);
  // Unknown / removed page -> safe fallback so sendFile never 500s.
  return res.sendFile(path.join(SUPER_ADMIN_DIR, DASHBOARD_FILE));
}

function cleanPage(page) {
  return String(page || '').replace(/\.html$/i, '');
}

const controller = {
  /** GET /super_admin and /super_admin/ -> dashboard. */
  serveHome: (req, res) => serveOrFallback(res, DASHBOARD_FILE),

  /** GET /super_admin/:section/:page -> serve nested page. */
  serveNested(req, res) {
    const { section, page } = req.params;
    const file = SuperAdminPageModel.resolveNestedFile(section, cleanPage(page));
    return serveOrFallback(res, file || DASHBOARD_FILE);
  },

  /** GET /super_admin/:page -> serve single-level page (default dashboard). */
  serveSingle(req, res) {
    const page = cleanPage(req.params.page);
    const file = SuperAdminPageModel.resolveSingleFile(page);
    return serveOrFallback(res, file);
  }
};

module.exports = controller;