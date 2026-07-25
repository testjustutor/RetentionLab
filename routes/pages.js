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

/**
 * Redirect to the correct dashboard based on user role
 */
function redirectToDashboard(req, res) {
  const role = req.user ? req.user.role_name : null;
  if (role === 'super_admin') return res.redirect('/super_admin/index.html');
  if (role === 'admin') return res.redirect('/admin/');
  if (role === 'reviewer') return res.redirect('/reviewer/dashboard');
  if (role === 'instructor' || role === 'solo_instructor') return res.redirect('/instructor/');
  return res.redirect('/dashboard');
}

// ---------------------------------------------------------
// PUBLIC ROUTES
// ---------------------------------------------------------

router.get('/login', (req, res) => {
  // If already logged in, redirect to role-based dashboard
  const token = req.cookies?.auth_token;
  if (token) {
    const payload = verifyToken(token);
    if (payload) {
      req.user = payload;
      return redirectToDashboard(req, res);
    }
  }
  serveHTML(req, res, 'login.html');
});

router.get('/login.html', (req, res) => {
  res.redirect('/login');
});

router.get('/register', (req, res) => {
  const token = req.cookies?.auth_token;
  if (token) {
    const payload = verifyToken(token);
    if (payload) {
      req.user = payload;
      return redirectToDashboard(req, res);
    }
  }
  serveHTML(req, res, 'register.html');
});

router.get('/register.html', (req, res) => {
  res.redirect('/register');
});

router.get('/forgot-password', (req, res) => {
  serveHTML(req, res, 'forgot-password.html');
});

router.get('/forgot-password.html', (req, res) => {
  res.redirect('/forgot-password');
});

router.get('/reset-password', (req, res) => {
  serveHTML(req, res, 'reset-password.html');
});

router.get('/reset-password.html', (req, res) => {
  res.redirect('/reset-password');
});

router.get('/verify-email', (req, res) => {
  serveHTML(req, res, 'verify-email.html');
});

router.get('/verify-email.html', (req, res) => {
  res.redirect('/verify-email');
});

// ---------------------------------------------------------
// PUBLIC MARKETING PAGES (UNPROTECTED)
// ---------------------------------------------------------
router.get('/', (req, res) => { serveHTML(req, res, 'marketing/index.html'); });
router.get('/about', (req, res) => { serveHTML(req, res, 'marketing/about.html'); });
router.get('/services', (req, res) => { serveHTML(req, res, 'marketing/services.html'); });
router.get('/blog', (req, res) => { serveHTML(req, res, 'marketing/blog.html'); });
router.get('/faq', (req, res) => { serveHTML(req, res, 'marketing/faq.html'); });
router.get('/contact', (req, res) => { serveHTML(req, res, 'marketing/contact.html'); });
router.get('/privacy-policy', (req, res) => { serveHTML(req, res, 'marketing/privacy.html'); });
router.get('/terms-conditions', (req, res) => { serveHTML(req, res, 'marketing/terms.html'); });
router.get('/support', (req, res) => { serveHTML(req, res, 'marketing/support.html'); });
router.get('/404', (req, res) => { serveHTML(req, res, 'marketing/404.html'); });

// ---------------------------------------------------------
// PROTECTED DYNAMIC DASHBOARD ALIAS
// Redirects /dashboard to role-based URL so /dashboard never shows in the browser
// ---------------------------------------------------------

router.get('/dashboard', pageAuth, (req, res) => {
  redirectToDashboard(req, res);
});

// ---------------------------------------------------------
// PROTECTED CLEAN URL ROUTES
// ---------------------------------------------------------

// Admin - index
router.get('/admin', pageAuth, requirePageRole('admin', 'super_admin'), (req, res) => {
  serveHTML(req, res, 'admin/index.html');
});

// Admin - single level pages (e.g., /admin/profile, /admin/archives)
router.get('/admin/:page', pageAuth, requirePageRole('admin', 'super_admin'), (req, res, next) => {
  let page = req.params.page;
  if (page.endsWith('.html')) page = page.slice(0, -5);
  // If this looks like a section directory, skip to nested handler
  const sections = ['people', 'meetings', 'content', 'evaluation', 'insights', 'reports', 'settings'];
  if (sections.includes(page)) return next();
  serveHTML(req, res, `admin/${page}.html`);
});

