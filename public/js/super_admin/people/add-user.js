/**
 * root/public/js/super_admin/people/add-user.js
 * Admin Management - Super Admin
 */

let adminRoleId = null;
let allUsers = [];
let allRoles = [];
let allCompanies = [];
let adminTable = null;

// ─── Modal Functions ──────────────────────────────────────────────────────────

function openModal() {
    document.getElementById('addAdminModal').classList.remove('hidden');
}

function closeModal() {
    document.getElementById('addAdminModal').classList.add('hidden');
    document.getElementById('addAdminForm').reset();
}

// Expose to HTML onclick
window.openModal = openModal;
window.closeModal = closeModal;

// ─── Data Loading ─────────────────────────────────────────────────────────────

async function loadAdminRole() {
    try {
        const response = await fetch('/api/super_admin/people/roles/admin', { credentials: 'include' });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Failed to fetch admin role');
        }
        const role = await response.json();
        adminRoleId = role.id;
    } catch (err) {
        console.error('Error loading admin role:', err);
    }
}

async function loadCompanies() {
    try {
        const response = await fetch('/api/super_admin/people/companies', { credentials: 'include' });
        if (!response.ok) throw new Error('Failed to fetch companies');
        const result = await response.json();
        allCompanies = result.data || [];
        
        const companySelect = document.getElementById('company');
        companySelect.innerHTML = '<option value="">Select a company</option>';
        allCompanies.forEach(company => {
            const option = document.createElement('option');
            option.value = company.id;
            option.textContent = company.company_name;
            companySelect.appendChild(option);
        });
    } catch (err) {
        console.error('Error loading companies:', err);
    }
}

async function loadRoles() {
    try {
        const response = await fetch('/api/super_admin/people/roles', { credentials: 'include' });
        if (!response.ok) throw new Error('Failed to fetch roles');
        const result = await response.json();
        allRoles = result.data || [];
    } catch (err) {
        console.error('Error loading roles:', err);
    }
}

