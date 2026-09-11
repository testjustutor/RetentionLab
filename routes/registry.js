/**
 * Centralized Route Registry
 * Defines all API routes in one place for better maintainability
 */

const express = require('express');
const registryController = require('../controllers/registry/registryController');

// Route definitions with metadata
const routeRegistry = [
  // Health & Stats
  { method: 'get', path: '/health', handler: 'registry', action: 'health' },
  { method: 'get', path: '/storage/stats', handler: 'registry', action: 'storageStats' },
  
  // Auth
  { method: 'get', path: '/auth/google/callback', handler: 'index', action: 'googleCallback' },
  { method: 'get', path: '/api/calendar/callback', handler: 'index', action: 'calendarCallback', middleware: ['guest'] },

  // Legacy public verify link — DO NOT remove or change this path. It's the exact
  // URL already emailed to instructors and depended on by the existing Google
  // Calendar OAuth setup. Delegates to the same handler as the current
  // /api/instructor/calendar/verify route (see routes/instructor-calendar-verify-legacy.js).
  { method: 'get', path: '/api/instructor-calendar/verify', handler: 'instructor-calendar-verify-legacy' },

  // Legacy OAuth callback — DO NOT remove or change this path either. It's the
  // redirect_uri instructorCalendarController.verifyToken() sends to Google and
  // the URI registered in the Google Cloud OAuth console, so Google will only
  // ever redirect back here. Delegates to the same handler as the current
  // /api/instructor/calendar/callback route (see routes/instructor-calendar-callback-legacy.js).
  { method: 'get', path: '/api/instructor-calendar/callback', handler: 'instructor-calendar-callback-legacy' },
  
  // Bot & Calendar
  { method: 'use', path: '/api/bot', handler: 'bot' },
  { method: 'use', path: '/api/monitoring', handler: 'monitoring' },
  { method: 'use', path: '/api/calendar', handler: 'calendar' },
  { method: 'use', path: '/api/calendar-integrations', handler: 'calendar-integrations' },
  
  // Meetings
  { method: 'use', path: '/api/meetings', handler: 'meetings' },
  { method: 'use', path: '/api/meeting-schedule', handler: 'meeting-schedule' },
  { method: 'use', path: '/api/admin/meeting-schedule', handler: 'meeting-schedule' },
  { method: 'use', path: '/api/meetings/reports', handler: 'meeting-reports' },
  
  // Users & Auth
  { method: 'use', path: '/api/users', handler: 'users' },
  { method: 'use', path: '/api/admin/users', handler: 'users' },
  { method: 'use', path: '/api/admin/people/users', handler: 'users' },
  { method: 'use', path: '/api/auth', handler: 'auth' },
  { method: 'use', path: '/api/roles', handler: 'roles' },
  { method: 'use', path: '/api/companies', handler: 'companies' },
  { method: 'use', path: '/api/departments', handler: 'departments' },
  
  // Dashboard
  { method: 'use', path: '/api/admin/dashboard', handler: 'dashboard' },
  
  // Admin Settings
  { method: 'use', path: '/api/admin/settings', handler: 'settings' },
  
  // Admin Rubrics & Reviews
  { method: 'use', path: '/api/admin/evaluation/rubrics', handler: 'rubrics' },
  { method: 'use', path: '/api/admin/rubric-admin', handler: 'rubric-admin' },
  { method: 'use', path: '/api/admin/reviews', handler: 'reviews' },
  { method: 'use', path: '/api/admin/reviewers', handler: 'reviewers' },
  { method: 'use', path: '/api/admin/scores', handler: 'scores' },
  { method: 'use', path: '/api/scores', handler: 'scores', middleware: ['auth'] },
  
  // Reviewer Portal (dedicated MVC folders: controllers/reviewer, models/reviewer, routes/reviewer)
  // Replaces the old flat mounts: /api/reviewer-dashboard, /api/reviewer-sessions,
  // /api/reviewer-reviews, /api/reviewer-scores, /api/tutor-evaluation.
  { method: 'use', path: '/api/reviewer', handler: 'reviewer', middleware: ['auth'] },

  // Reviewer page routes (self-contained; takes priority over the catch-all pages router.
  // lives in routes/reviewer/pages.js + reviewerPageController + ReviewerPageModel.
  // Does NOT touch routes/pages.js login/sidebar/header routes.)
  { method: 'use', path: '/reviewer', handler: 'reviewer/pages' },

  // Admin Transcripts & Media
  { method: 'use', path: '/api/admin/transcripts', handler: 'transcripts' },
  { method: 'use', path: '/api/admin/content', handler: 'content-dashboard' },
  { method: 'use', path: '/api/admin/assets', handler: 'assets' },
  
  // Admin Audit & Reports
  { method: 'use', path: '/api/admin/audit', handler: 'audit' },
  { method: 'use', path: '/api/admin/audit-reports', handler: 'audit-reports' },
  { method: 'use', path: '/api/admin/evaluations/reports', handler: 'evaluation-reports' },
  { method: 'use', path: '/api/admin/reports/teams', handler: 'team-reports' },

  
  // Admin Archives
  { method: 'use', path: '/api/admin/archives', handler: 'archives' },
  
  // Admin Header & Sidebar
  { method: 'use', path: '/api/header-config', handler: 'header-config' },
  { method: 'use', path: '/api/sidebar', handler: 'sidebar-api' },
  { method: 'use', path: '/api/sidebar-menu-admin', handler: 'sidebar-menu-admin' },
  
  // Admin Menu Management
  { method: 'use', path: '/api/admin/menu', handler: 'menu' },
  
  // Database Admin
  { method: 'use', path: '/api/db', handler: 'db-admin' },
  
  // Google Credentials (legacy)
  { method: 'use', path: '/api/google-credentials', handler: 'google-credentials' },

  { method: 'use', path: '/api/admin/meetings/calendar', handler: 'meetings-calendar' },

  // Instructor Portal (dedicated MVC folders: controllers/instructor, models/instructor, routes/instructor)
  // Replaces the old flat mounts: /api/instructor-dashboard, /api/instructor-calendar,
  // /api/admin/instructor-meetings.
  // NOTE: no global 'auth' middleware here (unlike /api/reviewer) — calendar.js
  // has public sub-routes (verify, self-request, callback) that Google/instructor
  // emails hit without a session; each sub-router (dashboard/calendar/meetings/profile)
  // applies its own requireAuth where needed, exactly as the old flat mounts did.
  { method: 'use', path: '/api/instructor', handler: 'instructor' },

  // Instructor page routes (self-contained; takes priority over the catch-all pages router.
  // lives in routes/instructor/pages.js + instructorPageController + InstructorPageModel.
  // Does NOT touch routes/pages.js login/sidebar/header/meetings/evaluations/reports/profile routes.)
  { method: 'use', path: '/instructor', handler: 'instructor/pages' },

  // Admin Tutoring & Session Quality
  { method: 'use', path: '/api/admin/tutoring', handler: 'tutoring' },
  { method: 'use', path: '/api/admin/participants', handler: 'participants' },
  
  // Admin Insights
  { method: 'use', path: '/api/admin/insights', handler: 'insights' },
  
  // Configuration Pages (super admin)
  { method: 'use', path: '/super_admin/configuration', handler: 'configuration' },

  // Super Admin Panel (dedicated MVC folders: controllers/super_admin, models/super_admin, routes/super_admin)
  { method: 'use', path: '/api/super_admin', handler: 'super_admin' },

  // Super Admin dashboard stats (new URL used by public/js/super_admin/dashboard/index.js)
  { method: 'use', path: '/api/super-admin', handler: 'super_admin' },

  // Super Admin page routes (self-contained; takes priority over the catch-all pages router.
  // lives in routes/super_admin/pages.js + superAdminPageController + SuperAdminPageModel.
  // Does NOT touch routes/pages.js login/sidebar/header routes.)
  { method: 'use', path: '/super_admin', handler: 'super_admin/pages' },
  
  // Student Portal (dedicated MVC folders: controllers/student, models/student, routes/student)
  { method: 'use', path: '/api/student', handler: 'student' },

  // Student page routes (self-contained; takes priority over the catch-all pages router.
  // lives in routes/student/pages.js + studentPageController + StudentPageModel.
  // Does NOT touch routes/pages.js login/sidebar/header routes.)
  { method: 'use', path: '/student', handler: 'student/pages' },

  // Per-table control visibility (search / entries / info / pagination)
  { method: 'use', path: '/api/tables', handler: 'table-controls' },

  // Page routes (must be last)
  { method: 'use', path: '/', handler: 'pages' },
];

