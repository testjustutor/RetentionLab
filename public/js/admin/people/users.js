import { fetchCurrentUser } from '../../auth.js';

// ── State ──
let allUsers = [];
let editingUserId = null;
let calendarMap = {};
let currentUserId = null;

// ── Modal setup ──
setupModal('userModal', 'openUserModalBtn', ['closeUserModalBtn', 'cancelUserModalBtn']);

// ── Load role options ──
async function loadRoleOptions() {
  const sel = document.getElementById('formRole');
  try {
    const json = await apiFetch('/api/roles');
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
    const json = await apiFetch('/api/instructor-calendar/connections');
    const connections = json.data || [];
    connections.forEach(c => {
      if (c.email) calendarMap[c.email.toLowerCase()] = c.status === 'active' ? 'connected' : 'pending';
    });
  } catch {
    /* ignore - calendar connections optional */
  }
}

// ── Load users ──
async function loadUsers() {
  try {
    if (!currentUserId) {
      const me = await fetchCurrentUser();
      currentUserId = me.id;
    }

    const usersJson = await apiFetch('/api/users');
    allUsers = (usersJson.data || []).filter(u => u.id !== currentUserId);
    loadCalendarConnections().then(() => renderTable(allUsers));
  } catch (err) {
    console.error(err);
  }
}

function renderTable(users) {
  const tbody = document.getElementById('usersTableBody');
  document.getElementById('usersCount').textContent = 'Showing ' + users.length + ' users';
  if (!users.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="py-8 text-center text-slate-500">No users found</td></tr>';
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
    // Instructor: name and email required, no password
    const firstName = document.getElementById('instFirstName').value.trim();
    const email = document.getElementById('instEmail').value.trim();
    if (!firstName || !email) {
      msgEl.textContent = 'Name and email are required for instructors.';
      msgEl.className = 'text-sm text-red-400';
      return;
    }
    payload.first_name = firstName;
    payload.email = email;
    // No password_hash for instructor
  } else {
    // Reviewer/other: name, email, password required
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
      await apiFetch('/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    }
    msgEl.textContent = editingUserId ? 'User updated!' : 'User created!';
    msgEl.className = 'text-sm text-emerald-600';
    document.getElementById('userForm').reset();
    // Reset field visibility back to default
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
  // Reset to default: show reviewer fields, hide instructor fields
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
    renderTable(allUsers);
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
    renderTable(allUsers);
  } catch (err) {
    showToast(err.message, true);
  }
};

// ── Search/Filter ──
function filterTable() {
  const query = (document.getElementById('userSearch').value || '').toLowerCase();
  const filtered = allUsers.filter(u => 
    (u.first_name || '').toLowerCase().includes(query) ||
    (u.email || '').toLowerCase().includes(query) ||
    (u.role_name || '').toLowerCase().includes(query)
  );
  renderTable(filtered);
}

// Make filterTable globally accessible for inline oninput handler
window.filterTable = filterTable;

// Initialize
loadUsers();
loadRoleOptions();