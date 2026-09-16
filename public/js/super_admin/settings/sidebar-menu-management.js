/**
 * public/js/super_admin/settings/sidebar-menu-management.js
 *
 * One display, one action, and the data-fetching approach matches the
 * backend rebuild:
 *  - Reads the role's menu with a GET (?role_id=), not a POST-with-body —
 *    this call never writes anything.
 *  - The server already returns the menu as a NESTED TREE (including
 *    hidden items, each with its own is_visible), built in one DB round
 *    trip. This page no longer re-derives parent/child relationships by
 *    scanning a flat list for every node — it just renders the tree it's
 *    given.
 *  - A flat nodeById map (built once per load) gives O(1) toggle lookups
 *    instead of Array.find()/filter() on every click.
 *  - The one action per item is a visibility toggle; toggling is
 *    local/in-memory until "Save Changes" flattens the tree back into the
 *    PUT /permissions payload and commits it in one request.
 */

let currentRoleId = null;
let currentTree = [];      // nested tree as returned by the API
let nodeById = {};         // flat id -> node, for O(1) toggle lookups
let isDirty = false;

async function loadRoles() {
  try {
    const response = await fetch('/api/roles');
    if (!response.ok) throw new Error('Failed to fetch roles');
    const result = await response.json();
    const allRoles = result.data || result.roles || [];
    const select = document.getElementById('roleSelector');
    select.innerHTML = '<option value="">Select a role</option>';
    allRoles.forEach(role => {
      if (role.role_name !== 'super_admin') {
        select.innerHTML += '<option value="' + role.id + '">' + role.role_name + '</option>';
      }
    });
  } catch (err) {
    console.error('Error loading roles:', err);
    showToast('Failed to load roles: ' + err.message);
  }
}

/** Walk the tree once, indexing every node by id (for O(1) toggle lookups). */
function indexTree(tree) {
  const map = {};
  const walk = (nodes) => {
    nodes.forEach(node => {
      map[node.id] = node;
      if (node.children && node.children.length) walk(node.children);
    });
  };
  walk(tree);
  return map;
}

/** Flatten the tree back into the { menu_item_id, is_visible, sort_order, parent_id } shape PUT /permissions expects. */
function flattenTree(tree, parentId, out) {
  tree.forEach(node => {
    out.push({
      menu_item_id: node.id,
      is_visible: !!node.is_visible,
      sort_order: node.sort_order || 0,
      parent_id: parentId
    });
    if (node.children && node.children.length) {
      flattenTree(node.children, node.id, out);
    }
  });
  return out;
}

async function loadMenuItems() {
  const container = document.getElementById('treeContainer');
  if (!currentRoleId) {
    container.innerHTML = '<p class="text-violet-800">Select a role to view its menu items.</p>';
    setButtonsEnabled(false);
    return;
  }

  container.innerHTML = '<p class="text-violet-800">Loading…</p>';

  try {
    const url = '/api/super_admin/sidebar-menu-management/permissions?role_id=' + encodeURIComponent(currentRoleId);
    const response = await fetch(url, { method: 'GET' });
    if (!response.ok) throw new Error('Failed to fetch menu items');
    const result = await response.json();

    if (!result.success || !result.data) {
      throw new Error('Invalid response format');
    }

    currentTree = result.data;
    nodeById = indexTree(currentTree);

    setDirty(false);
    renderTree();

    if (currentTree.length === 0) {
      container.innerHTML = '<p class="text-violet-800">No menu items found. Click "Reset to Defaults" to load default menu items.</p>';
    }
  } catch (err) {
    console.error('Error loading menu items:', err);
    container.innerHTML = '<p class="text-rose-700">Failed to load menu items: ' + err.message + '</p>';
    setButtonsEnabled(false);
  }
}

function renderTree() {
  const container = document.getElementById('treeContainer');
  setButtonsEnabled(true);

  if (currentTree.length === 0) {
    container.innerHTML = '<p class="text-violet-800">No menu items found for this role.</p>';
    return;
  }

  let html = '<div class="space-y-0.5">';
  currentTree.forEach(node => {
    html += renderMenuRow(node, 0);
  });
  html += '</div>';
  container.innerHTML = html;
}

