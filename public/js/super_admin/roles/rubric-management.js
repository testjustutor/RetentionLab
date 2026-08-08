let currentCategories = [];
let currentIndicators = [];
let currentAdmins = [];

async function loadCategories() {
  const container = document.getElementById('categoriesContainer');
  try {
    const resp = await fetch('/api/rubric-admin/categories');
    if (!resp.ok) throw new Error('Failed to fetch');
    const result = await resp.json();
    currentCategories = result.data || [];
    if (currentCategories.length === 0) {
      container.innerHTML = '<p class="text-slate-400">No categories defined yet. Click "+ Add Category" to create one.</p>';
      return;
    }
    let html = `<table class="min-w-full divide-y divide-slate-700">
      <thead><tr>
        <th class="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Category ID</th>
        <th class="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Name</th>
        <th class="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Weight</th>
        <th class="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Actions</th>
      </tr></thead><tbody class="divide-y divide-slate-800">`;
    currentCategories.forEach(cat => {
      html += `<tr>
        <td class="px-4 py-3 text-sm text-slate-300">${cat.category_id}</td>
        <td class="px-4 py-3 text-sm font-medium ">${cat.name}</td>
        <td class="px-4 py-3 text-sm text-slate-300">${cat.weight}</td>
        <td class="px-4 py-3 text-sm">
          <button class="text-indigo-400 hover:text-indigo-600 mr-3" onclick="editCategory('${cat.category_id}')">Edit</button>
          <button class="text-red-400 hover:text-red-600" onclick="deleteCategory('${cat.category_id}')">Delete</button>
        </td>
      </tr>`;
    });
    html += '</tbody></table>';
    container.innerHTML = html;
  } catch (err) {
    container.innerHTML = '<p class="text-red-400">Error: ' + err.message + '</p>';
  }
}

function showCategoryForm() {
  document.getElementById('modalTitle').textContent = 'Add Category';
  document.getElementById('modalMode').value = 'category';
  document.getElementById('modalEditId').value = '';
  document.getElementById('modalCategoryId').value = '';
  document.getElementById('modalName').value = '';
  document.getElementById('modalWeight').value = '1';
  document.getElementById('modalCategoryIdGroup').classList.remove('hidden');
  document.getElementById('modalWeightGroup').classList.remove('hidden');
  document.getElementById('modalValueGroup').classList.add('hidden');
  document.getElementById('modalCategorySelectGroup').classList.add('hidden');
  document.getElementById('modalTypeGroup').classList.add('hidden');
  document.getElementById('modalGateGroup').classList.add('hidden');
  document.getElementById('modalOverlay').classList.remove('hidden');
}

function editCategory(categoryId) {
  const cat = currentCategories.find(c => c.category_id === categoryId);
  if (!cat) return;
  document.getElementById('modalTitle').textContent = 'Edit Category';
  document.getElementById('modalMode').value = 'category';
  document.getElementById('modalEditId').value = categoryId;
  document.getElementById('modalCategoryId').value = categoryId;
  document.getElementById('modalName').value = cat.name;
  document.getElementById('modalWeight').value = cat.weight;
  document.getElementById('modalCategoryIdGroup').classList.add('hidden');
  document.getElementById('modalWeightGroup').classList.remove('hidden');
  document.getElementById('modalValueGroup').classList.add('hidden');
  document.getElementById('modalCategorySelectGroup').classList.add('hidden');
  document.getElementById('modalTypeGroup').classList.add('hidden');
  document.getElementById('modalGateGroup').classList.add('hidden');
  document.getElementById('modalOverlay').classList.remove('hidden');
}

