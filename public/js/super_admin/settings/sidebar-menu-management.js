let currentRoleId = null;
let allRoles = [];
let currentFlatItems = [];
let currentAdmins = [];

async function loadRoles() {
  try {
    const response = await fetch('/api/roles');
    if (!response.ok) throw new Error('Failed to fetch roles');
    const result = await response.json();
    allRoles = result.data || result.roles || [];
    const select = document.getElementById('roleSelector');
    select.innerHTML = '<option value="">Select a role</option>';
    allRoles.forEach(role => {
      select.innerHTML += '<option value="' + role.id + '">' + role.role_name + '</option>';
    });
  } catch (err) {
    console.error('Error loading roles:', err);
    alert('Failed to load roles: ' + err.message);
  }
}

// Wait for DOM to be fully loaded before attaching event listeners
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('roleSelector').addEventListener('change', (e) => {
      currentRoleId = e.target.value || null;
      if (currentRoleId) loadMenuItems();
    });
  });
} else {
  document.getElementById('roleSelector').addEventListener('change', (e) => {
    currentRoleId = e.target.value || null;
    if (currentRoleId) loadMenuItems();
  });
}

async function loadMenuItems() {
  const container = document.getElementById('treeContainer');
  if (!currentRoleId) {
    container.innerHTML = '<p class="text-slate-400">Select a role to view its menu items.</p>';
    return;
  }
  try {
    const response = await fetch('/api/sidebar-menu-admin/items/' + currentRoleId);
    if (!response.ok) throw new Error('Failed to fetch menu items');
    const result = await response.json();
    
    // Extract items from response - API returns { count, flat, tree }
    let items = [];
    if (result.flat && Array.isArray(result.flat)) {
      items = result.flat;
    } else if (result.data && Array.isArray(result.data)) {
      items = result.data;
    } else if (result.items && Array.isArray(result.items)) {
      items = result.items;
    } else if (Array.isArray(result)) {
      items = result;
    }
    
    console.log('API Response:', result);
    console.log('Parsed items:', items);
    console.log('Items count:', items.length);
    
    currentFlatItems = items;
    
    // Render both views
    renderMenuTree();
    renderFlatTable();
    
    // Show message if no items
    if (items.length === 0) {
      container.innerHTML = '<p class="text-slate-400">No menu items found for this role. Click "Reset" to load default menu items.</p>';
    }
  } catch (err) {
    console.error('Error loading menu items:', err);
    container.innerHTML = '<p class="text-red-400">Failed to load menu items: ' + err.message + '</p>';
  }
}

function renderMenuTree() {
  const container = document.getElementById('treeContainer');
  if (currentFlatItems.length === 0) {
    container.innerHTML = '<p class="text-slate-400">No menu items found for this role.</p>';
    return;
  }
  const roots = currentFlatItems.filter(item => !item.parent_id);
  let html = '<div class="space-y-1">';
  roots.forEach(root => {
    html += renderMenuItem(root, 0);
  });
  html += '</div>';
  container.innerHTML = html;
}

function renderMenuItem(item, depth) {
  const hasChildren = currentFlatItems.some(i => i.parent_id === item.menu_id);
  const indent = depth * 20;
  let html = '<div class="flex items-center gap-2 py-1.5 px-2 hover:bg-slate-800/30 rounded">';
  html += '<div style="margin-left: ' + indent + 'px" class="flex-1 flex items-center gap-2">';
  if (hasChildren) {
    html += '<svg class="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>';
  } else {
    html += '<span class="w-3"></span>';
  }
  html += '<span class="text-xs font-medium">' + item.label + '</span>';
  html += '<span class="text-[10px] text-slate-500">(' + item.menu_id + ')</span>';
  html += '</div>';
  html += '<div class="flex gap-1">';
  html += '<button class="text-[10px] text-indigo-400 hover:text-indigo-600" onclick="editMenuItem(\'' + item.menu_id + '\')">Edit</button>';
  html += '<button class="text-[10px] text-red-400 hover:text-red-600" onclick="deleteMenuItem(\'' + item.menu_id + '\')">Delete</button>';
  html += '</div></div>';
  
  if (hasChildren) {
    const children = currentFlatItems.filter(i => i.parent_id === item.menu_id);
    children.forEach(child => {
      html += renderMenuItem(child, depth + 1);
    });
  }
  return html;
}