// Admin - nested pages (e.g., /admin/meetings/schedule, /admin/content/recordings)
router.get('/admin/:section/:page', pageAuth, requirePageRole('admin', 'super_admin'), (req, res) => {
  const section = req.params.section;
  let page = req.params.page;
  if (page.endsWith('.html')) page = page.slice(0, -5);
  serveHTML(req, res, `admin/${section}/${page}.html`);
});

// Super Admin pages (nested module routes)
router.get('/super_admin/:section/:page', pageAuth, requirePageRole('super_admin'), (req, res) => {
  const section = req.params.section;
  let page = req.params.page;
  if (page.endsWith('.html')) page = page.slice(0, -5);
  serveHTML(req, res, `super_admin/${section}/${page}.html`);
});

// Super Admin pages (single-level)
router.get('/super_admin/:page?', pageAuth, requirePageRole('super_admin'), (req, res) => {
  let page = req.params.page || 'dashboard/index';
  if (page.endsWith('.html')) page = page.slice(0, -5);
  // Allow `/super_admin/dashboard/index` style fallbacks
  return serveHTML(req, res, `super_admin/${page}.html`);
});


// Reviewer pages
router.get('/reviewer/:page?', pageAuth, requirePageRole('reviewer', 'admin', 'super_admin'), (req, res) => {
  let page = req.params.page || 'index';
  if (page.endsWith('.html')) page = page.slice(0, -5);
  serveHTML(req, res, `reviewer/${page}.html`);
});

// instructor pages
router.get('/instructor/:page?', pageAuth, requirePageRole('solo_instructor', 'instructor', 'reviewer', 'admin', 'super_admin'), (req, res) => {
  let page = req.params.page || 'index';
  if (page.endsWith('.html')) page = page.slice(0, -5);
  serveHTML(req, res, `instructor/${page}.html`);
});

// Solo instructor shared routes (served from instructor folder to match side menu URLs)
router.get('/meetings', pageAuth, requirePageRole('solo_instructor', 'instructor', 'reviewer', 'admin', 'super_admin'), (req, res) => {
  serveHTML(req, res, 'instructor/meetings.html');
});

router.get('/evaluations', pageAuth, requirePageRole('solo_instructor', 'instructor', 'reviewer', 'admin', 'super_admin'), (req, res) => {
  serveHTML(req, res, 'instructor/evaluations.html');
});

router.get('/reports', pageAuth, requirePageRole('solo_instructor', 'instructor', 'reviewer', 'admin', 'super_admin'), (req, res) => {
  serveHTML(req, res, 'instructor/reports.html');
});

router.get('/profile', pageAuth, requirePageRole('solo_instructor', 'instructor', 'reviewer', 'admin', 'super_admin'), (req, res) => {
  serveHTML(req, res, 'instructor/profile.html');
});

router.get('/content/:page', pageAuth, requirePageRole('solo_instructor', 'instructor', 'reviewer', 'admin', 'super_admin'), (req, res) => {
  let page = req.params.page;
  if (page.endsWith('.html')) page = page.slice(0, -5);
  serveHTML(req, res, `instructor/content/${page}.html`);
});

router.get('/insights/:page', pageAuth, requirePageRole('solo_instructor', 'instructor', 'reviewer', 'admin', 'super_admin'), (req, res) => {
  let page = req.params.page;
  if (page.endsWith('.html')) page = page.slice(0, -5);
  serveHTML(req, res, `instructor/insights/${page}.html`);
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
  const safeRootPages = ['schedule-intelligence', 'meeting-overview', 'archives', 'assets', 'audit', 'bot', 'calendar-accounts', 'calendar-events'];
  
  if (safeRootPages.includes(page)) {
    serveHTML(req, res, `${page}.html`);
  } else {
    next(); // Pass to express.static or 404
  }
});

module.exports = router;
