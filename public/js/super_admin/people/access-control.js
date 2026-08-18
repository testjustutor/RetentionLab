/**
 * root/public/js/super_admin/people/access-control.js
 * User Directory - Super Admin
 *
 * Flow: HTML -> JS -> Routes(super_admin/people/access-control) -> Controller ->
 *       Model(ManageUsersModel) -> DB
 * Table uses the centralized createTable (from common-ui-super-admin.js).
 */

let allUsers = [];
let allRoles = [];
let allCompanies = [];
let userTable = null;

// â”€â”€â”€ Modal Functions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function closeEditModal() {
    document.getElementById('editAccessModal').classList.add('hidden');
    document.getElementById('editAccessForm').reset();
}

function closeResetModal() {
    document.getElementById('resetPasswordModal').classList.add('hidden');
    document.getElementById('resetPasswordForm').reset();
}

window.closeEditModal = closeEditModal;
window.closeResetModal = closeResetModal;

// â”€â”€â”€ Data Loading â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function loadRoles() {
    try {
        const response = await fetch('/api/super_admin/people/access-control/roles', { credentials: 'include' });
        if (!response.ok) throw new Error('Failed to fetch roles');
        const result = await response.json();
        allRoles = result.data || [];

        // Populate role filter (excluding super_admin)
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
        const response = await fetch('/api/super_admin/people/access-control/companies', { credentials: 'include' });
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
        const response = await fetch('/api/super_admin/people/access-control/users', {
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

// â”€â”€â”€ Stats Calculation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€â”€ Filtering â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function getFilteredUsers() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase().trim();
    const roleFilter = document.getElementById('roleFilter').value;
    const companyFilter = document.getElementById('companyFilter').value;
    const statusFilter = document.getElementById('statusFilter').value;

    let filtered = [...allUsers];

    if (searchTerm) {
        filtered = filtered.filter(u => {
            const name = (u.first_name || u.name || '').toLowerCase();
            const email = (u.email || '').toLowerCase();
            return name.includes(searchTerm) || email.includes(searchTerm);
        });
    }
    if (roleFilter) {
        filtered = filtered.filter(u => u.role_name === roleFilter);
    }
    if (companyFilter) {
        filtered = filtered.filter(u => String(u.company_id) === companyFilter);
    }
    if (statusFilter === 'active') {
        filtered = filtered.filter(u => u.is_active !== 0);
    } else if (statusFilter === 'inactive') {
        filtered = filtered.filter(u => u.is_active === 0);
    }
    return filtered;
}

// â”€â”€â”€ User Table Rendering (centralized createTable) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function renderUserTable() {
    const container = document.getElementById('userTableContainer');
    if (!container) return;

    // Map filtered users to flat rows for the createTable component
    const rows = getFilteredUsers().map(user => {
        const company = allCompanies.find(c => c.id === user.company_id);
        return {
            id: user.id,
            role_id: user.role_id,
            company_id: user.company_id,
            name: user.first_name || user.name || 'Unknown',
            email: user.email || 'N/A',
            role: user.role_name || 'N/A',
            company: company ? company.company_name : 'N/A',
            is_active: user.is_active
        };
    });

    // Reusable icons (kept local to avoid duplication)
    const EDIT_ICON = '<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>';
    const RESET_ICON = '<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>';
    const DEACTIVATE = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/>';
    const ACTIVATE = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>';


    if (!userTable) {
        userTable = createTable({
            containerId: 'userTableContainer',
            searchable: false,          // search handled by external #searchInput + filters
            pagination: true,
            exportable: true,
            exportFilename: 'access-control',
            emptyMessage: 'No users found matching your filters',
            headers: [
                { label: 'User', key: 'name', width: '22%', render: (val, row) => {
                    const initials = String(row.name || 'U').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
                    return '<div class="flex items-center gap-2">' + '<div class="w-6 h-6 rounded bg-violet-100 border border-violet-200 flex items-center justify-center text-violet-700 font-bold text-[9px]">' + escHtml(initials) + '</div>' + '<span class="text-violet-950 text-xs font-semibold">' + escHtml(row.name || 'Unknown') + '</span>' + '</div>';
                } },
                { label: 'Email', key: 'email', width: '26%', render: (val) => '<span class="text-violet-900 text-xs">' + escHtml(val || 'N/A') + '</span>' },
                { label: 'Role', key: 'role', width: '14%', render: (val) => {
                    const label = String(val || 'N/A');
                    return '<span class="inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-cyan-100 text-cyan-700 border border-cyan-200">' + escHtml(label.charAt(0).toUpperCase() + label.slice(1).replace('_', ' ')) + '</span>';
                } },
                { label: 'Company', key: 'company', width: '16%', render: (val) => '<span class="text-violet-900 text-xs">' + escHtml(val || 'N/A') + '</span>' },
                { label: 'Status', key: 'is_active', width: '10%', render: (val) => {
                    const active = val !== 0;
                    return active ? '<span class="inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 text-emerald-700 border border-emerald-200">Active</span>' : '<span class="inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-300">Inactive</span>';
                } },
                { label: 'Actions', key: 'id', width: '12%', align: 'right', render: (val, row) => {
                    const active = row.is_active !== 0;
                    return '<div class="flex gap-1 justify-end">' +
                        '<button onclick="openEditModal(' + val + ')" class="px-1.5 py-0.5 bg-white hover:bg-violet-50 text-violet-700 text-[9px] rounded border border-slate-300 hover:border-violet-300 transition" title="Edit user">' + EDIT_ICON + '</button>' +
                        '<button onclick="openResetModal(' + val + ')" class="px-1.5 py-0.5 bg-white hover:bg-amber-50 text-amber-600 text-[9px] rounded border border-slate-300 hover:border-amber-300 transition" title="Reset password">' + RESET_ICON + '</button>' +
                        '<button onclick="openToggleConfirm(' + val + ', ' + (active ? 'true' : 'false') + ')" class="px-1.5 py-0.5 bg-white hover:bg-' + (active ? 'rose-100' : 'emerald-100') + ' text-violet-700 text-[9px] rounded border border-slate-300 hover:border-' + (active ? 'rose-300' : 'emerald-300') + ' transition" title="' + (active ? 'Deactivate user' : 'Activate user') + '">' +
                        '<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">' + (active ? DEACTIVATE : ACTIVATE) + '</svg>' +
                        '</button>' + '</div>';
                } }
            ]
        });
    }

    userTable.setData(rows);
}


// â”€â”€â”€ Edit User â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function openEditModal(userId) {
    const user = allUsers.find(u => u.id === userId);
    if (!user) return;

    document.getElementById('editAccessUserId').value = user.id;
    document.getElementById('editName').value = user.first_name || user.name || '';

    const editRole = document.getElementById('editRole');
    if (user.role_id) editRole.value = user.role_id;

    const editCompany = document.getElementById('editCompany');
    if (user.company_id) editCompany.value = user.company_id;

    document.getElementById('editAccessModal').classList.remove('hidden');
}

