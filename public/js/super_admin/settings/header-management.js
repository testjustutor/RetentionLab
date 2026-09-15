/**
 * public/js/super_admin/settings/header-management.js
 */

document.addEventListener('DOMContentLoaded', () => {
    loadRoles();
    
    // Role filter change handler
    document.getElementById('roleFilter').addEventListener('change', (e) => {
        if (e.target.value) {
            loadHeaderConfigs(parseInt(e.target.value));
        } else {
            document.getElementById('headerConfigTableBody').innerHTML = 
                '<tr><td colspan="5" class="py-4 text-center text-slate-500">Select a role to view header configurations</td></tr>';
        }
    });
});

/**
 * Load all roles into the filter dropdown
 */
async function loadRoles() {
    try {
        const response = await fetch('/api/header-config/roles');
        const data = await response.json();
        
        if (data.success && data.roles) {
            const select = document.getElementById('roleFilter');
            data.roles.forEach(role => {
                const option = document.createElement('option');
                option.value = role.id;
                option.textContent = role.role_name;
                select.appendChild(option);
            });
        }
    } catch (err) {
        console.error('Failed to load roles:', err);
    }
}

/**
 * Load header configs for a specific role
 */
async function loadHeaderConfigs(roleId) {
    const tbody = document.getElementById('headerConfigTableBody');
    tbody.innerHTML = '<tr><td colspan="5" class="py-4 text-center text-slate-500">Loading...</td></tr>';
    
    try {
        const response = await fetch(`/api/header-config/admin/all`);
        const data = await response.json();
        
        if (!data.success || !data.roles) {
            throw new Error('Invalid response');
        }
        
        // Find the selected role
        const role = data.roles.find(r => r.id === roleId);
        if (!role) {
            tbody.innerHTML = '<tr><td colspan="5" class="py-4 text-center text-slate-500">Role not found</td></tr>';
            return;
        }
        
        // Render pages
        if (!role.pages || role.pages.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="py-4 text-center text-slate-500">No header configs found for this role</td></tr>';
            return;
        }
        
        tbody.innerHTML = role.pages.map(page => `
            <tr class="hover:bg-slate-800/30 transition">
                <td class="py-1.5 px-2 text-slate-300 font-mono">${page.pageKey}</td>
                <td class="py-1.5 px-2 text-slate-200">${page.title || '-'}</td>
                <td class="py-1.5 px-2 text-slate-400 max-w-xs truncate">${page.description || '-'}</td>
                <td class="py-1.5 px-2">
                    <button onclick="toggleStatus(${roleId}, '${page.pageKey}', ${!page.isActive})" 
                            class="px-2 py-0.5 rounded text-[10px] font-medium transition ${page.isActive ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}">
                        ${page.isActive ? 'Active' : 'Inactive'}
                    </button>
                </td>
                <td class="py-1.5 px-2">
                    <button onclick="openEditModal(${roleId}, '${page.pageKey}')" 
                            class="px-2 py-0.5 bg-violet-600 hover:bg-violet-500 text-white text-[10px] rounded transition flex items-center gap-1">
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                        </svg>
                        Edit
                    </button>
                </td>
            </tr>
        `).join('');
        
    } catch (err) {
        console.error('Failed to load header configs:', err);
        tbody.innerHTML = '<tr><td colspan="5" class="py-4 text-center text-red-400">Error loading data</td></tr>';
    }
}

/**
 * Toggle active/inactive status
 */
async function toggleStatus(roleId, pageKey, newStatus) {
    try {
        const response = await fetch('/api/header-config/pages/toggle-status', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roleId, pageKey, isActive: newStatus })
        });
        
        const data = await response.json();
        if (data.success) {
            // Refresh the table
            loadHeaderConfigs(roleId);
        } else {
            alert('Failed to update status: ' + data.error);
        }
    } catch (err) {
        console.error('Failed to toggle status:', err);
        showToast('Error updating status', 'info');
    }
}

/**
 * Open edit modal with current data
 */
async function openEditModal(roleId, pageKey) {
    try {
        const response = await fetch(`/api/header-config/pages/role/${roleId}/${pageKey}`);
        const data = await response.json();
        
        if (!data.success || !data.page) {
            showToast('Failed to load page config', 'info');
            return;
        }
        
        const page = data.page;
        document.getElementById('editRoleId').value = roleId;
        document.getElementById('editPageKey').value = pageKey;
        document.getElementById('editTitle').value = page.title || '';
        document.getElementById('editDescription').value = page.description || '';
        document.getElementById('editRoleTitle').value = page.roleTitle || '';
        document.getElementById('editShowStats').checked = page.showStats || false;
        
        document.getElementById('editHeaderModal').classList.remove('hidden');
    } catch (err) {
        console.error('Failed to load page config:', err);
        showToast('Error loading page config', 'info');
    }
}

/**
 * Close edit modal
 */
function closeEditModal() {
    document.getElementById('editHeaderModal').classList.add('hidden');
    document.getElementById('editResult').textContent = '';
}

/**
 * Handle edit form submission
 */
document.getElementById('editHeaderForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const roleId = parseInt(document.getElementById('editRoleId').value);
    const pageKey = document.getElementById('editPageKey').value;
    const title = document.getElementById('editTitle').value;
    const description = document.getElementById('editDescription').value;
    const roleTitle = document.getElementById('editRoleTitle').value;
    const showStats = document.getElementById('editShowStats').checked;
    
    const resultDiv = document.getElementById('editResult');
    resultDiv.textContent = 'Saving...';
    resultDiv.className = 'text-xs text-slate-400';
    
    try {
        const response = await fetch(`/api/header-config/pages/role/${roleId}/${pageKey}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, description, roleTitle, showStats })
        });
        
        const data = await response.json();
        if (data.success) {
            resultDiv.textContent = '✓ Saved successfully';
            resultDiv.className = 'text-xs text-emerald-400';
            
            // Refresh the table
            setTimeout(() => {
                loadHeaderConfigs(roleId);
                closeEditModal();
            }, 500);
        } else {
            resultDiv.textContent = '✗ Failed: ' + data.error;
            resultDiv.className = 'text-xs text-red-400';
        }
    } catch (err) {
        console.error('Failed to save:', err);
        resultDiv.textContent = '✗ Error saving changes';
        resultDiv.className = 'text-xs text-red-400';
    }
});

/**
 * Refresh data for current role
 */
function refreshData() {
    const roleId = document.getElementById('roleFilter').value;
    if (roleId) {
        loadHeaderConfigs(parseInt(roleId));
    }
}

// Close modal on escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeEditModal();
    }
});

// Close modal on backdrop click
document.getElementById('editHeaderModal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) {
        closeEditModal();
    }
});