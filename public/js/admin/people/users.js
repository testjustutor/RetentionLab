/**
 * public/js/admin/people/users.js
 */

let allUsers = [];
let editingUserId = null;
let currentUserId = null;
let tableObj = null;

// ── Modal setup ──
setupModal('userModal', 'openUserModalBtn', ['closeUserModalBtn', 'cancelUserModalBtn']);

// ── Load role options ──
async function loadRoleOptions() {
  const sel = document.getElementById('formRole');
  try {
    const json = await apiFetch('/api/roles/list');
    const roles = json.data || [];
    sel.innerHTML = '<option value="">Select a role...</option>' +
      roles.map(r => '<option value="' + r.id + '" data-name="' + r.role_name + '">' + r.role_name + '</option>').join('');
  } catch {
    sel.innerHTML = '<option value="">Failed</option>';
  }
}

// ── Toggle fields based on selected role ──
document.getElementById('formRole').addEventListener('change', function() {
  const selectedOption = this.options[this.selectedIndex];
  const roleName = selectedOption ? selectedOption.getAttribute('data-name') : '';
  const isInstructor = roleName === 'instructor' || roleName === 'solo_instructor';

  document.getElementById('reviewerFields').classList.toggle('hidden', isInstructor);
  document.getElementById('instructorFields').classList.toggle('hidden', !isInstructor);

  // Clear inputs when switching
  if (isInstructor) {
    document.getElementById('formFirstName').value = '';
    document.getElementById('formEmail').value = '';
    document.getElementById('formPassword').value = '';
  } else {
    document.getElementById('instFirstName').value = '';
    document.getElementById('instEmail').value = '';
  }
});

// ── Format date helper ──
function formatDate(dateStr) {
  if (!dateStr) return '--';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) + ' ' +
           d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return dateStr;
  }
}

// ── Table headers for createTable ──
const tableHeaders = [
  { label: 'Name', key: 'first_name', width: '25%', render: (val, row) => '<p class="font-medium text-slate-900">' + escHtml(row.first_name || '') + ' ' + escHtml(row.last_name || '') + '</p>' },
  { label: 'Email', key: 'email', width: '30%' },
  { label: 'Role', key: 'role_name', width: '10%' },
  { label: 'Status', key: 'status', width: '10%', render: (val) => {
    const cls = val === 'active' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-slate-100 text-slate-500 border-slate-200';
    return '<span class="inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-medium ' + cls + '">' + escHtml(val || 'unknown') + '</span>';
  }},
  { label: 'Created At', key: 'created_at', width: '15%', render: (val) => formatDate(val) },
  { label: 'Actions', key: 'id', width: '10%', align: 'right', render: (val, row) => {
    return '<div class="flex gap-1.5 justify-end">' +
      '<button onclick="editUser(\'' + val + '\')" class="px-2 py-1 rounded bg-violet-100 text-violet-700 hover:bg-violet-200 text-[10px] font-medium transition-colors">Edit</button>' +
      '<button onclick="deleteUser(\'' + val + '\')" class="px-2 py-1 rounded bg-red-100 text-red-700 hover:bg-red-200 text-[10px] font-medium transition-colors">Delete</button>' +
    '</div>';
  }}
];

