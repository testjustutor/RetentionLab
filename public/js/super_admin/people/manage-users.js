/**
 * root/public/js/super_admin/people/manage-users.js
 * User Directory - Super Admin
 */

let allUsers = [];
let allRoles = [];
let allCompanies = [];

// ─── Modal Functions ──────────────────────────────────────────────────────────

function closeEditModal() {
    document.getElementById('editUserModal').classList.add('hidden');
    document.getElementById('editUserForm').reset();
}

function closeResetModal() {
    document.getElementById('resetPasswordModal').classList.add('hidden');
    document.getElementById('resetPasswordForm').reset();
}

window.closeEditModal = closeEditModal;
window.closeResetModal = closeResetModal;

// ─── Data Loading ─────────────────────────────────────────────────────────────

async function loadRoles() {
    try {
        const response = await fetch('/api/roles', { credentials: 'include' });
        if (!response.ok) throw new Error('Failed to fetch roles');
        const result = await response.json();
        allRoles = result.data || [];
        
        // Populate role filter
        const roleFilter = document.getElementById('roleFilter');
        allRoles.forEach(role => {
            if (role.role_name !== 'super_admin') {
                const option = document.createElement('option');
                option.value = role.role_name;
                option.textContent = role.role_name.charAt(0).toUpperCase() + role.role_name.slice(1).replace('_', ' ');
                roleFilter.appendChild(option);
            }
        });

        // Populate edit role dropdown
        const editRole = document.getElementById('editRole');
        allRoles.forEach(role => {
            if (role.role_name !== 'super_admin') {
                const option = document.createElement('option');
                option.value = role.id;
                option.textContent = role.role_name.charAt(0).toUpperCase() + role.role_name.slice(1).replace('_', ' ');
                editRole.appendChild(option);
            }
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
    // Exclude super_admin only from counts
    const nonSuperUsers = allUsers.filter(u => u.role_name !== 'super_admin');
    const totalUsers = nonSuperUsers.length;
    const activeUsers = nonSuperUsers.filter(u => u.is_active !== 0).length;
    
    const uniqueCompanies = new Set(nonSuperUsers.map(u => u.company_id).filter(Boolean));
    const uniqueRoles = new Set(nonSuperUsers.map(u => u.role_name).filter(Boolean));

    document.getElementById('totalUsers').textContent = totalUsers;
    document.getElementById('activeUsers').textContent = activeUsers;
    document.getElementById('totalCompanies').textContent = uniqueCompanies.size;
    document.getElementById('totalRoles').textContent = uniqueRoles.size;
}

// ─── Filtering ────────────────────────────────────────────────────────────────

function getFilteredUsers() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase().trim();
    const roleFilter = document.getElementById('roleFilter').value;
    const companyFilter = document.getElementById('companyFilter').value;
    const statusFilter = document.getElementById('statusFilter').value;

    // Exclude super_admin only
    let filtered = allUsers.filter(u => u.role_name !== 'super_admin');

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
            : '<span class="px-1.5 py-[1px] bg-slate-500/20 text-slate-400 text-[9px] uppercase font-bold rounded border border-slate-500/30">Inactive</span>';

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
                        <button onclick="openEditModal(${user.id})" class="px-1.5 py-0.5 bg-slate-800 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-400 text-[9px] rounded border border-slate-700 hover:border-cyan-500/30 transition" title="Edit user">
                            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                            </svg>
                        </button>
                        <button onclick="openResetModal(${user.id})" class="px-1.5 py-0.5 bg-slate-800 hover:bg-amber-500/20 text-slate-300 hover:text-amber-400 text-[9px] rounded border border-slate-700 hover:border-amber-500/30 transition" title="Reset password">
                            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                            </svg>
                        </button>
                        <button onclick="toggleUserStatus(${user.id}, ${isActive})" class="px-1.5 py-0.5 bg-slate-800 hover:bg-${isActive ? 'rose-500' : 'emerald-500'}/20 text-slate-300 hover:text-${isActive ? 'rose-400' : 'emerald-400'} text-[9px] rounded border border-slate-700 hover:border-${isActive ? 'rose-500' : 'emerald-500'}/30 transition" title="${isActive ? 'Deactivate user' : 'Activate user'}">
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

// ─── Edit User ────────────────────────────────────────────────────────────────

function openEditModal(userId) {
    const user = allUsers.find(u => u.id === userId);
    if (!user) return;

    document.getElementById('editUserId').value = user.id;
    document.getElementById('editName').value = user.first_name || user.name || '';
    
    const editRole = document.getElementById('editRole');
    if (user.role_id) editRole.value = user.role_id;
    
    const editCompany = document.getElementById('editCompany');
    if (user.company_id) editCompany.value = user.company_id;

    document.getElementById('editUserModal').classList.remove('hidden');
}

window.openEditModal = openEditModal;

document.getElementById('editUserForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    
    const userId = document.getElementById('editUserId').value;
    const formData = new FormData(event.target);
    const data = Object.fromEntries(formData.entries());

    try {
        const response = await fetch(`/api/users/${userId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                first_name: data.name,
                role_id: parseInt(data.role_id, 10),
                company_id: parseInt(data.company_id, 10)
            })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Failed to update user');
        }

        alert('User updated successfully!');
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

// ─── Toggle User Status ───────────────────────────────────────────────────────

async function toggleUserStatus(userId, isCurrentlyActive) {
    const action = isCurrentlyActive ? 'deactivate' : 'activate';
    if (!confirm(`Are you sure you want to ${action} this user?`)) return;

    try {
        const response = await fetch(`/api/users/${userId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ is_active: isCurrentlyActive ? 0 : 1 })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || `Failed to ${action} user`);
        }

        alert(`User ${action}d successfully!`);
        await refreshData();
    } catch (err) {
        alert('Error: ' + err.message);
    }
}

window.toggleUserStatus = toggleUserStatus;

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