function showAddForm() {
  if (!currentRoleId) { alert('Select a role first.'); return; }
  document.getElementById('modalTitle').textContent = 'Add Menu Item';
  document.getElementById('modalEditId').value = '';
  document.getElementById('modalMenuId').value = '';
  document.getElementById('modalLabel').value = '';
  document.getElementById('modalIcon').value = '';
  document.getElementById('modalHref').value = '';
  document.getElementById('modalDisplayOrder').value = '0';
  document.getElementById('modalIsActive').checked = true;
  populateParentDropdown(null);
  document.getElementById('modalOverlay').classList.remove('hidden');
}

function editMenuItem(menuId) {
  const item = currentFlatItems.find(i => i.menu_id === menuId);
  if (!item) return;
  document.getElementById('modalTitle').textContent = 'Edit Menu Item';
  document.getElementById('modalEditId').value = item.id;
  document.getElementById('modalMenuId').value = item.menu_id;
  document.getElementById('modalLabel').value = item.label;
  document.getElementById('modalIcon').value = item.icon || '';
  document.getElementById('modalHref').value = item.href || '';
  document.getElementById('modalDisplayOrder').value = item.display_order || 0;
  document.getElementById('modalIsActive').checked = item.is_active !== 0;
  populateParentDropdown(item.menu_id);
  document.getElementById('modalOverlay').classList.remove('hidden');
}

function populateParentDropdown(excludeMenuId) {
  const select = document.getElementById('modalParentId');
  select.innerHTML = '<option value="">None (top-level item)</option>';
  currentFlatItems.forEach(item => {
    if (item.menu_id !== excludeMenuId) {
      select.innerHTML += '<option value="' + item.menu_id + '">' + item.label + ' (' + item.menu_id + ')</option>';
    }
  });
}

// Wait for DOM to be fully loaded before attaching modal form listener
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('modalForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const editId = document.getElementById('modalEditId').value;
      const menuId = document.getElementById('modalMenuId').value.trim();
      const label = document.getElementById('modalLabel').value.trim();
      const parentId = document.getElementById('modalParentId').value || null;
      const icon = document.getElementById('modalIcon').value.trim() || null;
      const href = document.getElementById('modalHref').value.trim() || null;
      const displayOrder = parseInt(document.getElementById('modalDisplayOrder').value) || 0;
      const isActive = document.getElementById('modalIsActive').checked;

      try {
        if (editId) {
          const resp = await fetch('/api/sidebar-menu-admin/items/' + editId, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ label, icon, href, parent_id: parentId, display_order: displayOrder, is_active: isActive })
          });
          if (!resp.ok) throw new Error('Update failed');
          alert('Menu item updated!');
        } else {
          const resp = await fetch('/api/sidebar-menu-admin/items/' + currentRoleId, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ menu_id: menuId, parent_id: parentId, label, icon, href, display_order: displayOrder, is_active: isActive })
          });
          if (!resp.ok) {
            const err = await resp.json();
            throw new Error(err.error || 'Create failed');
          }
          alert('Menu item created!');
        }
        closeModal();
        loadMenuItems();
      } catch (err) {
        alert('Error: ' + err.message);
      }
    });
  });
} else {
  document.getElementById('modalForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const editId = document.getElementById('modalEditId').value;
    const menuId = document.getElementById('modalMenuId').value.trim();
    const label = document.getElementById('modalLabel').value.trim();
    const parentId = document.getElementById('modalParentId').value || null;
    const icon = document.getElementById('modalIcon').value.trim() || null;
    const href = document.getElementById('modalHref').value.trim() || null;
    const displayOrder = parseInt(document.getElementById('modalDisplayOrder').value) || 0;
    const isActive = document.getElementById('modalIsActive').checked;

    try {
      if (editId) {
        const resp = await fetch('/api/sidebar-menu-admin/items/' + editId, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ label, icon, href, parent_id: parentId, display_order: displayOrder, is_active: isActive })
        });
        if (!resp.ok) throw new Error('Update failed');
        alert('Menu item updated!');
      } else {
        const resp = await fetch('/api/sidebar-menu-admin/items/' + currentRoleId, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ menu_id: menuId, parent_id: parentId, label, icon, href, display_order: displayOrder, is_active: isActive })
        });
        if (!resp.ok) {
          const err = await resp.json();
          throw new Error(err.error || 'Create failed');
        }
        alert('Menu item created!');
      }
      closeModal();
      loadMenuItems();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  });
}

