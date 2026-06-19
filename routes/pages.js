/**
 * root/routes/pages.js
 */
const express = require('express');
const path = require('path');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// Middleware to protect page routes
function pageAuth(req, res, next) {
  const token = req.cookies?.auth_token;
  if (!token) {
    return res.redirect('/login');
  }
  
  const payload = verifyToken(token);
  if (!payload) {
    res.clearCookie('auth_token');
    return res.redirect('/login');
  }

  req.user = payload;
  next();
}

// Middleware to check roles for page routes
function requirePageRole(...allowed) {
  return (req, res, next) => {
    if (!req.user) return res.redirect('/login');
    const role = (req.user.role_name || '').toString();
    if (allowed.includes(role) || allowed.includes('*')) {
      return next();
    }
    // If unauthorized, redirect to their role's dashboard
    return res.redirect('/dashboard');
  };
}

// Serve a specific HTML file safely
function serveHTML(req, res, filename) {
  res.sendFile(path.join(__dirname, '../public', filename));
}

// ---------------------------------------------------------
// PUBLIC ROUTES
// ---------------------------------------------------------

router.get('/login', (req, res) => {
  // If already logged in, redirect to dashboard
  const token = req.cookies?.auth_token;
  if (token && verifyToken(token)) {
    return res.redirect('/dashboard');
  }
  serveHTML(req, res, 'login.html');
});

router.get('/register', (req, res) => {
  const token = req.cookies?.auth_token;
  if (token && verifyToken(token)) {
    return res.redirect('/dashboard');
  }
  serveHTML(req, res, 'register.html');
});

// ---------------------------------------------------------
// PUBLIC MARKETING PAGES (UNPROTECTED)
// ---------------------------------------------------------
// IMPORTANT: These routes are intentionally outside auth/pageAuth
// so the marketing site is accessible without logging in.
router.get('/', (req, res) => {
  serveHTML(req, res, 'marketing/index.html');
});

router.get('/about', (req, res) => {
  serveHTML(req, res, 'marketing/about.html');
});

router.get('/services', (req, res) => {
  serveHTML(req, res, 'marketing/services.html');
});

router.get('/blog', (req, res) => {
  serveHTML(req, res, 'marketing/blog.html');
});

router.get('/faq', (req, res) => {
  serveHTML(req, res, 'marketing/faq.html');
});

router.get('/contact', (req, res) => {
  serveHTML(req, res, 'marketing/contact.html');
});

router.get('/privacy-policy', (req, res) => {
  serveHTML(req, res, 'marketing/privacy.html');
});

router.get('/terms-conditions', (req, res) => {
  serveHTML(req, res, 'marketing/terms.html');
});

// Friendly marketing 404 page
router.get('/404', (req, res) => {
  serveHTML(req, res, 'marketing/404.html');
});

// Redirect root (fallback for legacy auth app landing)
// Note: When user is logged in and wants app, they can navigate to /dashboard.
// We keep the redirect logic only for the auth app; marketing home is now '/'.
// router.get('/', (req, res) => res.redirect('/dashboard'));


// ---------------------------------------------------------
// PROTECTED DYNAMIC DASHBOARD ALIAS
// ---------------------------------------------------------

router.get('/dashboard', pageAuth, (req, res) => {
  const role = req.user.role_name;
  if (role === 'super_admin') {
    serveHTML(req, res, 'super_admin/index.html');
  } else if (role === 'admin') {
    serveHTML(req, res, 'admin/index.html');
  } else if (role === 'reviewer') {
    serveHTML(req, res, 'reviewer/index.html');
  } else {
    serveHTML(req, res, 'employee/index.html');
  }
});

// ---------------------------------------------------------
// PROTECTED CLEAN URL ROUTES
// ---------------------------------------------------------

// Admin pages
router.get('/admin/:page?', pageAuth, requirePageRole('admin', 'super_admin'), (req, res) => {
  let page = req.params.page || 'index';
  if (page.endsWith('.html')) page = page.slice(0, -5);
  serveHTML(req, res, `admin/${page}.html`);
});

// Super Admin pages
router.get('/super_admin/:page?', pageAuth, requirePageRole('super_admin'), (req, res) => {
  let page = req.params.page || 'index';
  if (page.endsWith('.html')) page = page.slice(0, -5);
  serveHTML(req, res, `super_admin/${page}.html`);
});

// Reviewer pages
router.get('/reviewer/:page?', pageAuth, requirePageRole('reviewer', 'admin', 'super_admin'), (req, res) => {
  let page = req.params.page || 'index';
  if (page.endsWith('.html')) page = page.slice(0, -5);
  serveHTML(req, res, `reviewer/${page}.html`);
});

// Employee pages
router.get('/employee/:page?', pageAuth, requirePageRole('employee', 'reviewer', 'admin', 'super_admin'), (req, res) => {
  let page = req.params.page || 'index';
  if (page.endsWith('.html')) page = page.slice(0, -5);
  serveHTML(req, res, `employee/${page}.html`);
});

// Marketing catch-all 404 for unknown public marketing paths
// (Only triggers when the path is NOT one of the known protected app routes)
router.get('*', (req, res, next) => {
  // Let express static or other routers handle their own assets first.
  next();
});

// General protected pages (in public root)
router.get('/:page', pageAuth, (req, res, next) => {

  let page = req.params.page;
  if (page.endsWith('.html')) page = page.slice(0, -5);
  
  // Ignore API routes and static assets that haven't been caught yet
  if (page.startsWith('api') || page.startsWith('storage')) return next();
  
  // Safe list of root pages that need auth
  const safeRootPages = ['schedule-intelligence', 'meeting-overview', 'archives', 'assets', 'audit', 'bot', 'calendar-accounts', 'calendar-events', 'calendar-integrations', 'data-architecture'];
  
  if (safeRootPages.includes(page)) {
    serveHTML(req, res, `${page}.html`);
  } else {
    next(); // Pass to express.static or 404
  }
});

module.exports = router;
