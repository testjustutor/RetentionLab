/**
 * root/public/js/super_admin/people/permission-rubrics.js
 * Permission Rubrics - Super Admin
 * View and manage rubric category assignments to admin users.
 */

let allAdmins = [];
let allCategories = [];
let allAssignments = [];

// ─── Modal Functions ──────────────────────────────────────────────────────────

function closeDetailModal() {
    document.getElementById('assignmentDetailModal').classList.add('hidden');
}

function closeRemoveModal() {
    document.getElementById('confirmRemoveModal').classList.add('hidden');
}

window.closeDetailModal = closeDetailModal;
window.closeRemoveModal = closeRemoveModal;

// ─── Data Loading ─────────────────────────────────────────────────────────────

async function loadAdmins() {
    try {
        const response = await fetch('/api/users', { credentials: 'include' });
        if (!response.ok) throw new Error('Failed to fetch users');
        const result = await response.json();
        // Filter to admin users only (exclude super_admin)
        allAdmins = (result.data || []).filter(u => u.role_name === 'admin');
        
        // Populate admin filter dropdown
        const adminFilter = document.getElementById('adminFilter');
        adminFilter.innerHTML = '<option value="">All Admin Users</option>';
        
        // Populate quick assign dropdown
        const quickAdmin = document.getElementById('quickAdminUserId');
        quickAdmin.innerHTML = '<option value="">Select admin user...</option>';
        
        allAdmins.forEach(admin => {
            const name = admin.first_name || admin.name || 'Unknown';
            const label = `${name} (${admin.email})`;
            
            const opt1 = document.createElement('option');
            opt1.value = admin.id;
            opt1.textContent = label;
            adminFilter.appendChild(opt1);
            
            const opt2 = document.createElement('option');
            opt2.value = admin.id;
            opt2.textContent = label;
            quickAdmin.appendChild(opt2);
        });
    } catch (err) {
        console.error('Error loading admins:', err);
    }
}

async function loadCategories() {
    try {
        const response = await fetch('/api/rubric-admin/categories', { credentials: 'include' });
        if (!response.ok) throw new Error('Failed to fetch categories');
        const result = await response.json();
        allCategories = result.data || [];
        
        // Populate category filter dropdown
        const categoryFilter = document.getElementById('categoryFilter');
        categoryFilter.innerHTML = '<option value="">All Categories</option>';
        
        // Populate quick assign dropdown
        const quickCat = document.getElementById('quickCategoryId');
        quickCat.innerHTML = '<option value="">Select category...</option>';
        
        allCategories.forEach(cat => {
            const opt1 = document.createElement('option');
            opt1.value = cat.category_id;
            opt1.textContent = `${cat.name} (${cat.category_id})`;
            categoryFilter.appendChild(opt1);
            
            const opt2 = document.createElement('option');
            opt2.value = cat.category_id;
            opt2.textContent = `${cat.name} (${cat.category_id})`;
            quickCat.appendChild(opt2);
        });
    } catch (err) {
        console.error('Error loading categories:', err);
    }
}

async function loadAssignments() {
    try {
        const response = await fetch('/api/rubric-admin/assignments', { credentials: 'include' });
        if (!response.ok) throw new Error('Failed to fetch assignments');
        const result = await response.json();
        allAssignments = result.data || [];
    } catch (err) {
        console.error('Error loading assignments:', err);
    }
}

// ─── Stats Calculation ────────────────────────────────────────────────────────

function calculateStats() {
    const totalAdmins = allAdmins.length;
    const totalAssignments = allAssignments.length;
    const uniqueCategories = new Set(allAssignments.map(a => a.category_id));
    const avgPerAdmin = totalAdmins > 0 ? (totalAssignments / totalAdmins).toFixed(1) : '0';

    document.getElementById('totalAdmins').textContent = totalAdmins;
    document.getElementById('totalAssignments').textContent = totalAssignments;
    document.getElementById('totalCategories').textContent = uniqueCategories.size;
    document.getElementById('avgPerAdmin').textContent = avgPerAdmin;
}

// ─── Filtering ────────────────────────────────────────────────────────────────

function getFilteredAssignments() {
    const adminFilter = document.getElementById('adminFilter').value;
    const categoryFilter = document.getElementById('categoryFilter').value;

    // Build a map of admin_id -> assignments for rich display
    const adminAssignmentMap = {};

    allAdmins.forEach(admin => {
        if (adminFilter && String(admin.id) !== adminFilter) return;
        
        const adminAssignments = allAssignments.filter(a => a.admin_user_id === admin.id);
        const assignedCategories = adminAssignments.map(a => a.category_name || a.category_id);
        
        if (categoryFilter) {
            const hasCategory = adminAssignments.some(a => a.category_id === categoryFilter);
            if (!hasCategory) return;
        }

        adminAssignmentMap[admin.id] = {
            admin,
            assignments: adminAssignments,
            categories: assignedCategories,
            categoryDetails: adminAssignments.map(a => ({
                category_id: a.category_id,
                category_name: a.category_name || a.category_id
            }))
        };
    });

    return adminAssignmentMap;
}