function renderMenuRow(node, depth) {
  const hasChildren = node.children && node.children.length > 0;
  const indent = depth * 20;

  let html = '<div class="flex items-center justify-between gap-2 py-1.5 px-2 hover:bg-violet-100 rounded">';
  html += '<div style="margin-left: ' + indent + 'px" class="flex items-center gap-2 min-w-0">';
  if (hasChildren) {
    html += '<svg class="w-3 h-3 text-violet-800 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>';
  } else {
    html += '<span class="w-3 flex-shrink-0"></span>';
  }
  html += '<span class="text-xs font-medium truncate">' + escapeHtml(node.label) + '</span>';
  html += '<span class="text-[10px] text-violet-700 flex-shrink-0">(' + escapeHtml(node.menu_key) + ')</span>';
  html += '</div>';

  // The one action this page supports: show/hide this item for the role.
  html += '<label class="relative inline-flex items-center cursor-pointer flex-shrink-0">';
  html += '<input type="checkbox" class="sr-only peer" ' + (node.is_visible ? 'checked' : '') + ' onchange="toggleVisibility(' + node.id + ', this.checked)" />';
  html += '<div class="w-9 h-5 bg-slate-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-violet-400 rounded-full peer peer-checked:after:translate-x-full after:content-[\'\'] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-violet-600"></div>';
  html += '</label>';
  html += '</div>';

  if (hasChildren) {
    node.children.forEach(child => {
      html += renderMenuRow(child, depth + 1);
    });
  }
  return html;
}

function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function toggleVisibility(id, isVisible) {
  const node = nodeById[id]; // O(1) — no scanning a flat array for every click
  if (!node) return;
  node.is_visible = isVisible;
  setDirty(true);
}

function setDirty(dirty) {
  isDirty = dirty;
  document.getElementById('dirtyIndicator').classList.toggle('hidden', !dirty);
}

function setButtonsEnabled(enabled) {
  document.getElementById('saveBtn').disabled = !enabled;
  document.getElementById('resetBtn').disabled = !enabled;
}

async function saveChanges() {
  if (!currentRoleId) return;

  const permissions = flattenTree(currentTree, null, []);

  try {
    const resp = await fetch('/api/super_admin/sidebar-menu-management/permissions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role_id: parseInt(currentRoleId), permissions })
    });

    if (!resp.ok) {
      const err = await resp.json();
      throw new Error(err.error || 'Save failed');
    }

    setDirty(false);
    showToast('Menu permissions saved!');
  } catch (err) {
    showToast('Error: ' + err.message);
  }
}

async function resetToDefaults() {
  if (!currentRoleId) { showToast('Select a role first.'); return; }
  if (!confirm('This will reset all menu visibility for this role to defaults. Continue?')) return;

  try {
    const resp = await fetch('/api/super_admin/sidebar-menu-management/reseed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role_id: parseInt(currentRoleId) })
    });

    if (!resp.ok) {
      const err = await resp.json();
      throw new Error(err.error || 'Reset failed');
    }

    showToast('Menu reset to defaults!');
    loadMenuItems();
  } catch (err) {
    showToast('Error: ' + err.message);
  }
}

function init() {
  attachEventListeners();
  loadRoles();
}

function attachEventListeners() {
  document.getElementById('roleSelector').addEventListener('change', async (e) => {
    if (isDirty && !confirm('You have unsaved changes. Switch role anyway and discard them?')) {
      e.target.value = currentRoleId || '';
      return;
    }
    currentRoleId = e.target.value || null;
    if (currentRoleId) {
      await loadMenuItems();
    } else {
      currentTree = [];
      nodeById = {};
      setDirty(false);
      document.getElementById('treeContainer').innerHTML = '<p class="text-violet-800">Select a role to view its menu items.</p>';
      setButtonsEnabled(false);
    }
  });

  document.getElementById('saveBtn').addEventListener('click', saveChanges);
  document.getElementById('resetBtn').addEventListener('click', resetToDefaults);

  window.addEventListener('beforeunload', (e) => {
    if (isDirty) {
      e.preventDefault();
      e.returnValue = '';
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