function deleteMenuItem(menuId) {
  const item = currentFlatItems.find(i => i.menu_id === menuId);
  if (item) deleteMenuItemById(item.id);
}

async function deleteMenuItemById(id) {
  if (!confirm('Delete this menu item? Children will also be removed.')) return;
  try {
    const resp = await fetch('/api/sidebar-menu-admin/items/' + id, { method: 'DELETE' });
    if (!resp.ok) throw new Error('Delete failed');
    alert('Menu item deleted!');
    loadMenuItems();
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

async function reseedMenu() {
  if (!currentRoleId) { alert('Select a role first.'); return; }
  if (!confirm('This will replace ALL menu items for this role with the default structure. Continue?')) return;
  
  const role = allRoles.find(r => r.id === currentRoleId);
  if (!role) { alert('Role not found'); return; }
  
  const defaultMenus = {
    super_admin: [
      { id: 'dashboard', label: 'Dashboard', icon: 'grid', href: '/super_admin/index.html', submenu: null },
      { id: 'rubric-management', label: 'Rubric Management', icon: 'clipboard', href: '/super_admin/rubric-management.html', submenu: null },
      { id: 'sidebar-menu-management', label: 'Sidebar Menu', icon: 'list', href: '/super_admin/sidebar-menu-management.html', submenu: null },
      { id: 'content', label: 'Content Management', icon: 'folder', href: null, submenu: [
        { id: 'archives', label: 'Archives', href: '/super_admin/archives.html' },
        { id: 'assets', label: 'Assets', href: '/super_admin/assets.html' },
        { id: 'audit', label: 'Audit Log', href: '/super_admin/audit.html' }
      ]},
      { id: 'user-management', label: 'User Management', icon: 'user', href: null, submenu: [
        { id: 'add-user', label: 'Add User', href: '/super_admin/add-user.html' },
        { id: 'manage-users', label: 'Manage Users', href: '/super_admin/manage-users.html' },
        { id: 'roles-access', label: 'Roles & Access', href: '/super_admin/roles-access.html' }
      ]},
      { id: 'system', label: 'System', icon: 'shield', href: null, submenu: [
        { id: 'bot-management', label: 'Bot Management', href: '/super_admin/bot.html' },
        { id: 'settings', label: 'Settings', href: '/super_admin/settings.html' },
        { id: 'profile', label: 'Profile', href: '/super_admin/profile.html' },
        { id: 'user-settings', label: 'User Settings', href: '/super_admin/user-settings.html' }
      ]}
    ],
    admin: [
      { id: 'dashboard', label: 'Dashboard', icon: 'grid', href: '/admin/index.html', submenu: null },
      { id: 'rubric-management', label: 'My Rubric', icon: 'clipboard', href: '/admin/rubric-management.html', submenu: null },
      { id: 'schedules', label: 'Schedules', icon: 'calendar', href: null, submenu: [
        { id: 'calendar-accounts', label: 'Accounts', href: '/admin/calendar-accounts.html' },
        { id: 'calendar-events', label: 'Events', href: '/admin/calendar-events.html' }
      ]},
      { id: 'content', label: 'Content', icon: 'folder', href: null, submenu: [
        { id: 'archives', label: 'Archives', href: '/admin/archives.html' }
      ]},
      { id: 'account', label: 'Account', icon: 'user', href: null, submenu: [
        { id: 'profile', label: 'Profile', href: '/admin/profile.html' },
        { id: 'settings', label: 'Settings', href: '/admin/settings.html' }
      ]}
    ],
    reviewer: [
      { id: 'dashboard', label: 'Dashboard', icon: 'grid', href: '/reviewer/index.html', submenu: null },
      { id: 'schedules', label: 'Schedules', icon: 'calendar', href: null, submenu: [
        { id: 'calendar-accounts', label: 'Accounts', href: '/reviewer/calendar-accounts.html' },
        { id: 'calendar-events', label: 'Events', href: '/reviewer/calendar-events.html' }
      ]},
      { id: 'content', label: 'Archives', icon: 'folder', href: '/reviewer/archives.html', submenu: null },
      { id: 'account', label: 'Account', icon: 'user', href: null, submenu: [
        { id: 'profile', label: 'Profile', href: '/reviewer/profile.html' },
        { id: 'settings', label: 'Settings', href: '/reviewer/settings.html' }
      ]}
    ],
    instructor: [
      { id: 'dashboard', label: 'Dashboard', icon: 'grid', href: '/instructor/index.html', submenu: null },
      { id: 'schedules', label: 'Schedules', icon: 'calendar', href: null, submenu: [
        { id: 'calendar-accounts', label: 'My Calendar', href: '/instructor/calendar-accounts.html' },
        { id: 'calendar-events', label: 'Events', href: '/instructor/calendar-events.html' }
      ]},
      { id: 'content', label: 'Archives', icon: 'folder', href: '/instructor/archives.html', submenu: null },
      { id: 'account', label: 'Account', icon: 'user', href: null, submenu: [
        { id: 'profile', label: 'Profile', href: '/instructor/profile.html' },
        { id: 'settings', label: 'Settings', href: '/instructor/settings.html' }
      ]}
    ]
  };

  const menuItems = defaultMenus[role.role_name] || defaultMenus.instructor;
  
  try {
    const resp = await fetch('/api/sidebar-menu-admin/reseed/' + currentRoleId, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ menuItems })
    });
    if (!resp.ok) throw new Error('Reseed failed');
    alert('Menu reset to defaults!');
    loadMenuItems();
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

function renderFlatTable() {
  const container = document.getElementById('flatTableContainer');
  if (currentFlatItems.length === 0) {
    container.innerHTML = '<p class="text-slate-400 text-xs">No menu items found for this role.</p>';
    return;
  }
  
  let html = '<div class="overflow-x-auto"><table class="min-w-full text-xs">';
  html += '<thead class="bg-slate-800/50"><tr>';
  html += '<th class="px-3 py-2 text-left text-slate-300 font-medium">Menu ID</th>';
  html += '<th class="px-3 py-2 text-left text-slate-300 font-medium">Label</th>';
  html += '<th class="px-3 py-2 text-left text-slate-300 font-medium">Parent</th>';
  html += '<th class="px-3 py-2 text-left text-slate-300 font-medium">Icon</th>';
  html += '<th class="px-3 py-2 text-left text-slate-300 font-medium">Order</th>';
  html += '<th class="px-3 py-2 text-left text-slate-300 font-medium">Status</th>';
  html += '<th class="px-3 py-2 text-left text-slate-300 font-medium">Actions</th>';
  html += '</tr></thead><tbody class="divide-y divide-slate-800">';
  
  currentFlatItems.forEach(item => {
    const parent = currentFlatItems.find(i => i.menu_id === item.parent_id);
    const parentLabel = parent ? parent.label : 'None';
    const status = item.is_active !== 0 ? '<span class="text-green-400">Active</span>' : '<span class="text-red-400">Inactive</span>';
    
    html += '<tr class="hover:bg-slate-800/20">';
    html += '<td class="px-3 py-2 text-slate-300">' + item.menu_id + '</td>';
    html += '<td class="px-3 py-2 text-white">' + item.label + '</td>';
    html += '<td class="px-3 py-2 text-slate-400">' + parentLabel + '</td>';
    html += '<td class="px-3 py-2 text-slate-400">' + (item.icon || '-') + '</td>';
    html += '<td class="px-3 py-2 text-slate-400">' + (item.display_order || 0) + '</td>';
    html += '<td class="px-3 py-2">' + status + '</td>';
    html += '<td class="px-3 py-2">';
    html += '<button class="text-indigo-400 hover:text-indigo-600 mr-2" onclick="editMenuItem(\'' + item.menu_id + '\')">Edit</button>';
    html += '<button class="text-red-400 hover:text-red-600" onclick="deleteMenuItem(\'' + item.menu_id + '\')">Delete</button>';
    html += '</td></tr>';
  });
  
  html += '</tbody></table></div>';
  container.innerHTML = html;
}

function closeModal() {
  document.getElementById('modalOverlay').classList.add('hidden');
}

loadRoles();