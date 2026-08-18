/**
 * routes/super_admin/pages.js
 * Dedicated Super Admin page routes (self-contained).
 *
 * Duplicates the generic page-serving logic (auth + role guard) so the shared
 * routes/pages.js — which handles login, sidebar/sidemenu and header pages — is
 * left completely untouched. Registered in routes/registry.js and mounted at
 * /super_admin BEFORE the catch-all pages router so it takes priority.
 */
const express = require('express');
const router = express.Router();
const { verifyToken } = require('../../middleware/auth');
const ctrl = require('../../controllers/super_admin/superAdminPageController');

// Protect Super Admin page routes (duplicate of pages.js pageAuth).
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

const guard = [pageAuth, requirePageRole('super_admin')];

router.get('/', guard, ctrl.serveHome);                 // /super_admin , /super_admin/
router.get('/:section/:page', guard, ctrl.serveNested); // /super_admin/dashboard/index etc.
router.get('/:page', guard, ctrl.serveSingle);          // /super_admin/index etc.

module.exports = router;