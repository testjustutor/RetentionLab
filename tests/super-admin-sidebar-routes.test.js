const test = require('node:test');
const assert = require('node:assert/strict');
const { DEFAULT_MENU_BY_ROLE } = require('../database/headerMenuItemsSeeder');
const { DEFAULT_NAV_BY_ROLE } = require('../database/headerRoleConfigSeeder');

test('super admin sidebar menu uses current nested routes', () => {
  const menuItems = DEFAULT_MENU_BY_ROLE.super_admin;
  const hrefs = new Map();

  for (const item of menuItems) {
    if (item.href) hrefs.set(item.id, item.href);
    if (item.submenu) {
      for (const subItem of item.submenu) {
        if (subItem.href) hrefs.set(subItem.id, subItem.href);
      }
    }
  }

  const expected = {
    'rubric-management': '/super_admin/roles/rubric-management',
    'sidebar-menu-management': '/super_admin/settings/sidebar-menu-management',
    'archives': '/super_admin/storage/archives',
    'assets': '/super_admin/storage/assets',
    'audit': '/super_admin/reports/audit',
    'add-user': '/super_admin/people/add-user',
    'manage-users': '/super_admin/people/manage-users',
    'roles-access': '/super_admin/roles/roles-access',
    'bot-management': '/super_admin/integrations/bot',
    'settings': '/super_admin/settings/settings',
    'profile': '/super_admin/people/profile',
    'user-settings': '/super_admin/people/user-settings'
  };

  for (const [id, href] of Object.entries(expected)) {
    assert.equal(hrefs.get(id), href, `${id} should point to the current super_admin route`);
  }
});

test('super admin header nav uses current nested routes', () => {
  const nav = DEFAULT_NAV_BY_ROLE.super_admin;
  assert.equal(nav.archives.href, '/super_admin/storage/archives');
  assert.equal(nav.profile.href, '/super_admin/people/profile');
  assert.equal(nav.settings.href, '/super_admin/settings/settings');
});