async function deleteCategory(categoryId) {
  if (!confirm('Delete category "' + categoryId + '" and all its indicators? This cannot be undone.')) return;
  try {
    const resp = await fetch('/api/rubric-admin/categories/' + categoryId, { method: 'DELETE' });
    if (!resp.ok) throw new Error('Delete failed');
    alert('Category deleted successfully!');
    loadCategories();
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

async function loadIndicators() {
  const container = document.getElementById('indicatorsContainer');
  try {
    const resp = await fetch('/api/rubric-admin/indicators');
    if (!resp.ok) throw new Error('Failed to fetch');
    const result = await resp.json();
    currentIndicators = result.data || [];
    if (currentIndicators.length === 0) {
      container.innerHTML = '<p class="text-slate-400">No indicators defined yet. Click "+ Add Indicator" to create one.</p>';
      return;
    }
    let html = `<table class="min-w-full divide-y divide-slate-700">
      <thead><tr>
        <th class="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">ID</th>
        <th class="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Name</th>
        <th class="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Category</th>
        <th class="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Type</th>
        <th class="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Value</th>
        <th class="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Is Gate</th>
        <th class="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Actions</th>
      </tr></thead><tbody class="divide-y divide-slate-800">`;
    currentIndicators.forEach(ind => {
      html += `<tr>
        <td class="px-4 py-3 text-sm text-slate-300">${ind.indicator_id}</td>
        <td class="px-4 py-3 text-sm font-medium">${ind.name}</td>
        <td class="px-4 py-3 text-sm text-slate-300">${ind.category_name || ind.category_id}</td>
        <td class="px-4 py-3 text-sm text-slate-300">${ind.type || 'HUMAN'}</td>
        <td class="px-4 py-3 text-sm text-slate-300">${ind.value !== undefined ? ind.value : 1}</td>
        <td class="px-4 py-3 text-sm text-slate-300">${ind.is_gate ? 'Yes' : 'No'}</td>
        <td class="px-4 py-3 text-sm">
          <button class="text-indigo-400 hover:text-indigo-600 mr-3" onclick="editIndicator('${ind.indicator_id}')">Edit</button>
          <button class="text-red-400 hover:text-red-600" onclick="deleteIndicator('${ind.indicator_id}')">Delete</button>
        </td>
      </tr>`;
    });
    html += '</tbody></table>';
    container.innerHTML = html;
  } catch (err) {
    container.innerHTML = '<p class="text-red-400">Error: ' + err.message + '</p>';
  }
}

async function showIndicatorForm() {
  await loadCategoriesForDropdown('modalCategorySelect');
  document.getElementById('modalTitle').textContent = 'Add Indicator';
  document.getElementById('modalMode').value = 'indicator';
  document.getElementById('modalEditId').value = '';
  document.getElementById('modalCategoryId').value = '';
  document.getElementById('modalName').value = '';
  document.getElementById('modalValue').value = '1';
  document.getElementById('modalCategoryIdGroup').classList.add('hidden');
  document.getElementById('modalWeightGroup').classList.add('hidden');
  document.getElementById('modalValueGroup').classList.remove('hidden');
  document.getElementById('modalCategorySelectGroup').classList.remove('hidden');
  document.getElementById('modalTypeGroup').classList.remove('hidden');
  document.getElementById('modalGateGroup').classList.remove('hidden');
  document.getElementById('modalCategorySelect').value = '';
  document.getElementById('modalType').value = 'HUMAN';
  document.getElementById('modalIsGate').checked = false;
  document.getElementById('modalOverlay').classList.remove('hidden');
}

async function editIndicator(indicatorId) {
  const ind = currentIndicators.find(i => i.indicator_id === indicatorId);
  if (!ind) return;
  await loadCategoriesForDropdown('modalCategorySelect');
  document.getElementById('modalTitle').textContent = 'Edit Indicator';
  document.getElementById('modalMode').value = 'indicator';
  document.getElementById('modalEditId').value = indicatorId;
  document.getElementById('modalCategoryId').value = '';
  document.getElementById('modalName').value = ind.name;
  document.getElementById('modalValue').value = ind.value !== undefined ? ind.value : 1;
  document.getElementById('modalCategoryIdGroup').classList.add('hidden');
  document.getElementById('modalWeightGroup').classList.add('hidden');
  document.getElementById('modalValueGroup').classList.remove('hidden');
  document.getElementById('modalCategorySelectGroup').classList.remove('hidden');
  document.getElementById('modalTypeGroup').classList.remove('hidden');
  document.getElementById('modalGateGroup').classList.remove('hidden');
  document.getElementById('modalCategorySelect').value = ind.category_id || '';
  document.getElementById('modalType').value = ind.type || 'HUMAN';
  document.getElementById('modalIsGate').checked = ind.is_gate === 1 || ind.is_gate === true;
  document.getElementById('modalOverlay').classList.remove('hidden');
}

async function deleteIndicator(indicatorId) {
  if (!confirm('Delete indicator "' + indicatorId + '"?')) return;
  try {
    const resp = await fetch('/api/rubric-admin/indicators/' + indicatorId, { method: 'DELETE' });
    if (!resp.ok) throw new Error('Delete failed');
    alert('Indicator deleted successfully!');
    loadIndicators();
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

function setupEventListeners() {
  const modalForm = document.getElementById('modalForm');
  if (modalForm) {
    modalForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const mode = document.getElementById('modalMode').value;
      const editId = document.getElementById('modalEditId').value;
      const name = document.getElementById('modalName').value.trim();
      
      try {
        if (mode === 'category') {
          const categoryId = editId || document.getElementById('modalCategoryId').value.trim();
          const weight = parseFloat(document.getElementById('modalWeight').value);
          if (editId) {
            const resp = await fetch('/api/rubric-admin/categories/' + editId, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name, weight })
            });
            if (!resp.ok) throw new Error('Update failed');
          } else {
            const resp = await fetch('/api/rubric-admin/categories', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ category_id: categoryId, name, weight })
            });
            if (!resp.ok) throw new Error('Create failed');
          }
          alert('Category saved!');
          closeModal();
          loadCategories();
        } else if (mode === 'indicator') {
          const indicatorId = editId || 'ind-' + Date.now();
          const categoryId = document.getElementById('modalCategorySelect').value;
          const type = document.getElementById('modalType').value;
          const isGate = document.getElementById('modalIsGate').checked ? 1 : 0;
          const value = parseFloat(document.getElementById('modalValue').value) || 1;
          if (!categoryId) { alert('Please select a category'); return; }
          if (editId) {
            const resp = await fetch('/api/rubric-admin/indicators/' + editId, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name, type, is_gate: isGate, category_id: categoryId, value })
            });
            if (!resp.ok) throw new Error('Update failed');
          } else {
            const resp = await fetch('/api/rubric-admin/indicators', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ indicator_id: indicatorId, category_id: categoryId, name, type, is_gate: isGate, value })
            });
            if (!resp.ok) throw new Error('Create failed');
          }
          alert('Indicator saved!');
          closeModal();
          loadIndicators();
        }
      } catch (err) {
        alert('Error: ' + err.message);
      }
    });
  }

  const assignForm = document.getElementById('assignForm');
  if (assignForm) {
    assignForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const categoryId = document.getElementById('assignCategoryId').value;
      const adminUserId = document.getElementById('assignAdminUserId').value;
      if (!categoryId || !adminUserId) { alert('Please select both a category and an admin.'); return; }
      try {
        const resp = await fetch('/api/rubric-admin/assign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ category_id: categoryId, admin_user_id: adminUserId })
        });
        if (!resp.ok) {
          const errData = await resp.json();
          throw new Error(errData.error || 'Assignment failed');
        }
        const result = await resp.json();
        const indicatorsCopied = result.indicators_copied || 0;
        document.getElementById('assignResult').innerHTML = '<p class="text-green-400">Category assigned successfully! ' + indicatorsCopied + ' indicators copied.</p>';
        document.getElementById('assignForm').reset();
      } catch (err) {
        document.getElementById('assignResult').innerHTML = '<p class="text-red-400">Error: ' + err.message + '</p>';
      }
    });
  }
}

