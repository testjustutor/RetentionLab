const MenuModel = require('./models/menu/MenuModel');

(async () => {
  const roleId = 1;
  const userId = 1;
  const [rows, perms, overrides] = await Promise.all([
    MenuModel.getAllMenuItems(),
    MenuModel.getRoleMenuPermissions(roleId),
    MenuModel.getUserMenuOverrides(userId)
  ]);
  const merged = MenuModel.mergePermissions(perms, overrides);
  const tree = MenuModel.buildMenuTree(rows, merged);
  const people = tree.find(x => x.menu_key === 'people');
  const settings = tree.find(x => x.menu_key === 'settings');

  console.log('topLevelCount', tree.length);
  console.log('peopleChildren', people?.children?.map(c => c.menu_key));
  console.log('settingsChildren', settings?.children?.map(c => c.menu_key));
})();
