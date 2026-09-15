/**
 * routes/reviewer/pages.js
 * Dedicated Reviewer page routes (self-contained).
 *
 * Duplicates the generic page-serving logic (auth + role guard) so the shared
 * routes/pages.js — which handles login, sidebar/sidemenu and header pages — is
 * left completely untouched. Registered in routes/registry.js and mounted at
 * /reviewer BEFORE the catch-all pages router so it takes priority.
 * Mirrors routes/student/pages.js / routes/super_admin/pages.js.
 *
 * Preserves the exact role guard the old shared /reviewer/:page? route in
 * routes/pages.js used to have: reviewer, admin, super_admin.
 */
const express = require('express');
const router = express.Router();
const { verifyToken } = require('../../middleware/auth');
const ctrl = require('../../controllers/reviewer/reviewerPageController');

function pageAuth(req, res, next) {
  const token = req.cookies?.auth_token;
  if (!token) return res.redirect('/login');
  const payload = verifyToken(token);
  if (!payload) {
    res.clearCookie('auth_token');
    return res.redirect('/login');
  }
  req.user = payload;
  next();
}

function requirePageRole(...allowed) {
  return (req, res, next) => {
    if (!req.user) return res.redirect('/login');
    const role = (req.user.role_name || '').toString();
    if (allowed.includes(role) || allowed.includes('*')) return next();
    return res.redirect('/dashboard');
  };
}

const guard = [pageAuth, requirePageRole('reviewer', 'admin', 'super_admin')];

router.get('/', guard, ctrl.serveHome);        // /reviewer , /reviewer/
router.get('/:page', guard, ctrl.serveSingle); // /reviewer/dashboard, /reviewer/sessions, etc.

module.exports = router;
