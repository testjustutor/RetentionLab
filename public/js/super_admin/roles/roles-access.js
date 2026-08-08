/**
 * root/public/js/super_admin/roles/roles-access.js
 * Roles & Access Management - Super Admin
 */

let allRoles = [];
let allUsers = [];
let allCompanies = [];

// ─── Modal Functions ──────────────────────────────────────────────────────────

function openAddRoleModal() {
    document.getElementById('addRoleModal').classList.remove('hidden');
}

function closeAddRoleModal() {
    document.getElementById('addRoleModal').classList.add('hidden');
    document.getElementById('addRoleForm').reset();
}

window.openAddRoleModal = openAddRoleModal;
window.closeAddRoleModal = closeAddRoleModal;

// ─── Data Loading ─────────────────────────────────────────────────────────────

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

async function loadUsers() {
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

async function loadCompanies() {
    try {
        const response = await fetch('/api/companies', { credentials: 'include' });
        if (!response.ok) throw new Error('Failed to fetch companies');
        const result = await response.json();
        allCompanies = result.data || [];
    } catch (err) {
        console.error('Error loading companies:', err);
    }
}

// ─── Stats Calculation ────────────────────────────────────────────────────────

function calculateStats() {
    const totalRoles = allRoles.length;
    const totalUsers = allUsers.length;
    const uniqueCompanies = new Set(allUsers.map(u => u.company_id).filter(Boolean));
    const avgUsers = totalRoles > 0 ? Math.round(totalUsers / totalRoles) : 0;

    document.getElementById('totalRoles').textContent = totalRoles;
    document.getElementById('totalUsers').textContent = totalUsers;
    document.getElementById('totalCompanies').textContent = uniqueCompanies.size;
    document.getElementById('avgUsersPerRole').textContent = avgUsers;
}

// ─── Role Distribution Bar ────────────────────────────────────────────────────

function getDistributionBar(userCount, maxCount) {
    if (maxCount === 0) return '<div class="w-full bg-slate-800 rounded-full h-1.5"><div class="bg-violet-500 h-1.5 rounded-full" style="width: 0%"></div></div>';
    const percent = (userCount / maxCount) * 100;
    return `
        <div class="w-full bg-slate-800 rounded-full h-1.5">
            <div class="bg-violet-500 h-1.5 rounded-full" style="width: ${percent}%"></div>
        </div>
    `;
}

// ─── Roles Table Rendering ────────────────────────────────────────────────────

function renderRolesTable() {
    const tbody = document.getElementById('rolesTableBody');
    
    if (!allRoles || allRoles.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="py-4 text-center text-slate-500">No roles found</td></tr>`;
        return;
    }

    // Count users per role (by role_id)
    const roleUserCounts = {};
    allUsers.forEach(user => {
        const roleId = user.role_id || 'unknown';
        roleUserCounts[roleId] = (roleUserCounts[roleId] || 0) + 1;
    });

    const maxCount = Math.max(...Object.values(roleUserCounts), 1);

    let html = '';
    allRoles.forEach(role => {
        const userCount = roleUserCounts[role.id] || 0;
        const description = role.description || 'No description';
        
        html += `
            <tr class="hover:bg-slate-800/30 transition">
                <td class="py-2 px-3">
                    <div class="flex items-center gap-2">
                        <div class="w-6 h-6 rounded bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-violet-300 font-bold text-[9px] uppercase">${role.role_name.charAt(0)}</div>
                        <span class="text-xs font-semibold text-slate-200 capitalize">${role.role_name.replace(/_/g, ' ')}</span>
                    </div>
                </td>
                <td class="py-2 px-3 text-xs text-slate-400">${description}</td>
                <td class="py-2 px-3">
                    <span class="text-xs font-semibold text-slate-200">${userCount}</span>
                    <span class="text-[10px] text-slate-500">users</span>
                </td>
                <td class="py-2 px-3 w-32">
                    ${getDistributionBar(userCount, maxCount)}
                </td>
                <td class="py-2 px-3">
                    <div class="flex gap-1">
                        <button onclick="filterUsersByRole('${role.role_name}')" class="px-2 py-0.5 bg-slate-800 hover:bg-violet-500/20 text-slate-300 hover:text-violet-400 text-[10px] rounded border border-slate-700 hover:border-violet-500/30 transition">
                            View Users
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}

// ─── Users by Role Rendering ──────────────────────────────────────────────────

function populateRoleFilter() {
    const filter = document.getElementById('roleUserFilter');
    filter.innerHTML = '<option value="">All Roles</option>';
    allRoles.forEach(role => {
        const option = document.createElement('option');
        option.value = role.role_name;
        option.textContent = role.role_name.charAt(0).toUpperCase() + role.role_name.slice(1).replace(/_/g, ' ');
        filter.appendChild(option);
    });
}

function filterUsersByRole(roleName) {
    const filter = document.getElementById('roleUserFilter');
    if (filter) filter.value = roleName;
    renderUsersByRole();
}

window.filterUsersByRole = filterUsersByRole;

function renderUsersByRole() {
    const tbody = document.getElementById('usersByRoleBody');
    const roleFilter = document.getElementById('roleUserFilter').value;

    let filtered = [...allUsers];
    if (roleFilter) {
        // Find the role by name (case-insensitive)
        const matchedRole = allRoles.find(r => r.role_name.toLowerCase() === roleFilter.toLowerCase());
        if (matchedRole) {
            // Filter users by role_id (more reliable than role_name string)
            filtered = filtered.filter(u => u.role_id === matchedRole.id);
        } else {
            // Fallback: filter by role_name string
            filtered = filtered.filter(u => u.role_name && u.role_name.toLowerCase() === roleFilter.toLowerCase());
        }
    }

    if (!filtered || filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="py-4 text-center text-slate-500">No users found for this filter</td></tr>`;
        return;
    }

    let html = '';
    filtered.forEach(user => {
        const userName = user.first_name || user.name || 'Unknown';
        const initials = userName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
        const isActive = user.is_active !== 0;
        
        const statusBadge = isActive 
            ? '<span class="px-1.5 py-[1px] bg-emerald-500/20 text-emerald-400 text-[10px] uppercase font-bold rounded border border-emerald-500/30">Active</span>'
            : '<span class="px-1.5 py-[1px] bg-slate-500/20 text-slate-400 text-[10px] uppercase font-bold rounded border border-slate-500/30">Inactive</span>';

        const company = allCompanies.find(c => c.id === user.company_id);
        const companyName = company ? company.company_name : 'N/A';
        const roleName = user.role_name ? user.role_name.charAt(0).toUpperCase() + user.role_name.slice(1).replace(/_/g, ' ') : 'N/A';

        html += `
            <tr class="hover:bg-slate-800/30 transition">
                <td class="py-2 px-3">
                    <div class="flex items-center gap-2">
                        <div class="w-6 h-6 rounded bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-300 font-bold text-[9px]">${initials}</div>
                        <span class="text-xs font-medium text-slate-200">${userName}</span>
                    </div>
                </td>
                <td class="py-2 px-3 text-xs text-slate-300">${user.email || 'N/A'}</td>
                <td class="py-2 px-3">
                    <span class="px-1.5 py-0.5 bg-cyan-500/20 text-cyan-400 text-[10px] uppercase font-bold rounded border border-cyan-500/30">${roleName}</span>
                </td>
                <td class="py-2 px-3 text-xs text-slate-300">${companyName}</td>
                <td class="py-2 px-3">${statusBadge}</td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}

window.renderUsersByRole = renderUsersByRole;

// ─── Add Role ─────────────────────────────────────────────────────────────────

document.getElementById('addRoleForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    
    const roleName = document.getElementById('roleName').value.trim();
    const description = document.getElementById('roleDescription').value.trim();

    if (!roleName) {
        alert('Role name is required.');
        return;
    }

    try {
        const response = await fetch('/api/roles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ 
                role_name: roleName,
                description: description 
            })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Failed to create role');
        }

        alert(`Role "${roleName}" created successfully!`);
        closeAddRoleModal();
        await refreshData();
    } catch (err) {
        alert('Error: ' + err.message);
    }
});

// ─── Refresh & Init ───────────────────────────────────────────────────────────

async function refreshData() {
    await Promise.all([
        loadRoles(),
        loadUsers(),
        loadCompanies()
    ]);
    calculateStats();
    renderRolesTable();
    renderUsersByRole();
}

async function init() {
    await Promise.all([
        loadRoles(),
        loadUsers(),
        loadCompanies()
    ]);

    calculateStats();
    renderRolesTable();
    populateRoleFilter();
    renderUsersByRole();
}

document.addEventListener('DOMContentLoaded', init);