/**
 * root/public/js/super_admin/people/access-control.js
 * Access Control - Super Admin
 * Manage user access permissions, roles, and account status.
 */

let allUsers = [];
let allRoles = [];
let allCompanies = [];

// ─── Modal Functions ──────────────────────────────────────────────────────────

function closeEditModal() {
    document.getElementById('editAccessModal').classList.add('hidden');
    document.getElementById('editAccessForm').reset();
}

function closeResetModal() {
    document.getElementById('resetPasswordModal').classList.add('hidden');
    document.getElementById('resetPasswordForm').reset();
}

function closeConfirmModal() {
    document.getElementById('confirmToggleModal').classList.add('hidden');
}

window.closeEditModal = closeEditModal;
window.closeResetModal = closeResetModal;
window.closeConfirmModal = closeConfirmModal;

// ─── Data Loading ─────────────────────────────────────────────────────────────

async function loadRoles() {
    try {
        const response = await fetch('/api/roles', { credentials: 'include' });
        if (!response.ok) throw new Error('Failed to fetch roles');
        const result = await response.json();
        allRoles = result.data || [];
        
        // Populate role filter (exclude super_admin)
        const roleFilter = document.getElementById('roleFilter');
        allRoles.forEach(role => {
            if (role.role_name !== 'super_admin') {
                const option = document.createElement('option');
                option.value = role.role_name;
                option.textContent = role.role_name.charAt(0).toUpperCase() + role.role_name.slice(1).replace('_', ' ');
                roleFilter.appendChild(option);
            }
        });

        // Populate edit role dropdown (include all roles for super_admin)
        const editRole = document.getElementById('editRole');
        allRoles.forEach(role => {
            const option = document.createElement('option');
            option.value = role.id;
            option.textContent = role.role_name.charAt(0).toUpperCase() + role.role_name.slice(1).replace('_', ' ');
            editRole.appendChild(option);
        });
    } catch (err) {
        console.error('Error loading roles:', err);
    }
}

async function loadCompanies() {
    try {
        const response = await fetch('/api/companies', { credentials: 'include' });
        if (!response.ok) throw new Error('Failed to fetch companies');
        const result = await response.json();
        allCompanies = result.data || [];
        
        // Populate company filter
        const companyFilter = document.getElementById('companyFilter');
        allCompanies.forEach(company => {
            const option = document.createElement('option');
            option.value = company.id;
            option.textContent = company.company_name;
            companyFilter.appendChild(option);
        });

        // Populate edit company dropdown
        const editCompany = document.getElementById('editCompany');
        allCompanies.forEach(company => {
            const option = document.createElement('option');
            option.value = company.id;
            option.textContent = company.company_name;
            editCompany.appendChild(option);
        });
    } catch (err) {
        console.error('Error loading companies:', err);
    }
}

async function loadAllUsers() {
    try {
        const response = await fetch('/api/users', { 
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ page: 1, per_page: 100 }),
          credentials: 'include' 
        });
        if (!response.ok) throw new Error('Failed to fetch users');
        const result = await response.json();
        allUsers = result.data || [];
    } catch (err) {
        console.error('Error loading users:', err);
    }
}

// ─── Stats Calculation ────────────────────────────────────────────────────────

function calculateStats() {
    const totalUsers = allUsers.length;
    const activeUsers = allUsers.filter(u => u.is_active !== 0).length;
    const inactiveUsers = allUsers.filter(u => u.is_active === 0).length;
    const uniqueRoles = new Set(allUsers.map(u => u.role_name).filter(Boolean));

    document.getElementById('totalUsers').textContent = totalUsers;
    document.getElementById('activeUsers').textContent = activeUsers;
    document.getElementById('inactiveUsers').textContent = inactiveUsers;
    document.getElementById('totalRoles').textContent = uniqueRoles.size;
}

// ─── Filtering ────────────────────────────────────────────────────────────────

function getFilteredUsers() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase().trim();
    const roleFilter = document.getElementById('roleFilter').value;
    const companyFilter = document.getElementById('companyFilter').value;
    const statusFilter = document.getElementById('statusFilter').value;

    let filtered = [...allUsers];

    // Search filter
    if (searchTerm) {
        filtered = filtered.filter(u => {
            const name = (u.first_name || u.name || '').toLowerCase();
            const email = (u.email || '').toLowerCase();
            return name.includes(searchTerm) || email.includes(searchTerm);
        });
    }

    // Role filter
    if (roleFilter) {
        filtered = filtered.filter(u => u.role_name === roleFilter);
    }

    // Company filter
    if (companyFilter) {
        filtered = filtered.filter(u => String(u.company_id) === companyFilter);
    }

    // Status filter
    if (statusFilter === 'active') {
        filtered = filtered.filter(u => u.is_active !== 0);
    } else if (statusFilter === 'inactive') {
        filtered = filtered.filter(u => u.is_active === 0);
    }

    return filtered;
}

