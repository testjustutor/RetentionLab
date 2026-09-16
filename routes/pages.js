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
  if (role === 'super_admin') return res.redirect('/super_admin/index');
  if (role === 'admin') return res.redirect('/admin/');
  if (role === 'reviewer') return res.redirect('/reviewer/dashboard');
  if (role === 'instructor' || role === 'solo_instructor') return res.redirect('/instructor/');
  if (role === 'student') return res.redirect('/student/dashboard');
  return res.redirect('/login');
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

// Backward-compatible aliases so legacy/cached scripts that load `/header`,
// `/sidebar` or `/common_footer` (without .html) still resolve to the actual
// component files instead of 404ing (which previously caused a "missing )"
// SyntaxError in the console when the 404 HTML body was parsed as JS).
router.get('/header', (req, res) => { serveHTML(req, res, 'header.html'); });
router.get('/header.html', (req, res) => { serveHTML(req, res, 'header.html'); });
router.get('/sidebar', (req, res) => { serveHTML(req, res, 'sidebar.html'); });
router.get('/sidebar.html', (req, res) => { serveHTML(req, res, 'sidebar.html'); });

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
// FIX: the other 9 marketing routes that used to live here (about, services,
// blog, faq, contact, privacy-policy, terms-conditions, support, 404) each
// pointed at a public/marketing/*.html file that does not exist on disk -
// only marketing/index.html does. They were dead routes that would 500 on
// res.sendFile's ENOENT if ever hit, and nothing in marketing/index.html
// links to any of them. Removed rather than left as broken links; add them
// back if/when the corresponding marketing pages are actually built.

// ---------------------------------------------------------
// LOGOUT ROUTE (direct access for sidebar links)
// ---------------------------------------------------------

router.get('/logout', (req, res) => {
  try {
    // Clear the auth cookie
    res.clearCookie('auth_token', { 
      httpOnly: true, 
      sameSite: 'lax', 
      secure: process.env.NODE_ENV === 'production' 
    });
    
    // Clear any other cookies if needed
    res.clearCookie('connect.sid');
    
    // Redirect to login page
    return res.redirect('/login');
  } catch (err) {
    console.error('Logout error:', err);
    return res.redirect('/login');
  }
});

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


// NOTE: Reviewer pages moved to routes/reviewer/pages.js (dedicated MVC scaffold,
// mirrors routes/super_admin/pages.js), mounted at /reviewer in routes/registry.js
// BEFORE the catch-all pages router below, so it takes priority over this file.

// NOTE: Instructor's own /instructor/:page? pages moved to routes/instructor/pages.js
// (dedicated MVC scaffold, mirrors routes/reviewer/pages.js), mounted at /instructor in
// routes/registry.js BEFORE the catch-all pages router below, so it takes priority over
// this file. The bare shared routes below (/meetings, /evaluations, /reports, /profile,
// /content/:page, /insights/:page) are NOT moved — they serve the same public/instructor/
// files but are used by BOTH instructor and solo_instructor via seeded sidebar menu hrefs
// that point directly at these bare paths, so they must stay here.

// NOTE: Student pages moved to routes/student/pages.js (dedicated MVC scaffold,
// mirrors routes/super_admin/pages.js), mounted at /student in routes/registry.js
// BEFORE the catch-all pages router below, so it takes priority over this file.

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
// FIX: safeRootPages used to list 8 names (schedule-intelligence,
// meeting-overview, archives, assets, audit, bot, calendar-accounts,
// calendar-events) but none of them has a matching .html file directly under
// public/ - every real page for these topics lives under a role-scoped
// folder instead (e.g. public/admin/archives.html via the /admin/:page
// route above, or public/super_admin/monitoring/audit.html via the nested
// super_admin route). Hitting any of these 8 root paths would call
// res.sendFile on a nonexistent file and error instead of cleanly 404-ing.
// Emptied the list rather than deleting the route, since the auth-gate
// behavior (redirect to /login when unauthenticated) may still be relied on
// by callers probing these paths; next() now always falls through to
// express.static/404 for any :page value, matching what already happened
// for every one of these 8 names in practice.
router.get('/:page', pageAuth, (req, res, next) => {

  let page = req.params.page;
  if (page.endsWith('.html')) page = page.slice(0, -5);

  // Ignore API routes and static assets that haven't been caught yet
  if (page.startsWith('api') || page.startsWith('storage')) return next();

  const safeRootPages = [];

  if (safeRootPages.includes(page)) {
    serveHTML(req, res, `${page}.html`);
  } else {
    next(); // Pass to express.static or 404
  }
});

module.exports = router;
