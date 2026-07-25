/**
 * Centralized Route Registry
 * Defines all API routes in one place for better maintainability
 */

const express = require('express');

// Route definitions with metadata
const routeRegistry = [
  // Health & Stats
  { method: 'get', path: '/health', handler: 'index', action: 'health' },
  { method: 'get', path: '/storage/stats', handler: 'index', action: 'storageStats' },
  
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
  { method: 'get', path: '/api/sidebar/menu', handler: 'sidebar-api', middleware: ['auth'] },
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
      router.get(route.path, ...middleware, (req, res, next) => {
        // For inline handlers in index.js
        if (route.handler === 'index') {
          const indexRouter = require('./index');
          // Map action to handler function
          const actionHandlers = {
            health: () => res.json({ status: 'OK', timestamp: new Date() }),
            storageStats: async () => {
              try {
                const fs = require('fs');
                const path = require('path');
                const storageDir = './storage';
                let totalSize = 0;
                
                if (fs.existsSync(storageDir)) {
                  function scanDir(dir) {
                    const files = fs.readdirSync(dir);
                    for (const file of files) {
                      const fullPath = path.join(dir, file);
                      const stat = fs.statSync(fullPath);
                      if (stat.isFile()) {
                        totalSize += stat.size;
                      } else if (stat.isDirectory()) {
                        scanDir(fullPath);
                      }
                    }
                  }
                  scanDir(storageDir);
                }
                
                const totalKB = Math.round(totalSize / 1024);
                const totalMB = (totalKB / 1024).toFixed(1);
                res.json({
                  total: totalMB > 1 ? `${totalMB} MB` : `${totalKB} KB`,
                  bytes: totalSize
                });
              } catch (err) {
                res.status(500).json({ total: '0 KB' });
              }
            },
            googleCallback: async () => {
              // This is handled in index.js directly
              res.status(500).send('Use /auth/google/callback');
            },
            calendarCallback: (req, res, next) => {
              const { state } = req.query;
              if (state && state.startsWith('eyJ')) {
                try {
                  const jwt = require('jsonwebtoken');
                  const VERIFY_SECRET = process.env.INSTRUCTOR_CALENDAR_SECRET || process.env.JWT_SECRET || 'instructor_cal_secure_key_change_me';
                  const payload = jwt.verify(state, VERIFY_SECRET);
                  if (payload?.purpose === 'instructor-calendar-verify') {
                    const ctrl = require('../controllers/calendar/instructorCalendarController');
                    return ctrl.handleCallback(req, res, next);
                  }
                } catch { /* not our JWT, pass through */ }
              }
              next();
            }
          };
          
          if (actionHandlers[route.action]) {
            // Only pass next for handlers that need it (like calendarCallback)
            if (route.action === 'calendarCallback') {
              return actionHandlers[route.action](req, res, next);
            }
            return actionHandlers[route.action](req, res);
          }
        }
        
        // For regular route handlers
        const ctrl = routeHandler[route.action] || routeHandler;
        return ctrl(req, res);
      });
    }
  }
  
  app.use(router);
}

module.exports = { registerRoutes, routeRegistry };