// ─── User Table Rendering ─────────────────────────────────────────────────────

function renderUserTable() {
    const filtered = getFilteredUsers();
    const tbody = document.getElementById('userTableBody');

    if (!filtered || filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="py-4 text-center text-slate-500">No users found matching your filters</td></tr>`;
        return;
    }

    let html = '';
    filtered.forEach(user => {
        const userName = user.first_name || user.name || 'Unknown';
        const initials = userName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
        const isActive = user.is_active !== 0;
        
        const statusBadge = isActive 
            ? '<span class="px-1.5 py-[1px] bg-emerald-500/20 text-emerald-400 text-[9px] uppercase font-bold rounded border border-emerald-500/30">Active</span>'
            : '<span class="px-1.5 py-[1px] bg-rose-500/20 text-rose-400 text-[9px] uppercase font-bold rounded border border-rose-500/30">Inactive</span>';

        const company = allCompanies.find(c => c.id === user.company_id);
        const companyName = company ? company.company_name : 'N/A';
        const roleName = user.role_name ? user.role_name.charAt(0).toUpperCase() + user.role_name.slice(1).replace('_', ' ') : 'N/A';

        html += `
            <tr class="hover:bg-slate-800/30 transition">
                <td class="py-1.5 px-2">
                    <div class="flex items-center gap-2">
                        <div class="w-6 h-6 rounded bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-300 font-bold text-[9px]">${initials}</div>
                        <span class="text-slate-200 text-[10px] font-medium">${userName}</span>
                    </div>
                </td>
                <td class="py-1.5 px-2 text-slate-300 text-[10px]">${user.email || 'N/A'}</td>
                <td class="py-1.5 px-2">
                    <span class="px-1.5 py-[1px] bg-cyan-500/20 text-cyan-400 text-[9px] uppercase font-bold rounded border border-cyan-500/30">${roleName}</span>
                </td>
                <td class="py-1.5 px-2 text-slate-300 text-[10px]">${companyName}</td>
                <td class="py-1.5 px-2">${statusBadge}</td>
                <td class="py-1.5 px-2">
                    <div class="flex gap-1">
                        <button onclick="openEditModal(${user.id})" class="px-1.5 py-0.5 bg-slate-800 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-400 text-[9px] rounded border border-slate-700 hover:border-cyan-500/30 transition" title="Edit permissions">
                            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                            </svg>
                        </button>
                        <button onclick="openResetModal(${user.id})" class="px-1.5 py-0.5 bg-slate-800 hover:bg-amber-500/20 text-slate-300 hover:text-amber-400 text-[9px] rounded border border-slate-700 hover:border-amber-500/30 transition" title="Reset password">
                            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                            </svg>
                        </button>
                        <button onclick="openToggleConfirm(${user.id}, ${isActive})" class="px-1.5 py-0.5 bg-slate-800 hover:bg-${isActive ? 'rose-500' : 'emerald-500'}/20 text-slate-300 hover:text-${isActive ? 'rose-400' : 'emerald-400'} text-[9px] rounded border border-slate-700 hover:border-${isActive ? 'rose-500' : 'emerald-500'}/30 transition" title="${isActive ? 'Deactivate user' : 'Activate user'}">
                            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                ${isActive 
                                    ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/>'
                                    : '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>'
                                }
                            </svg>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}

// ─── Edit Access Permissions ──────────────────────────────────────────────────

function openEditModal(userId) {
    const user = allUsers.find(u => u.id === userId);
    if (!user) return;

    const userName = user.first_name || user.name || 'Unknown';
    const initials = userName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

    document.getElementById('editUserId').value = user.id;
    document.getElementById('editUserAvatar').textContent = initials;
    document.getElementById('editUserName').textContent = userName;
    document.getElementById('editUserEmail').textContent = user.email || '';
    
    const editRole = document.getElementById('editRole');
    if (user.role_id) editRole.value = user.role_id;
    
    const editCompany = document.getElementById('editCompany');
    if (user.company_id) editCompany.value = user.company_id;

    // Set active/inactive radio
    const activeRadio = document.querySelector('input[name="is_active"][value="1"]');
    const inactiveRadio = document.querySelector('input[name="is_active"][value="0"]');
    if (user.is_active !== 0) {
        activeRadio.checked = true;
    } else {
        inactiveRadio.checked = true;
    }

    document.getElementById('editAccessModal').classList.remove('hidden');
}

window.openEditModal = openEditModal;

document.getElementById('editAccessForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    
    const userId = document.getElementById('editUserId').value;
    const formData = new FormData(event.target);
    const data = Object.fromEntries(formData.entries());

    const payload = {};
    if (data.name) payload.first_name = data.name;
    if (data.role_id) payload.role_id = parseInt(data.role_id, 10);
    if (data.company_id) payload.company_id = parseInt(data.company_id, 10);
    if (data.is_active !== undefined) payload.is_active = parseInt(data.is_active, 10);

    try {
        const response = await fetch(`/api/users/${userId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Failed to update user');
        }

        alert('Access permissions updated successfully!');
        closeEditModal();
        await refreshData();
    } catch (err) {
        alert('Error: ' + err.message);
    }
});

// ─── Reset Password ───────────────────────────────────────────────────────────

function openResetModal(userId) {
    const user = allUsers.find(u => u.id === userId);
    if (!user) return;

    document.getElementById('resetUserId').value = user.id;
    document.getElementById('resetUserEmail').textContent = user.email || 'Unknown';
    document.getElementById('resetPasswordModal').classList.remove('hidden');
}

window.openResetModal = openResetModal;

document.getElementById('resetPasswordForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    
    const userId = document.getElementById('resetUserId').value;
    const formData = new FormData(event.target);
    const data = Object.fromEntries(formData.entries());

    try {
        const response = await fetch(`/api/users/${userId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                password_hash: data.password
            })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Failed to reset password');
        }

        alert('Password reset successfully!');
        closeResetModal();
    } catch (err) {
        alert('Error: ' + err.message);
    }
});

