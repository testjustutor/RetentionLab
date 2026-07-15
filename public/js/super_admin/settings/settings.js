window.addEventListener('load', function () {
  if (typeof window.initRoleHeaderCommon === 'function') {
    window.initRoleHeaderCommon({ baseRolePath: '/super_admin' });
  }
});