// Middleware mapping
const middlewareMap = {
  auth: require('../middleware/auth').requireAuth,
  guest: require('../middleware/auth').guestOnly,
};

/**
 * Register all routes from the registry
 * @param {express.Application} app - Express app instance
 */
function registerRoutes(app) {
  const router = express.Router();
  
  for (const route of routeRegistry) {
    const middleware = route.middleware 
      ? route.middleware.map(m => middlewareMap[m]).filter(Boolean)
      : [];
    
    const routeHandler = require(`./${route.handler}`);
    
    if (route.method === 'use') {
      router.use(route.path, ...middleware, routeHandler);
    } else if (route.method === 'get') {
      // For registry actions, use registryController
      // For other handlers, use the route handler's action method
      const ctrl = route.handler === 'registry' 
        ? registryController[route.action] 
        : (routeHandler[route.action] || routeHandler);
      if (typeof ctrl === 'function') {
        router.get(route.path, ...middleware, ctrl);
      }
    } else if (route.method === 'post') {
      // For registry actions, use registryController
      // For other handlers, use the route handler's action method
      const ctrl = route.handler === 'registry' 
        ? registryController[route.action] 
        : (routeHandler[route.action] || routeHandler);
      if (typeof ctrl === 'function') {
        router.post(route.path, ...middleware, ctrl);
      }
    }
  }
  
  app.use(router);
}

module.exports = { registerRoutes, routeRegistry };
