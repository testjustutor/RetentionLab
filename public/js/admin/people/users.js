import { fetchCurrentUser } from '../../auth.js';

// ── State ──
let allUsers = [];
let editingUserId = null;
let calendarMap = {};
let currentUserId = null;
let currentPage = 1;
const perPage = 10;

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

// ── Load calendar connections ──
async function loadCalendarConnections() {
  try {
    const json = await apiFetch('/api/instructor-calendar/connections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    const connections = json.data || [];
    connections.forEach(c => {
      if (c.email) calendarMap[c.email.toLowerCase()] = c.status === 'active' ? 'connected' : 'pending';
    });
  } catch {
    /* ignore - calendar connections optional */
  }
}

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

// ── Initialize Pagination Service ──
let pagination = null;

// ── Load users with pagination and date filter ──
async function loadUsers() {
  try {
    if (!currentUserId) {
      const me = await fetchCurrentUser();
      currentUserId = me.id;
    }

    const { fromDate, toDate } = dateFilter.getDates();
    const body = {
      page: currentPage,
      per_page: perPage
    };
    if (fromDate) body.from_date = fromDate;
    if (toDate) body.to_date = toDate;

    const usersJson = await apiFetch('/api/users/list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    allUsers = (usersJson.data || []).filter(u => u.id !== currentUserId);
    const totalCount = usersJson.count || allUsers.length;
    const totalPages = Math.ceil(totalCount / perPage) || 1;

    loadCalendarConnections().then(() => renderTable(allUsers, totalCount, totalPages));
  } catch (err) {
    console.error(err);
  }
}

function renderTable(users, totalCount, totalPages) {
  const tbody = document.getElementById('usersTableBody');
  const count = totalCount || users.length;
  const pages = totalPages || Math.ceil(count / perPage) || 1;
  document.getElementById('usersCount').textContent = 'Showing ' + count + ' users';

  // Render pagination with page numbers using common-ui service
  if (!pagination) {
    pagination = createPagination({
      containerId: 'paginationControls',
      currentPage: currentPage,
      totalPages: pages,
      onPageChange: (page) => {
        currentPage = page;
        loadUsers();
      }
    });
  }
  // Always render/update pagination
  pagination.render();

  if (!users.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="py-8 text-center text-slate-500">No users found</td></tr>';
    return;
  }

  tbody.innerHTML = users.map(u => {
    const isActive = u.status === 'active';
    const emailKey = (u.email || '').toLowerCase();
    const calStatus = calendarMap[emailKey] || 'none';
    const isInstructor = (u.role_name || '').toLowerCase() === 'instructor';

    let calCell = '<span class="text-[10px] text-slate-600">-</span>';
    let calAction = '';
    if (isInstructor) {
      if (calStatus === 'connected') {
        calCell = '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">Connected</span>';
        calAction = '<button onclick="disconnectCalendar(\'' + escHtml(u.email) + '\')" class="text-xs text-red-600 hover:text-red-700 px-2 py-1 rounded hover:bg-slate-100 transition-colors">Disconnect</button>';
      } else if (calStatus === 'pending') {
        calCell = '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-700 border border-amber-500/20">Pending</span>';
        calAction = '<button onclick="sendVerification(\'' + escHtml(u.email) + '\')" class="text-xs text-violet-600 hover:text-violet-700 px-2 py-1 rounded hover:bg-slate-100 transition-colors">Resend</button>';
      } else {
        calCell = '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200">Not Connected</span>';
        calAction = '<button onclick="sendVerification(\'' + escHtml(u.email) + '\')" class="text-xs text-emerald-600 hover:text-emerald-700 px-2 py-1 rounded hover:bg-slate-100 transition-colors">Connect</button>';
      }
    }

    return '<tr class="hover:bg-slate-100 transition-colors">' +
      '<td class="py-3 px-4 font-medium text-slate-950">' + escHtml(u.first_name || '--') + '</td>' +
      '<td class="py-3 px-4 text-slate-500 text-xs font-mono">' + escHtml(u.email || '--') + '</td>' +
      '<td class="py-3 px-4"><span class="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium bg-violet-500/10 text-violet-600 border border-violet-500/20">' + escHtml(u.role_name || 'user') + '</span></td>' +
      '<td class="py-3 px-4">' + calCell + '</td>' +
      '<td class="py-3 px-4"><span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ' + (isActive ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-red-500/10 text-red-600 border-red-500/20') + '">' + (isActive ? 'Active' : 'Disabled') + '</span></td>' +
      '<td class="py-3 px-4 text-[10px] text-slate-500 whitespace-nowrap">' + formatDate(u.created_at) + '</td>' +
      '<td class="py-3 px-4 text-right space-x-1">' +
      calAction +
      '<button onclick="editUser(' + u.id + ')" class="text-xs text-violet-600 hover:text-violet-700 px-2 py-1 rounded hover:bg-slate-100 transition-colors">Edit</button>' +
      '<button onclick="toggleUser(' + u.id + ',\'' + (isActive ? 'inactive' : 'active') + '\')" class="text-xs ' + (isActive ? 'text-amber-600 hover:text-amber-700' : 'text-emerald-600 hover:text-emerald-700') + ' px-2 py-1 rounded hover:bg-slate-100 transition-colors">' + (isActive ? 'Deactivate' : 'Activate') + '</button>' +
      '<button onclick="deleteUser(' + u.id + ')" class="text-xs text-red-600 hover:text-red-700 px-2 py-1 rounded hover:bg-slate-100 transition-colors">Delete</button>' +
      '</td>' +
      '</tr>';
  }).join('');
}

window.editUser = async function(id) {
  const u = allUsers.find(item => item.id === id);
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

window.deleteUser = async function(id) {
  if (!confirm('Are you sure you want to delete this user?')) return;
  try {
    await apiFetch('/api/users/' + id, { method: 'DELETE' });
    showToast('User deleted');
    loadUsers();
  } catch (err) {
    showToast(err.message, true);
  }
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
    const password = document.getElementById('formPassword').value;

    if (!firstName || !email) {
      msgEl.textContent = 'Name and email are required.';
      msgEl.className = 'text-sm text-red-400';
      return;
    }
    if (!editingUserId && !password) {
      msgEl.textContent = 'Password is required.';
      msgEl.className = 'text-sm text-red-400';
      return;
    }
    payload.first_name = firstName;
    payload.email = email;
    if (password) payload.password_hash = password;
  }

  try {
    if (editingUserId) {
      await apiFetch('/api/users/' + editingUserId, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    } else {
      await apiFetch('/api/admin/users/add', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    }
    msgEl.textContent = editingUserId ? 'User updated!' : 'User created!';
    msgEl.className = 'text-sm text-emerald-600';
    document.getElementById('userForm').reset();
    document.getElementById('reviewerFields').classList.add('hidden');
    document.getElementById('instructorFields').classList.add('hidden');
    loadUsers();
    setTimeout(() => closeModal('userModal'), 3000);
  } catch (err) {
    msgEl.textContent = err.message;
    msgEl.className = 'text-sm text-red-400';
  }
});

document.getElementById('openUserModalBtn').addEventListener('click', () => {
  editingUserId = null;
  document.getElementById('modalTitle').textContent = 'Add User';
  document.getElementById('submitBtn').textContent = 'Create User';
  document.getElementById('editUserId').value = '';
  document.getElementById('userForm').reset();
  document.getElementById('formMessage').textContent = '';
  document.getElementById('formRole').value = '';
  document.getElementById('reviewerFields').classList.add('hidden');
  document.getElementById('instructorFields').classList.add('hidden');
  document.getElementById('passwordField').style.display = '';
  document.getElementById('formPassword').removeAttribute('required');
  document.getElementById('formFirstName').removeAttribute('required');
  document.getElementById('formEmail').removeAttribute('required');
  document.getElementById('instFirstName').removeAttribute('required');
  document.getElementById('instEmail').removeAttribute('required');
});

window.sendVerification = async function(email) {
  try {
    await apiFetch('/api/instructor-calendar/send-verification', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    showToast('Verification link sent to ' + email);
    calendarMap[email.toLowerCase()] = 'pending';
    renderTable(allUsers, allUsers.length, Math.ceil(allUsers.length / perPage));
  } catch (err) {
    showToast(err.message, true);
  }
};

window.disconnectCalendar = async function(email) {
  if (!confirm('Disconnect Google Calendar for ' + email + '?')) return;
  try {
    await apiFetch('/api/instructor-calendar/disconnect', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    showToast('Calendar disconnected');
    delete calendarMap[email.toLowerCase()];
    renderTable(allUsers, allUsers.length, Math.ceil(allUsers.length / perPage));
  } catch (err) {
    showToast(err.message, true);
  }
};

// ── Search/Filter ──
function filterTable() {
  const searchInput = document.getElementById('userSearch');
  if (!searchInput) return;
  const query = searchInput.value.toLowerCase();
  const filtered = allUsers.filter(u => 
    (u.first_name || '').toLowerCase().includes(query) ||
    (u.email || '').toLowerCase().includes(query) ||
    (u.role_name || '').toLowerCase().includes(query)
  );
  currentPage = 1;
  renderTable(filtered, filtered.length, Math.ceil(filtered.length / perPage));
}

// ── Initialize Date Filter Service (lightweight, no HTML rendering) ──
const dateFilter = createDateFilter({
  onFilter: (fromDate, toDate) => {
    currentPage = 1;
    loadUsers();
  },
  onClear: () => {
    currentPage = 1;
    loadUsers();
  },
  onSearch: (e) => filterTable()
});

// Initialize
loadUsers();
loadRoleOptions();