// ─── Permission Table Rendering ───────────────────────────────────────────────

function renderPermissionTable() {
    const filtered = getFilteredAssignments();
    const tbody = document.getElementById('permissionTableBody');
    const adminIds = Object.keys(filtered);

    if (adminIds.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="py-4 text-center text-slate-500">No admin users found matching your filters</td></tr>`;
        return;
    }

    let html = '';
    adminIds.forEach(id => {
        const { admin, assignments, categories, categoryDetails } = filtered[id];
        const name = admin.first_name || admin.name || 'Unknown';
        const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
        const email = admin.email || 'N/A';

        // Build category badges
        let categoryBadges = '';
        if (categories.length === 0) {
            categoryBadges = '<span class="text-slate-500 text-[9px]">No categories assigned</span>';
        } else {
            categoryBadges = categories.slice(0, 3).map(cat => 
                `<span class="inline-block px-1.5 py-[1px] bg-violet-500/20 text-violet-400 text-[9px] rounded border border-violet-500/30 mr-1 mb-0.5">${cat}</span>`
            ).join('');
            if (categories.length > 3) {
                categoryBadges += `<span class="text-slate-400 text-[9px]">+${categories.length - 3} more</span>`;
            }
        }

        const totalIndicators = assignments.reduce((sum, a) => sum + (a.indicator_count || 0), 0);

        html += `
            <tr class="hover:bg-slate-800/30 transition">
                <td class="py-1.5 px-2">
                    <div class="flex items-center gap-2">
                        <div class="w-6 h-6 rounded bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-violet-300 font-bold text-[9px]">${initials}</div>
                        <span class="text-slate-200 text-[10px] font-medium">${name}</span>
                    </div>
                </td>
                <td class="py-1.5 px-2 text-slate-300 text-[10px]">${email}</td>
                <td class="py-1.5 px-2">
                    <div class="flex flex-wrap gap-0.5">${categoryBadges}</div>
                </td>
                <td class="py-1.5 px-2 text-slate-300 text-[10px]">${totalIndicators > 0 ? totalIndicators : '-'}</td>
                <td class="py-1.5 px-2">
                    <div class="flex gap-1">
                        <button onclick="viewDetails(${admin.id})" class="px-1.5 py-0.5 bg-slate-800 hover:bg-violet-500/20 text-slate-300 hover:text-violet-400 text-[9px] rounded border border-slate-700 hover:border-violet-500/30 transition" title="View details">
                            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                            </svg>
                        </button>
                        ${categories.length > 0 ? `<button onclick="openRemoveConfirm('${categoryDetails[0].category_id}', ${admin.id}, '${categoryDetails[0].category_name}')" class="px-1.5 py-0.5 bg-slate-800 hover:bg-rose-500/20 text-slate-300 hover:text-rose-400 text-[9px] rounded border border-slate-700 hover:border-rose-500/30 transition" title="Remove assignment">
                            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                            </svg>
                        </button>` : ''}
                    </div>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}

// ─── View Details Modal ───────────────────────────────────────────────────────

async function viewDetails(adminId) {
    const admin = allAdmins.find(u => u.id === adminId);
    if (!admin) return;

    const name = admin.first_name || admin.name || 'Unknown';
    document.getElementById('modalDetailTitle').textContent = `Rubric Permissions: ${name}`;
    
    const body = document.getElementById('modalDetailBody');

    try {
        // Fetch admin-specific rubric categories and indicators
        const [catResp, indResp] = await Promise.all([
            fetch(`/api/rubric-admin/admin-categories/${adminId}`, { credentials: 'include' }),
            fetch(`/api/rubric-admin/admin-indicators/${adminId}`, { credentials: 'include' })
        ]);

        const catResult = await catResp.json();
        const indResult = await indResp.json();

        const categories = catResult.data || [];
        const indicators = indResult.data || [];

        if (categories.length === 0) {
            body.innerHTML = '<p class="text-slate-400 text-xs">This admin has no rubric categories assigned yet.</p>';
        } else {
            let html = '';
            categories.forEach(cat => {
                // Convert both to string for safe comparison (type may differ from DB)
                const catIndicators = indicators.filter(ind => String(ind.original_category_id) === String(cat.original_category_id));
                html += `
                    <div class="mb-3 bg-slate-800/30 rounded-lg p-2 border border-slate-800/60">
                        <div class="flex items-center justify-between mb-1">
                            <h4 class="text-xs font-semibold text-slate-200">${cat.name}</h4>
                            <span class="text-[10px] text-violet-400 font-mono">Weight: ${cat.weight}</span>
                        </div>
                        ${catIndicators.length > 0 ? `
                            <div class="space-y-0.5">
                                ${catIndicators.map(ind => `
                                    <div class="flex items-center justify-between text-[10px] px-1">
                                        <span class="text-slate-300">${ind.name}</span>
                                        <div class="flex items-center gap-2">
                                            <span class="text-slate-400 text-[9px]">${ind.type || 'HUMAN'}</span>
                                            <span class="text-amber-400 font-mono">Value: ${ind.value}</span>
                                            ${ind.is_gate ? '<span class="text-rose-400 text-[9px]">⚠ Gate</span>' : ''}
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        ` : '<p class="text-[10px] text-slate-500">No indicators in this category</p>'}
                    </div>
                `;
            });
            body.innerHTML = html;
        }
    } catch (err) {
        body.innerHTML = `<p class="text-red-400 text-xs">Error loading details: ${err.message}</p>`;
    }

    document.getElementById('assignmentDetailModal').classList.remove('hidden');
}

window.viewDetails = viewDetails;

// ─── Remove Assignment ────────────────────────────────────────────────────────

function openRemoveConfirm(categoryId, adminUserId, categoryName) {
    const admin = allAdmins.find(u => u.id === adminUserId);
    const adminName = admin ? (admin.first_name || admin.name || 'Unknown') : 'Unknown';

    document.getElementById('removeCategoryId').value = categoryId;
    document.getElementById('removeAdminUserId').value = adminUserId;
    document.getElementById('removeConfirmMessage').textContent = 
        `Remove "${categoryName}" from "${adminName}"? This will also delete their custom weightage/value settings.`;
    
    document.getElementById('confirmRemoveModal').classList.remove('hidden');
}

window.openRemoveConfirm = openRemoveConfirm;

async function executeRemove() {
    const categoryId = document.getElementById('removeCategoryId').value;
    const adminUserId = document.getElementById('removeAdminUserId').value;

    try {
        const response = await fetch(`/api/rubric-admin/assign?category_id=${categoryId}&admin_user_id=${adminUserId}`, {
            method: 'DELETE',
            credentials: 'include'
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Failed to remove assignment');
        }

        alert('Assignment removed successfully!');
        closeRemoveModal();
        await refreshData();
    } catch (err) {
        alert('Error: ' + err.message);
    }
}

window.executeRemove = executeRemove;

// ─── Quick Assign ─────────────────────────────────────────────────────────────

document.getElementById('quickAssignForm').addEventListener('submit', async (event) => {
    event.preventDefault();

    const categoryId = document.getElementById('quickCategoryId').value;
    const adminUserId = document.getElementById('quickAdminUserId').value;
    const resultDiv = document.getElementById('quickAssignResult');

    if (!categoryId || !adminUserId) {
        resultDiv.innerHTML = '<p class="text-rose-400">Please select both an admin user and a category.</p>';
        return;
    }

    const admin = allAdmins.find(u => u.id == adminUserId);
    const adminName = admin ? (admin.first_name || admin.name || 'Unknown') : 'Unknown';
    const cat = allCategories.find(c => c.category_id === categoryId);
    const catName = cat ? cat.name : categoryId;

    try {
        const response = await fetch('/api/rubric-admin/assign', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ category_id: categoryId, admin_user_id: parseInt(adminUserId) })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Assignment failed');
        }

        const result = await response.json();
        const indicatorsCopied = result.indicators_copied || 0;
        
        resultDiv.innerHTML = `<p class="text-emerald-400 text-[10px]">✓ Assigned "${catName}" to ${adminName} — ${indicatorsCopied} indicators copied.</p>`;
        
        // Reset form
        document.getElementById('quickCategoryId').value = '';
        document.getElementById('quickAdminUserId').value = '';
        
        await refreshData();
        
        // Clear success message after 3 seconds
        setTimeout(() => { resultDiv.innerHTML = ''; }, 3000);
    } catch (err) {
        resultDiv.innerHTML = `<p class="text-rose-400 text-[10px]">Error: ${err.message}</p>`;
    }
});

// ─── Filter Events ────────────────────────────────────────────────────────────

document.getElementById('adminFilter').addEventListener('change', renderPermissionTable);
document.getElementById('categoryFilter').addEventListener('change', renderPermissionTable);

// ─── Refresh & Init ───────────────────────────────────────────────────────────

async function refreshData() {
    await Promise.all([
        loadAssignments()
    ]);
    calculateStats();
    renderPermissionTable();
}

async function init() {
    await Promise.all([
        loadAdmins(),
        loadCategories(),
        loadAssignments()
    ]);

    calculateStats();
    renderPermissionTable();
}

document.addEventListener('DOMContentLoaded', init);