async function loadAssignDropdowns() {
  try {
    const catResp = await fetch('/api/rubric-admin/categories');
    const catResult = await catResp.json();
    const cats = catResult.data || [];
    const catSelect = document.getElementById('assignCategoryId');
    catSelect.innerHTML = '<option value="">Select a category</option>';
    cats.forEach(c => {
      catSelect.innerHTML += '<option value="' + c.category_id + '">' + c.name + ' (' + c.category_id + ')</option>';
    });

    const userResp = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ page: 1, per_page: 100 })
    });
    const userResult = await userResp.json();
    const users = (userResult.data || []).filter(u => u.role_name === 'admin');
    currentAdmins = users;
    const adminSelect = document.getElementById('assignAdminUserId');
    adminSelect.innerHTML = '<option value="">Select an admin</option>';
    users.forEach(u => {
      const name = [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email;
      adminSelect.innerHTML += '<option value="' + u.id + '">' + name + ' (' + u.email + ')</option>';
    });
  } catch (err) {
    document.getElementById('assignResult').innerHTML = '<p class="text-red-400">Error loading data: ' + err.message + '</p>';
  }
}

async function loadViewAssignments() {
  const container = document.getElementById('viewAssignmentsContainer');
  try {
    const resp = await fetch('/api/rubric-admin/assignments');
    if (!resp.ok) throw new Error('Failed to fetch');
    const result = await resp.json();
    const assignments = result.data || [];
    if (assignments.length === 0) {
      container.innerHTML = '<p class="text-slate-400">No assignments yet. Use the "Assign to Admins" tab to assign categories.</p>';
      return;
    }
    let html = `<table class="min-w-full divide-y divide-slate-700">
      <thead><tr>
        <th class="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Category</th>
        <th class="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Admin</th>
        <th class="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Assigned At</th>
        <th class="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Actions</th>
      </tr></thead><tbody class="divide-y divide-slate-800">`;
    assignments.forEach(a => {
      const adminName = [a.admin_first_name, a.admin_last_name].filter(Boolean).join(' ') || a.admin_email;
      html += `<tr>
        <td class="px-4 py-3 text-sm font-medium">${a.category_name}</td>
        <td class="px-4 py-3 text-sm text-slate-300">${adminName}</td>
        <td class="px-4 py-3 text-sm text-slate-300">${a.assigned_at || 'N/A'}</td>
        <td class="px-4 py-3 text-sm">
          <button class="text-red-400 hover:text-red-600" onclick="unassign('${a.category_id}', ${a.admin_user_id})">Remove</button>
        </td>
      </tr>`;
    });
    html += '</tbody></table>';
    container.innerHTML = html;
  } catch (err) {
    container.innerHTML = '<p class="text-red-400">Error: ' + err.message + '</p>';
  }
}