async function loadAllUsers() {
    try {
        const response = await fetch('/api/super_admin/people/users', { 
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
    // Count admins (users with admin role)
    const admins = allUsers.filter(u => u.role_name === 'admin' || u.role_id === adminRoleId);
    const totalAdmins = admins.length;
    
    // Count total users
    const totalUsers = allUsers.length;
    
    // Count role types
    const uniqueRoles = new Set(allUsers.map(u => u.role_name).filter(Boolean));
    const totalRoles = uniqueRoles.size;
    
    // Count companies
    const uniqueCompanies = new Set(allUsers.map(u => u.company_id).filter(Boolean));
    const totalCompanies = uniqueCompanies.size;

    // Update stats cards
    document.getElementById('totalAdmins').textContent = totalAdmins;
    document.getElementById('totalUsers').textContent = totalUsers;
    document.getElementById('totalRoles').textContent = totalRoles;
    document.getElementById('totalCompanies').textContent = totalCompanies;

    return { admins, totalAdmins, totalUsers, totalRoles, totalCompanies };
}

// ─── Admin Table Rendering ────────────────────────────────────────────────────

function renderAdminTable(admins) {
    const container = document.getElementById('adminTableContainer');
    if (!container) return;

    // Map admins to flat rows for the centralized createTable component
    const rows = (admins || []).map(admin => {
        const managedUsers = allUsers.filter(u => u.company_id === admin.company_id && u.id !== admin.id);
        const company = allCompanies.find(c => c.id === admin.company_id);
        return {
            id: admin.id,
            name: admin.first_name || admin.name || 'Unknown',
            email: admin.email || 'N/A',
            company: company ? company.company_name : 'N/A',
            userCount: managedUsers.length,
            roles: Array.from(new Set(managedUsers.map(u => u.role_name).filter(Boolean))).join(', ') || 'None',
            is_active: admin.is_active
        };
    });

    // Reusable icons (kept local to avoid duplication)
    const EDIT_ICON = '<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>';
    const DEACTIVATE = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/>';
    const ACTIVATE = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>';

    // Initialize the centralized table only once
    if (!adminTable) {
        adminTable = createTable({
            containerId: 'adminTableContainer',
            searchable: true,
            pagination: true,
            exportable: true,
            exportFilename: 'admin-users',
            emptyMessage: 'No admin users found',
            headers: [
                { label: 'Admin', key: 'name', width: '20%', render: (val, row) => {
                    const initials = String(row.name || 'U').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
                    return '<div class="flex items-center gap-2">' + '<div class="w-6 h-6 rounded bg-violet-100 border border-violet-200 flex items-center justify-center text-violet-700 font-bold text-[9px]">' + escHtml(initials) + '</div>' + '<span class="text-violet-950 text-xs font-semibold">' + escHtml(row.name || 'Unknown') + '</span>' + '</div>';
                } },
                { label: 'Email', key: 'email', width: '24%', render: (val) => '<span class="text-violet-900 text-xs">' + escHtml(val || 'N/A') + '</span>' },
                { label: 'Company', key: 'company', width: '16%', render: (val) => '<span class="text-violet-900 text-xs">' + escHtml(val || 'N/A') + '</span>' },
                { label: 'Users Managed', key: 'userCount', width: '10%', render: (val) => '<span class="text-violet-700 text-xs font-bold">' + (val || 0) + ' users</span>' },
                { label: 'Roles', key: 'roles', width: '12%', render: (val) => '<span class="text-violet-900 text-xs">' + escHtml(val || 'None') + '</span>' },
                { label: 'Status', key: 'is_active', width: '8%', render: (val) => {
                    const active = val !== 0;
                    return active ? '<span class="inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 text-emerald-700 border border-emerald-200">Active</span>' : '<span class="inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-300">Inactive</span>';
                } },
                { label: 'Actions', key: 'id', width: '10%', align: 'right', render: (val, row) => {
                    const active = row.is_active !== 0;
                    return '<div class="flex gap-1 justify-end">' +
                        '<button onclick="openEditModal(' + val + ')" class="px-1.5 py-0.5 bg-white hover:bg-violet-50 text-violet-700 text-[9px] rounded border border-slate-300 hover:border-violet-300 transition" title="Edit admin">' + EDIT_ICON + '</button>' +
                        '<button onclick="toggleAdminStatus(' + val + ', ' + (active ? 'true' : 'false') + ')" class="px-1.5 py-0.5 bg-white hover:bg-' + (active ? 'rose-100' : 'emerald-100') + ' text-violet-700 text-[9px] rounded border border-slate-300 hover:border-' + (active ? 'rose-300' : 'emerald-300') + ' transition" title="' + (active ? 'Deactivate admin' : 'Activate admin') + '">' +
                        '<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">' + (active ? DEACTIVATE : ACTIVATE) + '</svg>' +
                        '</button>' + '</div>';
                } }
            ]
        });
    }

    adminTable.setData(rows);
}

// ─── Edit Admin Modal ─────────────────────────────────────────────────────────

function openEditModal(adminId) {
    const admin = allUsers.find(u => u.id === adminId);
    if (!admin) return;

    // Pre-fill edit form with name only
    document.getElementById('editAdminId').value = admin.id;
    document.getElementById('editName').value = admin.first_name || admin.name || '';

    // Show modal
    document.getElementById('editAdminModal').classList.remove('hidden');
}

function closeEditModal() {
    document.getElementById('editAdminModal').classList.add('hidden');
    document.getElementById('editAdminForm').reset();
}

window.openEditModal = openEditModal;
window.closeEditModal = closeEditModal;

// ─── Toggle Admin Status ──────────────────────────────────────────────────────

async function toggleAdminStatus(adminId, isCurrentlyActive) {
    const action = isCurrentlyActive ? 'deactivate' : 'activate';
    if (!confirm(`Are you sure you want to ${action} this admin?`)) return;

    try {
        const response = await fetch(`/api/users/${adminId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ is_active: isCurrentlyActive ? 0 : 1 })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || `Failed to ${action} admin`);
        }

        alert(`Admin ${action}d successfully!`);
        await loadDashboard();
    } catch (err) {
        alert('Error: ' + err.message);
    }
}

window.toggleAdminStatus = toggleAdminStatus;

// ─── Edit Form Submit ─────────────────────────────────────────────────────────

document.getElementById('editAdminForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    
    const adminId = document.getElementById('editAdminId').value;
    const formData = new FormData(event.target);
    const data = Object.fromEntries(formData.entries());

    try {
        const response = await fetch(`/api/super_admin/people/add-user/add-admin/${adminId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                first_name: data.name
            })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Failed to update admin');
        }

        showToast('Admin updated successfully!', 'info');
        closeEditModal();
        await loadDashboard();
    } catch (err) {
        alert('Error: ' + err.message);
    }
});

// ─── Main Load ────────────────────────────────────────────────────────────────

async function loadDashboard() {
    await Promise.all([
        loadAdminRole(),
        loadCompanies(),
        loadRoles(),
        loadAllUsers()
    ]);

    const { admins } = calculateStats();
    renderAdminTable(admins);
}

// ─── Form Submit ──────────────────────────────────────────────────────────────

document.getElementById('addAdminForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!adminRoleId) {
        showToast('Admin role is not available. Refresh and try again.', 'info');
        return;
    }
    
    const formData = new FormData(event.target);
    const userData = Object.fromEntries(formData.entries());

    try {
        const response = await fetch('/api/super_admin/people/add-user/add-admin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                email: userData.email,
                first_name: userData.name,
                password_hash: userData.password,
                role_id: adminRoleId,
                company_id: parseInt(userData.company_id, 10)
            })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Failed to create admin user');
        }

        const created = await response.json();
        alert(`Admin user "${created.email}" created successfully!`);
        closeModal();
        
        // Reload the dashboard to reflect changes
        await loadDashboard();
    } catch (err) {
        alert('Error: ' + err.message);
    }
});

// ─── Add Admin Button ─────────────────────────────────────────────────────────

document.getElementById('addAdminBtn').addEventListener('click', openModal);

// ─── Init ─────────────────────────────────────────────────────────────────────

window.addEventListener('load', loadDashboard);