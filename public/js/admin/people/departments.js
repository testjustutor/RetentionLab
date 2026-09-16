/**
 * public/js/admin/people/departments.js
 *
 * Extracted from an inline <script type="module"> block that used to live
 * directly in public/admin/people/departments.html, to match this
 * codebase's convention of one external, same-named JS file per HTML page
 * (see e.g. public/js/admin/people/users.js, public/js/reviewer/dashboard.js).
 * Behavior is unchanged - only the auth.js import path was adjusted for
 * this file's new location (was '../../js/auth.js' relative to the HTML
 * page under public/admin/people/; is '../../auth.js' relative to this
 * file under public/js/admin/people/ - both resolve to public/js/auth.js).
 *
 * Relies on setupModal/openModal/closeModal/apiFetch/showToast/escHtml
 * being available as globals from public/js/common-ui.js, which the page
 * loads (as a plain, non-module script) before this file.
 */
import { fetchCurrentUser } from '../../auth.js';

let allDepts = [];
let currentUserId = null;
const COLORS = ['violet', 'emerald', 'amber', 'rose', 'blue'];

setupModal('deptModal', 'openDeptModalBtn', ['closeDeptModalBtn', 'cancelDeptModalBtn']);
setupModal('memberModal', null, ['closeMemberModalBtn', 'cancelMemberModalBtn']);

async function loadDepts() {
  const c = document.getElementById('deptsContainer');
  try {
    const json = await apiFetch('/api/departments');
    allDepts = json.data || [];
    if (!allDepts.length) {
      c.innerHTML = '<div class="py-12 text-center">' +
        '<svg class="w-12 h-12 text-slate-400 mx-auto mb-3" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>' +
        '<p class="text-sm text-slate-500 mb-1">No departments found</p>' +
        '<p class="text-xs text-slate-400">Create a department to get started</p>' +
      '</div>';
      return;
    }
    c.innerHTML = '<div class="space-y-3">' + allDepts.map((d,i) => {
      const color = COLORS[i % COLORS.length];
      // Gradient backgrounds based on color
      const gradientMap = {
        'violet': 'from-violet-50 to-purple-100',
        'emerald': 'from-emerald-50 to-teal-100',
        'amber': 'from-amber-50 to-orange-100',
        'rose': 'from-rose-50 to-pink-100',
        'blue': 'from-blue-50 to-cyan-100'
      };
      const borderMap = {
        'violet': 'border-violet-400',
        'emerald': 'border-emerald-400',
        'amber': 'border-amber-400',
        'rose': 'border-rose-400',
        'blue': 'border-blue-400'
      };
      const textMap = {
        'violet': 'text-violet-900',
        'emerald': 'text-emerald-900',
        'amber': 'text-amber-900',
        'rose': 'text-rose-900',
        'blue': 'text-blue-900'
      };
      const bgGradient = gradientMap[color] || 'from-slate-50 to-gray-100';
      const borderColor = borderMap[color] || 'border-slate-300';
      const textColor = textMap[color] || 'text-slate-900';

      return '<div class="bg-gradient-to-br ' + bgGradient + ' border ' + borderColor + ' rounded-lg shadow-md overflow-hidden" data-dept-id="' + d.id + '">' +
        '<div class="p-3 flex items-center gap-3">' +
          '<div class="w-8 h-8 rounded-md bg-' + color + '-100 border border-' + color + '-300 flex items-center justify-center text-' + color + '-700 font-bold text-xs">' + d.member_count + '</div>' +
          '<div class="flex-1"><h3 class="text-xs font-bold ' + textColor + '">' + escHtml(d.name) + '</h3><p class="text-[11px] text-slate-600">' + escHtml(d.description || '') + ' &middot; ' + d.member_count + ' members</p></div>' +
          '<div class="flex gap-1">' +
            '<button onclick="openAddMember(' + d.id + ')" class="text-[12px] px-1.5 py-0.5 rounded bg-white/50 text-slate-700 hover:text-white hover:bg-' + color + '-600 transition-colors" title="Add Member">+Member</button>' +
            '<button onclick="editDept(' + d.id + ')" class="text-[12px] px-1.5 py-0.5 rounded bg-white/50 text-' + color + '-700 hover:text-' + color + '-900 transition-colors">Edit</button>' +
            '<button onclick="deleteDept(' + d.id + ')" class="text-[12px] px-1.5 py-0.5 rounded bg-white/50 text-red-600 hover:text-red-900 transition-colors">Delete</button>' +
          '</div>' +
          '<svg class="w-3.5 h-3.5 text-slate-500 chevron-icon flex-shrink-0 cursor-pointer hover:text-' + color + '-600 transition-colors" onclick="toggleMembers(this,' + d.id + ')" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>' +
        '</div>' +
        '<div class="hidden members-content border-t border-' + borderColor + ' px-3 py-1.5 bg-white/50" id="members-' + d.id + '">' +
          '<div class="text-[12px] text-slate-600 py-1.5">Click chevron to load members</div>' +
        '</div></div>';
    }).join('') + '</div>';
  } catch (err) { c.innerHTML = '<div class="py-8 text-center text-red-400">Failed to load departments</div>'; }
}

