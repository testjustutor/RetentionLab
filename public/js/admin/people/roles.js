let allRoleData = [];
const COLORS = { reviewer: 'violet', instructor: 'emerald', admin: 'blue', super_admin: 'purple' };

async function loadRoles() {
  const container = document.getElementById('rolesTableBody');
  try {
    const json = await apiFetch('/api/roles/list');
    // Controller returns { success, data: [...] }
    const roles = json.data || [];

    // For each role, fetch its users only (no pages)
    allRoleData = await Promise.all(roles.map(async r => {
      try {
        // Fetch users for this role (request more users to avoid pagination limits)
        let users = [];
        try {
          const usersJson = await apiFetch('/api/users/list', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role_id: r.id, per_page: 200 })
          });
          users = usersJson.data || [];
        } catch (err) {
          console.warn('Failed to load users for role', r.id, err);
        }

        return { ...r, users };
      } catch { return { ...r, users: [] }; }
    }));

    renderRoles(allRoleData);
  } catch (err) {
    container.innerHTML = '<tr><td colspan="4" class="py-6 text-center text-red-400 font-medium">Failed to load roles</td></tr>';
  }
}

function renderRoles(data) {
  const container = document.getElementById('rolesTableBody');
  if (!data.length) { container.innerHTML = '<tr><td colspan="4" class="py-6 text-center text-slate-700 font-medium">No roles found</td></tr>'; return; }

  container.innerHTML = data.map(r => {
    const color = COLORS[r.role_name] || 'slate';
    const name = (r.role_name || '').charAt(0).toUpperCase() + (r.role_name || '').slice(1).replace(/_/g, ' ');
    const userCount = (r.users || []).length;
    const userLabel = userCount + ' users';

    // Build users list
    const usersList = (r.users || []).map(u => {
      const statusClass = u.status === 'active' ? 'text-emerald-400' : 'text-red-400';
      const createdDate = u.created_at ? new Date(u.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '--';
      return '<tr class="border-t border-slate-800 hover:bg-slate-800/30">' +
        '<td class="py-2 px-3 text-xs text-slate-300">' + escHtml(u.first_name || '--') + '</td>' +
        '<td class="py-2 px-3 text-xs text-slate-400 font-mono">' + escHtml(u.email || '--') + '</td>' +
        '<td class="py-2 px-3 text-xs ' + statusClass + '">' + (u.status || '--') + '</td>' +
        '<td class="py-2 px-3 text-xs text-slate-500 whitespace-nowrap">' + createdDate + '</td>' +
      '</tr>';
    }).join('');

    const usersSection = userCount > 0 ?
      '<div class="pt-3">' +
        '<div class="overflow-x-auto">' +
          '<table class="w-full text-left">' +
            '<thead><tr class="text-[10px] text-slate-500 uppercase border-b border-slate-800">' +
              '<th class="py-1.5 px-3 font-medium">Name</th>' +
              '<th class="py-1.5 px-3 font-medium">Email</th>' +
              '<th class="py-1.5 px-3 font-medium">Status</th>' +
              '<th class="py-1.5 px-3 font-medium">Created</th>' +
            '</tr></thead>' +
            '<tbody>' + usersList + '</tbody>' +
          '</table>' +
        '</div>' +
      '</div>' : '<div class="py-4 text-center text-xs text-slate-500">No users in this role</div>';

    return '<div class="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden role-card">' +
      '<div class="p-3 cursor-pointer hover:bg-slate-800/30 transition-colors flex items-center gap-3" onclick="this.parentElement.classList.toggle(\'expanded\')">' +
        '<div class="w-8 h-8 rounded-md bg-' + color + '-500/10 border border-' + color + '-500/20 flex items-center justify-center flex-shrink-0 text-' + color + '-400 font-bold text-xs">' + name[0] + '</div>' +
        '<div class="flex-1"><h3 class="text-xs font-semibold">' + name + '</h3><p class="text-[10px] text-slate-500">' + (r.description || '') + '</p></div>' +
        '<div class="text-right flex-shrink-0"><span class="inline-block px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-' + color + '-500/10 text-' + color + '-400 border border-' + color + '-500/20">' + userLabel + '</span></div>' +
        '<svg class="w-3.5 h-3.5 text-slate-500 chevron-icon flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>' +
      '</div>' +
      '<div class="hidden expanded-content border-t border-slate-800 px-3 py-2 bg-slate-900/50">' +
        usersSection +
      '</div></div>';
  }).join('');

  // Add click handlers for expand/collapse
  document.querySelectorAll('.role-card').forEach(card => {
    const chevron = card.querySelector('.chevron-icon');
    const content = card.querySelector('.expanded-content');
    const header = card.querySelector('[onclick]');
    
    if (header && chevron && content) {
      header.addEventListener('click', () => {
        const isExpanded = card.classList.contains('expanded');
        if (isExpanded) {
          card.classList.remove('expanded');
          content.classList.add('hidden');
          chevron.style.transform = '';
        } else {
          card.classList.add('expanded');
          content.classList.remove('hidden');
          chevron.style.transform = 'rotate(180deg)';
        }
      });
    }
  });
}

// ── Toggle single page ──
window.togglePage = async function(cb, roleId, pageKey) {
  const isActive = cb.checked;
  try {
    await apiFetch('/api/admin/header-config/pages/role/' + roleId + '/' + pageKey, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isActive })
    });
    showToast(isActive ? 'Page activated' : 'Page deactivated');
    setTimeout(loadRoles, 500);
  } catch (err) { cb.checked = !isActive; showToast(err.message, true); }
};

window.activateAllPages = async function(roleId) {
  const role = allRoleData.find(r => r.id === roleId);
  if (!role) return;
  try {
    await Promise.all(Object.keys(role.pages).map(k =>
      apiFetch('/api/admin/header-config/pages/role/' + roleId + '/' + k + '/upsert', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: role.pages[k].title || k, isActive: true })
      })
    ));
    showToast('All pages activated');
    loadRoles();
  } catch (err) { showToast(err.message, true); }
};

window.deactivateAllPages = async function(roleId) {
  const role = allRoleData.find(r => r.id === roleId);
  if (!role) return;
  try {
    await Promise.all(Object.keys(role.pages).map(k =>
      apiFetch('/api/admin/header-config/pages/role/' + roleId + '/' + k, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isActive: false })
      })
    ));
    showToast('All pages deactivated');
    loadRoles();
  } catch (err) { showToast(err.message, true); }
};

loadRoles();