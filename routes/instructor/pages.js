/**
 * routes/instructor/pages.js
 * Dedicated Instructor page routes (self-contained).
 *
 * Duplicates the generic page-serving logic (auth + role guard) so the shared
 * routes/pages.js — which handles login, sidebar/sidemenu, header pages, AND
 * the shared bare /meetings, /evaluations, /reports, /profile, /content/:page,
 * /insights/:page routes (used by both instructor and solo_instructor) — is
 * left completely untouched. Registered in routes/registry.js and mounted at
 * /instructor BEFORE the catch-all pages router so it takes priority.
 * Mirrors routes/reviewer/pages.js / routes/student/pages.js.
 *
 * Preserves the exact role guard the old shared /instructor/:page? route in
 * routes/pages.js used to have: solo_instructor, instructor, reviewer, admin, super_admin.
 */
const express = require('express');
const router = express.Router();
const { verifyToken } = require('../../middleware/auth');
const ctrl = require('../../controllers/instructor/instructorPageController');

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

const guard = [pageAuth, requirePageRole('solo_instructor', 'instructor', 'reviewer', 'admin', 'super_admin')];

router.get('/', guard, ctrl.serveHome);        // /instructor , /instructor/
router.get('/:page', guard, ctrl.serveSingle); // /instructor/dashboard, /instructor/meetings, etc.

module.exports = router;