window.toggleMembers = async function(chevron, deptId) {
  const content = document.getElementById('members-' + deptId);
  const isHidden = content.classList.contains('hidden');
  if (isHidden) {
    content.classList.remove('hidden');
    chevron.style.transform = 'rotate(180deg)';
    // Load members
    try {
      const json = await apiFetch('/api/departments/' + deptId + '/members');
      const members = json.data || [];
      content.innerHTML = members.length
        ? members.map(m => '<div class="flex items-center justify-between py-1.5 border-b border-violet-200 text-xs">' +
 '<div><span class="font-semibold text-slate-900">' + escHtml(m.first_name || m.email) + '</span> <span class="text-slate-600">(' + escHtml(m.role_name || 'user') + ')</span></div>' +
            '<button onclick="removeMember(' + deptId + ',' + m.id + ')" class="text-red-600 hover:text-red-800 text-[12px] font-semibold">Remove</button>' +
          '</div>').join('')
        : '<div class="text-xs text-slate-600 py-2">No members</div>';
    } catch { content.innerHTML = '<div class="text-xs text-red-400 py-2">Failed to load</div>'; }
  } else {
    content.classList.add('hidden');
    chevron.style.transform = '';
  }
}

// -- CRUD --
window.editDept = function(id) {
  const d = allDepts.find(x => x.id === id);
  if (!d) return;
  document.getElementById('editDeptId').value = d.id;
  document.getElementById('deptName').value = d.name;
  document.getElementById('deptDesc').value = d.description || '';
  document.getElementById('deptModalTitle').textContent = 'Edit Department';
  document.getElementById('deptSubmitBtn').textContent = 'Update';
  openModal('deptModal');
};

window.deleteDept = async function(id) {
  if (!confirm('Delete this department?')) return;
  try { await apiFetch('/api/departments/' + id, { method: 'DELETE' }); showToast('Department deleted'); loadDepts(); }
  catch (e) { showToast(e.message, true); }
};

document.getElementById('deptForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = document.getElementById('deptFormMsg');
  msg.textContent = '';
  const editId = document.getElementById('editDeptId').value;
  const name = document.getElementById('deptName').value.trim();
  const desc = document.getElementById('deptDesc').value.trim();
  if (!name) { msg.textContent = 'Name required'; msg.className = 'text-sm text-red-400'; return; }
  try {
    if (editId) {
      await apiFetch('/api/departments/' + editId, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, description: desc }) });
    } else {
      await apiFetch('/api/departments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, description: desc }) });
    }
    document.getElementById('deptForm').reset();
    document.getElementById('editDeptId').value = '';
    document.getElementById('deptModalTitle').textContent = 'Create Department';
    document.getElementById('deptSubmitBtn').textContent = 'Create';
    closeModal('deptModal');
    loadDepts();
    showToast(editId ? 'Department updated' : 'Department created');
  } catch (err) { msg.textContent = err.message; msg.className = 'text-sm text-red-400'; }
});

document.getElementById('openDeptModalBtn').addEventListener('click', () => {
  document.getElementById('editDeptId').value = '';
  document.getElementById('deptForm').reset();
  document.getElementById('deptModalTitle').textContent = 'Create Department';
  document.getElementById('deptSubmitBtn').textContent = 'Create';
  document.getElementById('deptFormMsg').textContent = '';
});

// -- Members --
window.openAddMember = async function(deptId) {
  document.getElementById('addMemberDeptId').value = deptId;
  const sel = document.getElementById('memberUserSelect');
  sel.innerHTML = '<option value="">Loading...</option>';
  openModal('memberModal');
  try {
    // Get current user from cache
    if (!currentUserId) {
      const me = await fetchCurrentUser();
      currentUserId = me.id;
    }

    const usersJson = await apiFetch('/api/users');
    const users = (usersJson.data || []).filter(u => u.id !== currentUserId);
    sel.innerHTML = users.map(u => '<option value="' + u.id + '">' + escHtml(u.first_name || u.email) + ' (' + (u.role_name || 'user') + ')</option>').join('');
  } catch { sel.innerHTML = '<option value="">Failed</option>'; }
};

window.addMember = async function() {
  const deptId = document.getElementById('addMemberDeptId').value;
  const userId = document.getElementById('memberUserSelect').value;
  if (!userId) return showToast('Select a user', true);
  try {
    await apiFetch('/api/departments/' + deptId + '/members', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: parseInt(userId) }) });
    closeModal('memberModal');
    showToast('Member added');
    loadDepts();
  } catch (e) { showToast(e.message, true); }
};

window.removeMember = async function(deptId, userId) {
  try {
    await apiFetch('/api/departments/' + deptId + '/members/' + userId, { method: 'DELETE' });
    showToast('Member removed');
    loadDepts();
    // Re-toggle members
    const content = document.getElementById('members-' + deptId);
    if (content) content.innerHTML = '<div class="text-xs text-slate-500 py-2">Reload to see members</div>';
  } catch (e) { showToast(e.message, true); }
};

loadDepts();