// ─── Toggle User Status with Confirmation ─────────────────────────────────────

function openToggleConfirm(userId, isCurrentlyActive) {
    const user = allUsers.find(u => u.id === userId);
    if (!user) return;

    const userName = user.first_name || user.name || 'Unknown';
    const action = isCurrentlyActive ? 'deactivate' : 'activate';

    document.getElementById('confirmToggleUserId').value = userId;
    document.getElementById('confirmToggleNewStatus').value = isCurrentlyActive ? 0 : 1;
    document.getElementById('confirmToggleMessage').textContent = 
        `Are you sure you want to ${action} "${userName}" (${user.email})?`;
    document.getElementById('confirmToggleTitle').innerHTML = `
        <svg class="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"/>
        </svg>
        ${isCurrentlyActive ? 'Deactivate' : 'Activate'} User
    `;
    document.getElementById('confirmToggleBtn').textContent = 
        isCurrentlyActive ? 'Yes, Deactivate' : 'Yes, Activate';
    document.getElementById('confirmToggleBtn').className = 
        `flex-1 px-3 py-1.5 ${isCurrentlyActive ? 'bg-rose-600 hover:bg-rose-500' : 'bg-emerald-600 hover:bg-emerald-500'} text-white text-xs font-semibold rounded transition`;

    document.getElementById('confirmToggleModal').classList.remove('hidden');
}

window.openToggleConfirm = openToggleConfirm;

async function executeToggleStatus() {
    const userId = document.getElementById('confirmToggleUserId').value;
    const newStatus = parseInt(document.getElementById('confirmToggleNewStatus').value);
    const isActive = newStatus === 1;

    try {
        const response = await fetch(`/api/users/${userId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ is_active: newStatus })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || `Failed to ${isActive ? 'activate' : 'deactivate'} user`);
        }

        alert(`User ${isActive ? 'activated' : 'deactivated'} successfully!`);
        closeConfirmModal();
        await refreshData();
    } catch (err) {
        alert('Error: ' + err.message);
    }
}

window.executeToggleStatus = executeToggleStatus;

// ─── Refresh & Init ───────────────────────────────────────────────────────────

async function refreshData() {
    await loadAllUsers();
    calculateStats();
    renderUserTable();
}

// Debounced search
let searchTimeout;
document.getElementById('searchInput').addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(renderUserTable, 200);
});

// Filter change events
document.getElementById('roleFilter').addEventListener('change', renderUserTable);
document.getElementById('companyFilter').addEventListener('change', renderUserTable);
document.getElementById('statusFilter').addEventListener('change', renderUserTable);

async function init() {
    await Promise.all([
        loadRoles(),
        loadCompanies(),
        loadAllUsers()
    ]);

    calculateStats();
    renderUserTable();
}

document.addEventListener('DOMContentLoaded', init);

