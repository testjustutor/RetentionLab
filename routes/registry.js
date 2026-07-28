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
  
  // Bot & Calendar
  { method: 'use', path: '/api/bot', handler: 'bot' },
  { method: 'use', path: '/api/monitoring', handler: 'monitoring' },
  { method: 'use', path: '/api/calendar', handler: 'calendar' },
  { method: 'use', path: '/api/calendar-integrations', handler: 'calendar-integrations' },
  
  // Meetings
  { method: 'use', path: '/api/meetings', handler: 'meetings' },
  { method: 'use', path: '/api/meeting-schedule', handler: 'meeting-schedule' },
  { method: 'use', path: '/api/meetings/reports', handler: 'meeting-reports' },
  
  // Users & Auth
  { method: 'use', path: '/api/users', handler: 'users' },
  { method: 'use', path: '/api/auth', handler: 'auth' },
  { method: 'use', path: '/api/roles', handler: 'roles' },
  { method: 'use', path: '/api/companies', handler: 'companies' },
  { method: 'use', path: '/api/departments', handler: 'departments' },
  
  // Dashboard
  { method: 'use', path: '/api/dashboard', handler: 'dashboard' },
  { method: 'use', path: '/api/instructor-dashboard', handler: 'instructor-dashboard' },
  
  // Settings
  { method: 'use', path: '/api/settings', handler: 'settings' },
  
  // Rubrics & Reviews
  { method: 'use', path: '/api/rubrics', handler: 'rubrics' },
  { method: 'use', path: '/api/rubric-admin', handler: 'rubric-admin' },
  { method: 'use', path: '/api/reviews', handler: 'reviews' },
  { method: 'use', path: '/api/reviewers', handler: 'reviewers' },
  { method: 'use', path: '/api/scores', handler: 'scores' },
  
  // Reviewer Dashboard
  { method: 'use', path: '/api/reviewer-dashboard', handler: 'reviewer-dashboard', middleware: ['auth'] },
  { method: 'use', path: '/api/reviewer-sessions', handler: 'reviewer-sessions', middleware: ['auth'] },
  { method: 'use', path: '/api/reviewer-reviews', handler: 'reviewer-reviews', middleware: ['auth'] },
  
  // Transcripts & Media
  { method: 'use', path: '/api/transcripts', handler: 'transcripts' },
  { method: 'use', path: '/api/recordings', handler: 'recordings-dashboard' },
  { method: 'use', path: '/api/assets', handler: 'assets' },
  
  // Audit & Reports
  { method: 'use', path: '/api/audit', handler: 'audit' },
  { method: 'use', path: '/api/audit-reports', handler: 'audit-reports' },
  { method: 'use', path: '/api/evaluations/reports', handler: 'evaluation-reports' },
  
  // Archives
  { method: 'use', path: '/api/archives', handler: 'archives' },
  
  // Header & Sidebar
  { method: 'use', path: '/api/header-config', handler: 'header-config' },
  { method: 'get', path: '/api/sidebar/menu', handler: 'sidebar-api', middleware: ['auth'], action: 'getMenu' },
  { method: 'use', path: '/api/sidebar-menu-admin', handler: 'sidebar-menu-admin' },
  
  // Menu Management
  { method: 'use', path: '/api/menu', handler: 'menu' },
  
  // Database Admin
  { method: 'use', path: '/api/db', handler: 'db-admin' },
  
  // Google Credentials (legacy)
  { method: 'use', path: '/api/google-credentials', handler: 'google-credentials' },
  
  // Instructor Calendar
  { method: 'use', path: '/api/instructor-calendar', handler: 'instructor-calendar' },
  { method: 'use', path: '/api/instructor-meetings', handler: 'instructor-meetings' },
  
  // Tutoring & Session Quality
  { method: 'use', path: '/api/tutoring', handler: 'tutoring' },
  { method: 'use', path: '/api/participants', handler: 'participants' },
  
  // Configuration Pages (super admin)
  { method: 'use', path: '/super_admin/configuration', handler: 'configuration' },
  
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
    }
  }
  
  app.use(router);
}

module.exports = { registerRoutes, routeRegistry };