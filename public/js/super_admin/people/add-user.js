/**
 * root/public/js/super_admin/people/add-user.js
 * Admin Management - Super Admin
 */

let adminRoleId = null;
let allUsers = [];
let allRoles = [];
let allCompanies = [];

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
        const response = await fetch('/api/roles/admin', { credentials: 'include' });
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
        const response = await fetch('/api/companies', { credentials: 'include' });
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
        const response = await fetch('/api/roles', { credentials: 'include' });
        if (!response.ok) throw new Error('Failed to fetch roles');
        const result = await response.json();
        allRoles = result.data || [];
    } catch (err) {
        console.error('Error loading roles:', err);
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
    const tbody = document.getElementById('adminTableBody');
    
    if (!admins || admins.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="py-4 text-center text-slate-500">No admin users found</td></tr>`;
        return;
    }

    let html = '';
    admins.forEach(admin => {
        // Count users managed by this admin's company
        const managedUsers = allUsers.filter(u => u.company_id === admin.company_id && u.id !== admin.id);
        const userCount = managedUsers.length;
        
        // Get unique roles in this admin's company
        const companyRoles = new Set(managedUsers.map(u => u.role_name).filter(Boolean));
        const roleList = Array.from(companyRoles).join(', ') || 'None';
        
        // Status badge
        const isActive = admin.is_active !== 0;
        const statusBadge = isActive 
            ? '<span class="px-1.5 py-[1px] bg-emerald-500/20 text-emerald-400 text-[9px] uppercase font-bold rounded border border-emerald-500/30">Active</span>'
            : '<span class="px-1.5 py-[1px] bg-slate-500/20 text-slate-400 text-[9px] uppercase font-bold rounded border border-slate-500/30">Inactive</span>';

        // Company name
        const company = allCompanies.find(c => c.id === admin.company_id);
        const companyName = company ? company.company_name : 'N/A';

        // Admin name
        const adminName = admin.first_name || admin.name || 'Unknown';
        const initials = adminName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

        html += `
            <tr class="hover:bg-slate-800/30 transition">
                <td class="py-1.5 px-2">
                    <div class="flex items-center gap-2">
                        <div class="w-6 h-6 rounded bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-violet-300 font-bold text-[9px]">${initials}</div>
                        <span class="text-slate-200 text-[10px] font-medium">${adminName}</span>
                    </div>
                </td>
                <td class="py-1.5 px-2 text-slate-300 text-[10px]">${admin.email || 'N/A'}</td>
                <td class="py-1.5 px-2 text-slate-300 text-[10px]">${companyName}</td>
                <td class="py-1.5 px-2 text-slate-300 text-[10px]">${userCount} users</td>
                <td class="py-1.5 px-2 text-slate-300 text-[10px]">${roleList}</td>
                <td class="py-1.5 px-2">${statusBadge}</td>
                <td class="py-1.5 px-2">
                    <div class="flex gap-1">
                        <button onclick="openEditModal(${admin.id})" class="px-1.5 py-0.5 bg-slate-800 hover:bg-violet-500/20 text-slate-300 hover:text-violet-400 text-[9px] rounded border border-slate-700 hover:border-violet-500/30 transition" title="Edit admin">
                            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                            </svg>
                        </button>
                        <button onclick="toggleAdminStatus(${admin.id}, ${isActive})" class="px-1.5 py-0.5 bg-slate-800 hover:bg-${isActive ? 'rose-500' : 'emerald-500'}/20 text-slate-300 hover:text-${isActive ? 'rose-400' : 'emerald-400'} text-[9px] rounded border border-slate-700 hover:border-${isActive ? 'rose-500' : 'emerald-500'}/30 transition" title="${isActive ? 'Deactivate admin' : 'Activate admin'}">
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
        const response = await fetch(`/api/users/${adminId}`, {
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

        alert('Admin updated successfully!');
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
        alert('Admin role is not available. Refresh and try again.');
        return;
    }
    
    const formData = new FormData(event.target);
    const userData = Object.fromEntries(formData.entries());

    try {
        const response = await fetch('/api/users', {
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