async function unassign(categoryId, adminUserId) {
  if (!confirm('Remove this assignment? This will also delete the admin\'s custom weightage/value settings.')) return;
  try {
    const resp = await fetch('/api/rubric-admin/assign?category_id=' + categoryId + '&admin_user_id=' + adminUserId, { method: 'DELETE' });
    if (!resp.ok) throw new Error('Failed to remove');
    alert('Assignment removed!');
    loadViewAssignments();
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

async function loadAuditLogs() {
  const container = document.getElementById('auditLogsContainer');
  const entityFilter = document.getElementById('auditEntityFilter').value;
  try {
    let url = '/api/rubric-admin/audit-logs?limit=100';
    if (entityFilter) url += '&entity_type=' + entityFilter;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error('Failed to fetch');
    const result = await resp.json();
    const logs = result.data || [];
    if (logs.length === 0) {
      container.innerHTML = '<p class="text-slate-400">No audit logs found.</p>';
      return;
    }
    let html = `<table class="min-w-full divide-y divide-slate-700">
      <thead><tr>
        <th class="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Action</th>
        <th class="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Type</th>
        <th class="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Entity ID</th>
        <th class="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Admin ID</th>
        <th class="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Performed By</th>
        <th class="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Date</th>
      </tr></thead><tbody class="divide-y divide-slate-800">`;
    logs.forEach(log => {
      html += `<tr class="hover:bg-slate-800/50 cursor-pointer" onclick="showAuditDetail('${log.id}')">
        <td class="px-4 py-3 text-sm"><span class="px-2 py-1 rounded text-xs font-semibold ${getActionBadgeClass(log.action)}">${log.action}</span></td>
        <td class="px-4 py-3 text-sm text-slate-300">${log.entity_type}</td>
        <td class="px-4 py-3 text-sm text-slate-300">${log.entity_id || '-'}</td>
        <td class="px-4 py-3 text-sm text-slate-300">${log.admin_user_id || '-'}</td>
        <td class="px-4 py-3 text-sm text-slate-300">${log.performed_by_email || log.performed_by}</td>
        <td class="px-4 py-3 text-sm text-slate-400">${new Date(log.created_at).toLocaleString()}</td>
      </tr>`;
    });
    html += '</tbody></table>';
    container.innerHTML = html;
  } catch (err) {
    container.innerHTML = '<p class="text-red-400">Error: ' + err.message + '</p>';
  }
}

function getActionBadgeClass(action) {
  if (action.includes('DELETE') || action.includes('UNASSIGN')) return 'bg-red-900 text-red-200';
  if (action.includes('CREATE') || action.includes('ASSIGN')) return 'bg-green-900 text-green-200';
  if (action.includes('UPDATE')) return 'bg-yellow-900 text-yellow-200';
  return 'bg-blue-900 text-blue-200';
}

function showAuditDetail(logId) {
  alert('Audit entry #' + logId + '. Check the database rubric_audit_log table for full details.');
}

async function loadCategoriesForDropdown(selectId) {
  const select = document.getElementById(selectId);
  try {
    const resp = await fetch('/api/rubric-admin/categories');
    const result = await resp.json();
    const cats = result.data || [];
    select.innerHTML = '<option value="">Select a category</option>';
    cats.forEach(c => {
      select.innerHTML += '<option value="' + c.category_id + '">' + c.name + '</option>';
    });
  } catch (err) {
    select.innerHTML = '<option value="">Failed to load</option>';
  }
}

function closeModal() {
  document.getElementById('modalOverlay').classList.add('hidden');
}

function showTab(tabName) {
  const panels = ['panelCategories', 'panelIndicators', 'panelAssignments', 'panelViewAssignments', 'panelAuditLogs'];
  panels.forEach(panelId => {
    const panel = document.getElementById(panelId);
    if (panel) panel.classList.add('hidden');
  });

  const panelMap = {
    'categories': 'panelCategories',
    'indicators': 'panelIndicators',
    'assignments': 'panelAssignments',
    'viewAssignments': 'panelViewAssignments',
    'auditLogs': 'panelAuditLogs'
  };
  const selectedPanel = document.getElementById(panelMap[tabName]);
  if (selectedPanel) {
    selectedPanel.classList.remove('hidden');
  }

  const buttons = {
    'categories': document.getElementById('tabCategories'),
    'indicators': document.getElementById('tabIndicators'),
    'assignments': document.getElementById('tabAssignments'),
    'viewAssignments': document.getElementById('tabViewAssignments'),
    'auditLogs': document.getElementById('tabAuditLogs')
  };

  Object.keys(buttons).forEach(key => {
    const btn = buttons[key];
    if (!btn) return;
    if (key === tabName) {
      btn.className = 'px-3 py-1.5 bg-indigo-600 rounded-t-md text-xs font-medium';
    } else {
      btn.className = 'px-3 py-1.5 bg-slate-800 text-slate-300 rounded-t-md text-xs font-medium hover:bg-slate-700';
    }
  });

  if (tabName === 'categories') {
    loadCategories();
  } else if (tabName === 'indicators') {
    loadIndicators();
  } else if (tabName === 'assignments') {
    loadAssignDropdowns();
  } else if (tabName === 'viewAssignments') {
    loadViewAssignments();
  } else if (tabName === 'auditLogs') {
    loadAuditLogs();
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    loadCategories();
  });
} else {
  setupEventListeners();
  loadCategories();
}