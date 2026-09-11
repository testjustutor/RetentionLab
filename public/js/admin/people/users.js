/**
 * public/js/admin/people/users.js
 */

let allUsers = [];
let editingUserId = null;
let currentUserId = null;
let tableObj = null;
// email (lowercase) -> Calendarstatus ('active' | 'disconnected'), from the same
// source the Admin > Meetings > Calendar page uses to decide Connect vs Connected.
let calendarConnectionsByEmail = {};

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

// ── Load calendar connection status for instructors ──
// Same endpoint + same "Calendarstatus" field the Admin > Meetings > Calendar
// page uses (see public/js/admin/meetings/calendar.js -> loadConnections()):
// Calendarstatus === 'active' only when the row is active AND has a real
// OAuth access_token (see instructorCalendarController.listConnections()).
async function loadCalendarConnections() {
  try {
    const json = await apiFetch('/api/admin/meetings/calendar/calendar-connections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    const rows = json.data || [];
    const map = {};
    rows.forEach(function(row) {
      if (row.email) map[row.email.toLowerCase()] = row.Calendarstatus;
    });
    calendarConnectionsByEmail = map;
  } catch (err) {
    console.error('Failed to load calendar connection status:', err);
    calendarConnectionsByEmail = {};
  }
}

// ── Add/Edit User form validation ──
// Regex rules kept intentionally readable so the error messages below stay
// accurate to what's actually being checked.
const NAME_REGEX = /^[A-Za-z][A-Za-z\s.'-]{1,59}$/; // 2-60 chars, letters/spaces/hyphen/apostrophe/period, must start with a letter
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

function validateName(value) {
  const v = (value || '').trim();
  if (!v) return { ok: false, message: 'Full name is required.' };
  if (v.length < 2) return { ok: false, message: 'Name must be at least 2 characters.' };
  if (!NAME_REGEX.test(v)) return { ok: false, message: "Use letters, spaces, hyphens or apostrophes only — no numbers or symbols." };
  return { ok: true, message: 'Looks good.' };
}

function validateEmail(value) {
  const v = (value || '').trim();
  if (!v) return { ok: false, message: 'Email is required.' };
  if (!EMAIL_REGEX.test(v)) return { ok: false, message: 'Enter a valid email address, e.g. name@company.com' };
  return { ok: true, message: 'Looks good.' };
}

// Checked in order so the message always names the ONE thing still missing,
// instead of a generic "invalid password" that leaves the user guessing.
function validatePassword(value) {
  const v = value || '';
  if (!v) return { ok: false, message: 'Password is required.' };
  if (v.length < 8) return { ok: false, message: 'Password must be at least 8 characters long.' };
  if (v.length > 64) return { ok: false, message: 'Password must be 64 characters or fewer.' };
  if (!/[a-z]/.test(v)) return { ok: false, message: 'Add at least one lowercase letter.' };
  if (!/[A-Z]/.test(v)) return { ok: false, message: 'Add at least one uppercase letter.' };
  if (!/\d/.test(v)) return { ok: false, message: 'Add at least one number.' };
  if (!/[^A-Za-z0-9\s]/.test(v)) return { ok: false, message: 'Add at least one symbol (e.g. ! @ # $ %).' };
  return { ok: true, message: 'Strong password.' };
}

// Remember each hint's original placeholder text so we can restore it once a
// field is empty/untouched again (e.g. after switching role or resetting the form).
const defaultHints = {};
['formFirstNameHint', 'formEmailHint', 'formPasswordHint', 'instFirstNameHint', 'instEmailHint'].forEach(function(id) {
  const el = document.getElementById(id);
  if (el) defaultHints[id] = el.textContent;
});

function fieldValidationUI(inputId, hintId, result) {
  const input = document.getElementById(inputId);
  const hint = document.getElementById(hintId);
  if (!input || !hint) return;

  input.classList.remove('border-red-400', 'border-emerald-400', 'border-violet-300');
  hint.classList.remove('text-red-600', 'text-emerald-600', 'text-slate-500');

  if (!result) {
    // Neutral/default state — field is empty and hasn't been touched yet.
    input.classList.add('border-violet-300');
    hint.classList.add('text-slate-500');
    hint.textContent = defaultHints[hintId] || '';
    return;
  }

  if (result.ok) {
    input.classList.add('border-emerald-400');
    hint.classList.add('text-emerald-600');
  } else {
    input.classList.add('border-red-400');
    hint.classList.add('text-red-600');
  }
  hint.textContent = result.message;
}

// Runs validation right now (used on form submit) and updates the field's UI.
function runValidation(inputId, hintId, validatorFn) {
  const input = document.getElementById(inputId);
  const result = validatorFn(input ? input.value : '');
  fieldValidationUI(inputId, hintId, result);
  return result.ok;
}

// Wires live (as-you-type) validation: shows the neutral hint until the user
// leaves the field once, then keeps feedback live as they keep typing/fixing it.
function bindLiveValidation(inputId, hintId, validatorFn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  let touched = false;

  input.addEventListener('blur', function() {
    touched = true;
    fieldValidationUI(inputId, hintId, validatorFn(input.value));
  });
  input.addEventListener('input', function() {
    if (!touched) return;
    fieldValidationUI(inputId, hintId, validatorFn(input.value));
  });
}

bindLiveValidation('formFirstName', 'formFirstNameHint', validateName);
bindLiveValidation('formEmail', 'formEmailHint', validateEmail);
bindLiveValidation('formPassword', 'formPasswordHint', validatePassword);
bindLiveValidation('instFirstName', 'instFirstNameHint', validateName);
bindLiveValidation('instEmail', 'instEmailHint', validateEmail);

// Resets every field's validation styling/hint back to neutral (used when the
// Add/Edit modal is opened fresh or after a successful save).
function resetFieldValidationUI() {
  Object.keys(defaultHints).forEach(function(hintId) {
    const inputId = hintId.replace(/Hint$/, '');
    fieldValidationUI(inputId, hintId, null);
  });
}

// Show/hide the password value (Reviewer/Admin/Student create form only).
const toggleFormPasswordBtn = document.getElementById('toggleFormPassword');
if (toggleFormPasswordBtn) {
  toggleFormPasswordBtn.addEventListener('click', function() {
    const input = document.getElementById('formPassword');
    const showIcon = document.getElementById('toggleFormPasswordIconShow');
    const hideIcon = document.getElementById('toggleFormPasswordIconHide');
    const isCurrentlyHidden = input.type === 'password';
    input.type = isCurrentlyHidden ? 'text' : 'password';
    showIcon.classList.toggle('hidden', isCurrentlyHidden);
    hideIcon.classList.toggle('hidden', !isCurrentlyHidden);
  });
}

// Fresh "Add User" click: clear any leftover edit state/validation styling
// from a previous Edit, and make sure the password field (hidden during
// Edit) is visible again since it's required when creating a new user.
const openUserModalBtnEl = document.getElementById('openUserModalBtn');
if (openUserModalBtnEl) {
  openUserModalBtnEl.addEventListener('click', function() {
    editingUserId = null;
    document.getElementById('modalTitle').textContent = 'Add User';
    document.getElementById('submitBtn').textContent = 'Create User';
    document.getElementById('userForm').reset();
    document.getElementById('editUserId').value = '';
    document.getElementById('reviewerFields').classList.add('hidden');
    document.getElementById('instructorFields').classList.add('hidden');
    document.getElementById('passwordField').style.display = '';
    document.getElementById('formMessage').textContent = '';
    resetFieldValidationUI();
  });
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

// ── Role -> badge color mapping ──
// One consistent color per role so the Role column reads at a glance across
// the whole table, same visual pattern as the Status pill below.
const ROLE_BADGE_COLORS = {
  super_admin: 'bg-fuchsia-500/10 text-fuchsia-700 border-fuchsia-500/20',
  admin: 'bg-violet-500/10 text-violet-700 border-violet-500/20',
  reviewer: 'bg-blue-500/10 text-blue-700 border-blue-500/20',
  instructor: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20',
  solo_instructor: 'bg-teal-500/10 text-teal-700 border-teal-500/20',
  student: 'bg-amber-500/10 text-amber-700 border-amber-500/20'
};
const ROLE_BADGE_DEFAULT = 'bg-slate-100 text-slate-600 border-slate-200';

function formatRoleLabel(roleName) {
  return (roleName || 'unknown').split('_').map(function(w) {
    return w.charAt(0).toUpperCase() + w.slice(1);
  }).join(' ');
}

// ── Table headers for createTable ──
const tableHeaders = [
  { label: 'Name', key: 'first_name', width: '24%', render: (val, row) => '<p class="font-medium text-slate-900 whitespace-nowrap">' + escHtml(row.first_name || '') + ' ' + escHtml(row.last_name || '') + '</p>' },
  { label: 'Email', key: 'email', width: '28%', render: (val) => '<span class="whitespace-nowrap">' + escHtml(val || '') + '</span>' },
  { label: 'Role', key: 'role_name', width: '12%', render: (val) => {
    const cls = ROLE_BADGE_COLORS[(val || '').toLowerCase()] || ROLE_BADGE_DEFAULT;
    return '<span class="inline-flex whitespace-nowrap px-1.5 py-0.5 rounded-full text-[10px] font-medium border ' + cls + '">' + escHtml(formatRoleLabel(val)) + '</span>';
  }},
  { label: 'Created At', key: 'created_at', width: '14%', render: (val) => '<span class="whitespace-nowrap">' + formatDate(val) + '</span>' },
  { label: 'Actions', key: 'id', width: '22%', align: 'right', render: (val, row) => {
    const roleName = (row.role_name || '').toLowerCase();
    const isInstructor = roleName === 'instructor' || roleName === 'solo_instructor';
    const isConnected = isInstructor && calendarConnectionsByEmail[(row.email || '').toLowerCase()] === 'active';

    // Same rule as Admin > Meetings > Calendar's "Calendar Connected" column:
    // show "Connected" once active, otherwise show the Connect action.
    let calendarAction = '';
    if (isConnected) {
      calendarAction = '<span class="inline-flex items-center gap-1 px-2 py-1 rounded bg-emerald-50 text-emerald-700 text-[10px] font-semibold border border-emerald-200 whitespace-nowrap flex-shrink-0">' +
          '<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>' +
          'Connected</span>';
    } else if (isInstructor) {
      calendarAction = '<button data-connect-calendar data-email="' + escHtml(row.email || '') + '" ' +
          'class="connect-calendar-btn inline-flex items-center gap-1 px-2 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700 ' +
          'text-[10px] font-semibold shadow-sm ring-2 ring-emerald-300 transition-colors whitespace-nowrap flex-shrink-0" title="Send a calendar connection email to this instructor">' +
          '<svg class="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>' +
          'Connect Calendar</button>';
    }

    // Status toggle (replaces the old Delete button) — shows the CURRENT
    // status as a colored badge (🟢 Active / ⚪ Inactive); clicking it flips
    // the status via the existing window.toggleUser(id, newStatus) helper,
    // which PUTs /api/users/:id with { status }.
    const isActive = row.status === 'active';
    const toggleBtn = isActive
      ? '<button onclick="toggleUser(\'' + val + '\', \'inactive\')" title="Click to deactivate" class="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 text-[10px] font-semibold transition-colors whitespace-nowrap flex-shrink-0">🟢 Active</button>'
      : '<button onclick="toggleUser(\'' + val + '\', \'active\')" title="Click to activate" class="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-300 hover:bg-slate-200 text-[10px] font-semibold transition-colors whitespace-nowrap flex-shrink-0">⚪ Inactive</button>';

    return '<div class="flex flex-nowrap gap-1.5 justify-end items-center">' +
      calendarAction +
      '<button onclick="editUser(\'' + val + '\')" class="px-2 py-1 rounded bg-violet-100 text-violet-700 hover:bg-violet-200 text-[10px] font-medium transition-colors whitespace-nowrap flex-shrink-0">Edit</button>' +
      toggleBtn +
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

    // Refresh calendar connection status alongside the user list so the
    // Connect/Connected state in the Actions column stays current.
    const [usersJson] = await Promise.all([
      apiFetch('/api/admin/users/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }),
      loadCalendarConnections()
    ]);

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
  resetFieldValidationUI();
  document.getElementById('passwordField').style.display = '';

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
  const isEdit = !!editingUserId;

  let payload = { role_id: roleId };
  let firstInvalidEl = null;

  if (isInstructor) {
    const nameOk = runValidation('instFirstName', 'instFirstNameHint', validateName);
    const emailOk = runValidation('instEmail', 'instEmailHint', validateEmail);
    if (!nameOk) firstInvalidEl = firstInvalidEl || document.getElementById('instFirstName');
    if (!emailOk) firstInvalidEl = firstInvalidEl || document.getElementById('instEmail');

    if (!nameOk || !emailOk) {
      msgEl.textContent = 'Please fix the highlighted field(s) above.';
      msgEl.className = 'text-sm text-red-400';
      if (firstInvalidEl) firstInvalidEl.focus();
      return;
    }

    payload.first_name = document.getElementById('instFirstName').value.trim();
    payload.email = document.getElementById('instEmail').value.trim();
  } else {
    const nameOk = runValidation('formFirstName', 'formFirstNameHint', validateName);
    const emailOk = runValidation('formEmail', 'formEmailHint', validateEmail);
    if (!nameOk) firstInvalidEl = firstInvalidEl || document.getElementById('formFirstName');
    if (!emailOk) firstInvalidEl = firstInvalidEl || document.getElementById('formEmail');

    const passwordVal = document.getElementById('formPassword').value;
    // Password is required when creating a new user. When editing, leaving it
    // blank means "keep the existing password" — but if the admin does type a
    // new one, it still has to meet the same strength rule.
    let passwordOk = true;
    if (!isEdit || passwordVal) {
      passwordOk = runValidation('formPassword', 'formPasswordHint', validatePassword);
    }
    if (!passwordOk) firstInvalidEl = firstInvalidEl || document.getElementById('formPassword');

    if (!nameOk || !emailOk || !passwordOk) {
      msgEl.textContent = 'Please fix the highlighted field(s) above.';
      msgEl.className = 'text-sm text-red-400';
      if (firstInvalidEl) firstInvalidEl.focus();
      return;
    }

    payload.first_name = document.getElementById('formFirstName').value.trim();
    payload.email = document.getElementById('formEmail').value.trim();
    if (passwordVal) payload.password = passwordVal;
  }

  try {
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
    resetFieldValidationUI();
    closeModal('userModal');
    loadUsers();
  } catch (err) {
    msgEl.textContent = err.message;
    msgEl.className = 'text-sm text-red-400';
  }
});

// ── Connect Calendar button click handler (instructors only) ──
// Sends a Google Calendar verification email to the instructor, reusing the
// exact same endpoint the Admin > Meetings > Calendar page uses for its
// "Connect" link (see public/js/admin/meetings/calendar.js).
document.addEventListener('click', async function(e) {
  const btn = e.target.closest('.connect-calendar-btn');
  if (!btn) return;
  e.preventDefault();

  const email = btn.getAttribute('data-email');
  if (!email) {
    showToast('No email on file for this instructor', true);
    return;
  }

  const originalHtml = btn.innerHTML;
  btn.disabled = true;
  btn.classList.add('opacity-60', 'cursor-not-allowed');
  btn.innerHTML = '<svg class="animate-spin w-3 h-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Sending...';

  try {
    await apiFetch('/api/admin/meetings/calendar/send-verification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email })
    });
    showToast('Calendar connection email sent to ' + email);
  } catch (err) {
    showToast('Failed to send email: ' + (err.message || 'Unknown error'), true);
  } finally {
    btn.disabled = false;
    btn.classList.remove('opacity-60', 'cursor-not-allowed');
    btn.innerHTML = originalHtml;
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