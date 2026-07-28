/**
 * controllers/sidebar/sidebarApiController.js
 * Sidebar API controller
 */
const MenuModel = require('../../models/menu/MenuModel');

const controller = {
  async getMenu(req, res) {
    try {
      const userId = req.user?.id;
      const roleId = req.user?.role_id;
      const userRole = req.user?.role_name || 'instructor';

      let menuTree = [];
      if (roleId) {
        try {
          menuTree = await MenuModel.getResolvedMenuForUser(userId, roleId);
        } catch (err) {
          console.error('sidebar-api: failed to load menu from DB:', err);
        }
      }

      const ADMIN_ROUTE_MAP = {
        'dashboard': '/admin/',
        'add-user': '/admin/add-user',
        'archives': '/admin/archives',
        'users': '/admin/people/users',
        'departments': '/admin/people/departments',
        'roles': '/admin/people/roles',
        'profile': '/admin/profile',
        'schedule': '/admin/meetings/schedule',
        'live': '/admin/meetings/live',
        'completed': '/admin/meetings/completed',
        'calendar': '/admin/meetings/calendar',
        'recordings': '/admin/content/recordings',
        'transcripts': '/admin/content/transcripts',
        'summaries': '/admin/content/summaries',
        'rubrics': '/admin/evaluation/rubrics',
        'reviews': '/admin/evaluation/reviews',
        'scores': '/admin/evaluation/scores',
        'performance': '/admin/evaluation/performance',
        'engagement': '/admin/insights/engagement',
        'actions': '/admin/insights/actions',
        'decisions': '/admin/insights/decisions',
        'risks': '/admin/insights/risks',
        'analytics': '/admin/insights/analytics',
        'meeting-reports': '/admin/reports/meetings',
        'evaluation-reports': '/admin/reports/evaluations',
        'team-reports': '/admin/reports/teams',
        'audit-reports': '/admin/reports/audits',
        'session-quality': '/admin/session-quality/index',
        'sq-hub': '/admin/session-quality/index',
        'sq-rubric': '/admin/session-quality/rubric',
        'sq-analysis': '/admin/session-quality/analysis',
        'sq-impact': '/admin/session-quality/impact',
        'sq-parent-summary': '/admin/session-quality/parent-summary',
        'sq-coaching': '/admin/session-quality/coaching',
        'sq-better-alt': '/admin/session-quality/better-alternatives',
        'sq-next-plan': '/admin/session-quality/next-plan',
        'sq-flags': '/admin/session-quality/flags',
        'sq-final-eval': '/admin/session-quality/final-eval',
        'organization': '/admin/settings/organization',
        'notifications': '/admin/settings/notifications',
        'meeting-rules': '/admin/settings/meetings',
        'integrations': '/admin/settings/integrations',
        'calendar-accounts': '/admin/calendar-accounts',
        'calendar-events': '/admin/calendar-events'
      };

      function fixRoutePaths(items, role) {
        if (!items || !Array.isArray(items)) return items;
        return items.map(item => {
          const fixed = { ...item };
          if (role === 'admin' && ADMIN_ROUTE_MAP[fixed.menu_key || fixed.id]) {
            fixed.route_path = ADMIN_ROUTE_MAP[fixed.menu_key || fixed.id];
          } else if (fixed.route_path && role !== 'super_admin') {
            fixed.route_path = fixRoutePath(fixed.route_path, role);
          }
          if (fixed.children && Array.isArray(fixed.children)) {
            fixed.children = fixRoutePaths(fixed.children, role);
          }
          return fixed;
        });
      }

      function fixRoutePath(path, role) {
        if ((role === 'instructor' || role === 'solo_instructor') && path.startsWith('/super_admin/')) {
          return path.replace(/^\/super_admin\//, '/instructor/');
        }
        if (role === 'reviewer' && path.startsWith('/super_admin/')) {
          return path.replace(/^\/super_admin\//, '/reviewer/');
        }
        return path;
      }

      const fixedMenuTree = fixRoutePaths(menuTree, userRole);

      const response = {
        success: true,
        role: userRole,
        menu: { menuItems: fixedMenuTree }
      };

      const debug = req.query.debug === '1' || req.query.debug === 'true';
      if (debug) {
        const allowedDebugRoles = ['super_admin', 'admin'];
        if (!allowedDebugRoles.includes(userRole)) {
          return res.status(403).json({ success: false, error: 'Debug access denied' });
        }
        response.debug = { rawMenuTree: menuTree, fixedMenuTree };
      }

      res.json(response);
    } catch (error) {
      console.error('Error fetching sidebar menu:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch menu' });
    }
  }
};

module.exports = controller;