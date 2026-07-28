/**
 * root/public/js/super_admin/settings/sidebar-menu-management.js
 * Sidebar Menu Management - Super Admin
 * Manages role-level and user-level menu permissions
 */

let currentRoleId = null;
let allRoles = [];
let currentFlatItems = [];

async function loadRoles() {
  try {
    const response = await fetch('/api/roles');
    if (!response.ok) throw new Error('Failed to fetch roles');
    const result = await response.json();
    allRoles = result.data || result.roles || [];
    const select = document.getElementById('roleSelector');
    select.innerHTML = '<option value="">Select a role</option>';
    allRoles.forEach(role => {
      if (role.role_name !== 'super_admin') {
        select.innerHTML += '<option value="' + role.id + '">' + role.role_name + '</option>';
      }
    });
  } catch (err) {
    console.error('Error loading roles:', err);
    alert('Failed to load roles: ' + err.message);
  }
}

async function loadMenuItems() {
  const container = document.getElementById('treeContainer');
  if (!currentRoleId) {
    container.innerHTML = '<p class="text-slate-400">Select a role to view its menu items.</p>';
    return;
  }

  try {
    let result;

    const response = await fetch('/api/menu/admin/menu-permissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role_id: parseInt(currentRoleId) })
    });
    if (!response.ok) throw new Error('Failed to fetch menu items');
    result = await response.json();

    if (!result.success || !result.data) {
      throw new Error('Invalid response format');
    }

    currentFlatItems = result.data.map(perm => ({
      id: perm.menu_item_id,
      menu_id: perm.menu_key,
      label: perm.label,
      icon: perm.icon || '',
      href: perm.route_path || '',
      is_active: perm.is_visible,
      display_order: perm.sort_order,
      parent_id: perm.parent_id,
      // For resolved view - track override status
      is_overridden: perm.is_overridden || false,
      role_default_visible: perm.role_default_visible
    }));
    
    renderMenuTree();
    renderFlatTable();
    
    if (currentFlatItems.length === 0) {
      container.innerHTML = '<p class="text-slate-400">No menu items found. Click "Reset" to load default menu items.</p>';
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
  const children = currentFlatItems.filter(i => parseInt(i.parent_id) === parseInt(item.id));
  const hasChildren = children.length > 0;
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
  html += '<button class="text-[10px] text-red-400 hover:text-red-600" onclick="deleteMenuItem(\'' + item.menu_id + '\')">Hide</button>';
  html += '</div></div>';
  
  if (hasChildren) {
    children.forEach(child => {
      html += renderMenuItem(child, depth + 1);
    });
  }
  return html;
}

function showAddForm() {
  alert('To add new menu items, use the database seeder. This page manages visibility and ordering.');
}

function editMenuItem(menuId) {
  const item = currentFlatItems.find(i => i.menu_id === menuId);
  if (!item) return;
  document.getElementById('modalTitle').textContent = 'Edit Menu Item Visibility';
  document.getElementById('modalEditId').value = item.id;
  document.getElementById('modalMenuId').value = item.menu_id;
  document.getElementById('modalLabel').value = item.label;
  document.getElementById('modalIcon').value = item.icon || '';
  document.getElementById('modalHref').value = item.href || '';
  document.getElementById('modalDisplayOrder').value = item.display_order || 0;
  document.getElementById('modalIsActive').checked = item.is_active !== 0;
  document.getElementById('modalOverlay').classList.remove('hidden');
}

function deleteMenuItem(menuId) {
  const item = currentFlatItems.find(i => i.menu_id === menuId);
  if (item) deleteMenuItemById(item.id);
}

async function deleteMenuItemById(id) {
  if (!confirm('Hide this menu item?')) return;
  try {
    const permissions = currentFlatItems.map(item => ({
      menu_item_id: item.id,
      is_visible: item.id === id ? false : item.is_active !== 0,
      sort_order: item.display_order || 0
    }));

    const resp = await fetch('/api/menu/admin/menu-permissions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role_id: parseInt(currentRoleId), permissions })
    });

    if (!resp.ok) throw new Error('Update failed');
    alert('Menu item hidden');
    loadMenuItems();
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

async function reseedMenu() {
  if (!currentRoleId) { alert('Select a role first.'); return; }
  if (!confirm('This will reset all menu permissions for this role to defaults. Continue?')) return;
  
  try {
    const resp = await fetch('/api/menu/admin/menu-permissions/reseed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role_id: parseInt(currentRoleId) })
    });
    
    if (!resp.ok) {
      const err = await resp.json();
      throw new Error(err.error || 'Reseed failed');
    }
    
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
    const parent = currentFlatItems.find(i => parseInt(i.id) === parseInt(item.parent_id));
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
    html += '<button class="text-red-400 hover:text-red-600" onclick="deleteMenuItem(\'' + item.menu_id + '\')">Hide</button>';
    html += '</td></tr>';
  });
  
  html += '</tbody></table></div>';
  container.innerHTML = html;
}

function closeModal() {
  document.getElementById('modalOverlay').classList.add('hidden');
}

function saveModalForm() {
  const editId = document.getElementById('modalEditId').value;
  const displayOrder = parseInt(document.getElementById('modalDisplayOrder').value) || 0;
  const isActive = document.getElementById('modalIsActive').checked;

  const permissions = currentFlatItems.map(item => ({
    menu_item_id: item.id,
    is_visible: item.id === parseInt(editId) ? isActive : item.is_active !== 0,
    sort_order: item.id === parseInt(editId) ? displayOrder : (item.display_order || 0)
  }));

  savePermissions(permissions);
}

async function savePermissions(permissions) {
  try {
    const resp = await fetch('/api/menu/admin/menu-permissions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role_id: parseInt(currentRoleId), permissions })
    });

    if (!resp.ok) {
      const err = await resp.json();
      throw new Error(err.error || 'Save failed');
    }

    alert('Menu permissions saved!');
    closeModal();
    loadMenuItems();
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

function init() {
  attachEventListeners();
  loadRoles();
}

function attachEventListeners() {
  document.getElementById('roleSelector').addEventListener('change', async (e) => {
    currentRoleId = e.target.value || null;
    if (currentRoleId) {
      await loadMenuItems();
    } else {
      currentFlatItems = [];
      renderMenuTree();
      renderFlatTable();
    }
  });

  document.getElementById('modalForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    saveModalForm();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}