// ── Load users with date filter using createTable ──
async function loadUsers() {
  try {

    if (!currentUserId) {
      currentUserId = window.currentUser?.id || null;
    }

    const { fromDate, toDate } = dateFilter.getDates();
    const body = {};
    if (fromDate) body.from_date = fromDate;
    if (toDate) body.to_date = toDate;

    const usersJson = await apiFetch('/api/admin/users/list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const rawUsers = (usersJson.data || []).filter(u => u.id !== currentUserId);
    allUsers = rawUsers;

    // Prepare rows with renderable cells
    const rows = rawUsers;

    // Use centralized createTable component with client-side pagination
    if (!tableObj) {
      tableObj = createTable({
        containerId: 'usersTableContainer',
        headers: tableHeaders,
        data: rows,
        emptyMessage: 'No users found',
        pagination: { perPage: 10 }
      });
      tableObj.render();
    } else {
      tableObj.setData(rows);
    }

    // Update count
    const countEl = document.getElementById('usersCount');
    if (countEl) countEl.textContent = 'Showing ' + (usersJson.count || rawUsers.length) + ' users';

  } catch (err) {
    console.error(err);
    showToast(err.message || 'Failed to load users', true);
  }
}

// ── User Actions ──
window.editUser = async function(id) {
  const idNum = Number(id);
  const u = allUsers.find(item => Number(item.id) === idNum);
  if (!u) return;
  editingUserId = u.id;
  document.getElementById('modalTitle').textContent = 'Edit User';
  document.getElementById('submitBtn').textContent = 'Update User';
  document.getElementById('editUserId').value = u.id;

  // Set role and show fields based on role
  document.getElementById('formRole').value = u.role_id || '';
  const selectedOption = document.getElementById('formRole').options[document.getElementById('formRole').selectedIndex];
  const roleName = selectedOption ? selectedOption.getAttribute('data-name') : '';
  const isInstructor = roleName === 'instructor' || roleName === 'solo_instructor';

  document.getElementById('reviewerFields').classList.toggle('hidden', isInstructor);
  document.getElementById('instructorFields').classList.toggle('hidden', !isInstructor);

  if (isInstructor) {
    document.getElementById('instFirstName').value = u.first_name || '';
    document.getElementById('instEmail').value = u.email || '';
  } else {
    document.getElementById('formFirstName').value = u.first_name || '';
    document.getElementById('formEmail').value = u.email || '';
    document.getElementById('formPassword').value = '';
    document.getElementById('passwordField').style.display = 'none';
  }

  document.getElementById('formMessage').textContent = '';
  openModal('userModal');
};

window.toggleUser = async function(id, newStatus) {
  try {
    await apiFetch('/api/users/' + id, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: newStatus }) });
    showToast(newStatus === 'active' ? 'User activated' : 'User deactivated');
    loadUsers();
  } catch (err) {
    showToast(err.message, true);
  }
};

window.deleteUser = function(id) {
  showConfirmDialog({
    title: 'Delete User',
    message: 'Are you sure you want to delete this user? This action cannot be undone.',
    confirmText: 'Delete',
    cancelText: 'Cancel',
    color: 'red',
    onConfirm: async () => {
      try {
        await apiFetch('/api/users/' + id, { method: 'DELETE' });
        showToast('User deleted');
        loadUsers();
      } catch (err) {
        showToast(err.message, true);
      }
    }
  });
};

document.getElementById('userForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msgEl = document.getElementById('formMessage');
  msgEl.textContent = '';

  const roleId = parseInt(document.getElementById('formRole').value, 10);
  if (!roleId) {
    msgEl.textContent = 'Please select a role.';
    msgEl.className = 'text-sm text-red-400';
    return;
  }

  // Determine if instructor role
  const selectedOption = document.getElementById('formRole').options[document.getElementById('formRole').selectedIndex];
  const roleName = selectedOption ? selectedOption.getAttribute('data-name') : '';
  const isInstructor = roleName === 'instructor' || roleName === 'solo_instructor';

  let payload = { role_id: roleId };

  if (isInstructor) {
    const firstName = document.getElementById('instFirstName').value.trim();
    const email = document.getElementById('instEmail').value.trim();
    if (!firstName || !email) {
      msgEl.textContent = 'Name and email are required for instructors.';
      msgEl.className = 'text-sm text-red-400';
      return;
    }
    payload.first_name = firstName;
    payload.email = email;
  } else {
    const firstName = document.getElementById('formFirstName').value.trim();
    const email = document.getElementById('formEmail').value.trim();
    if (!firstName || !email) {
      msgEl.textContent = 'Name and email are required.';
      msgEl.className = 'text-sm text-red-400';
      return;
    }
    payload.first_name = firstName;
    payload.email = email;
    const password = document.getElementById('formPassword').value;
    if (password) payload.password = password;
  }

  try {
    const isEdit = !!editingUserId;
    const endpoint = isEdit ? '/api/users/' + editingUserId : '/api/admin/people/users/addusers';
    const method = isEdit ? 'PUT' : 'POST';

    const json = await apiFetch(endpoint, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    showToast(isEdit ? 'User updated successfully' : 'User created successfully');
    document.getElementById('userForm').reset();
    document.getElementById('reviewerFields').classList.add('hidden');
    document.getElementById('instructorFields').classList.add('hidden');
    closeModal('userModal');
    loadUsers();
  } catch (err) {
    msgEl.textContent = err.message;
    msgEl.className = 'text-sm text-red-400';
  }
});

// ── Initialize Date Filter Service ──
const dateFilter = createDateFilter({
  onFilter: (fromDate, toDate) => {
    loadUsers();
  },
  onClear: () => {
    loadUsers();
  }
});

// ── Initialize ──
loadUsers();
loadRoleOptions();