window.openEditModal = openEditModal;

document.getElementById('editAccessForm').addEventListener('submit', async (event) => {
    event.preventDefault();

    const userId = document.getElementById('editAccessUserId').value;
    const formData = new FormData(event.target);
    const data = Object.fromEntries(formData.entries());

    try {
        const response = await fetch(`/api/super_admin/people/access-control/users/${userId}`, {
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

        showToast('User updated successfully!', 'info');
        closeEditModal();
        await refreshData();
    } catch (err) {
        alert('Error: ' + err.message);
    }
});

// â”€â”€â”€ Reset Password â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
        const response = await fetch(`/api/super_admin/people/access-control/users/${userId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ password: data.password })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Failed to reset password');
        }

        showToast('Password reset successfully!', 'info');
        closeResetModal();
        await refreshData();
    } catch (err) {
        alert('Error: ' + err.message);
    }
});


// â”€â”€â”€ Toggle User Status â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function closeConfirmModal() {
    document.getElementById('confirmToggleModal').classList.add('hidden');
}

function openToggleConfirm(userId, isCurrentlyActive) {
    const user = allUsers.find(u => u.id === userId);
    if (!user) return;
    const userName = user.first_name || user.name || 'Unknown';
    const action = isCurrentlyActive ? 'deactivate' : 'activate';

    document.getElementById('confirmToggleUserId').value = userId;
    document.getElementById('confirmToggleNewStatus').value = isCurrentlyActive ? 0 : 1;
    document.getElementById('confirmToggleMessage').textContent =
        `Are you sure you want to ${action} "${userName}" (${user.email})?`;
    document.getElementById('confirmToggleBtn').textContent = isCurrentlyActive ? 'Yes, Deactivate' : 'Yes, Activate';
    document.getElementById('confirmToggleBtn').className =
        `flex-1 px-3 py-1.5 ${isCurrentlyActive ? 'bg-rose-600 hover:bg-rose-500' : 'bg-emerald-600 hover:bg-emerald-500'} text-white text-xs font-semibold rounded transition`;
    document.getElementById('confirmToggleModal').classList.remove('hidden');
}

async function executeToggleStatus() {
    const userId = document.getElementById('confirmToggleUserId').value;
    const newStatus = parseInt(document.getElementById('confirmToggleNewStatus').value, 10);
    const isActive = newStatus === 1;
    const action = isActive ? 'activate' : 'deactivate';
    try {
        const response = await fetch(`/api/super_admin/people/access-control/users/${userId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ is_active: newStatus })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || `Failed to ${action} user`);
        }

        alert(`User ${action}d successfully!`);
        closeConfirmModal();
        await refreshData();
    } catch (err) {
        alert('Error: ' + err.message);
    }
}

window.closeConfirmModal = closeConfirmModal;
window.openToggleConfirm = openToggleConfirm;
window.executeToggleStatus = executeToggleStatus;

// â”€â”€â”€ Refresh & Init â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

