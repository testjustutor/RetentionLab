/**
 * root/public/js/super_admin/people/permission-rubrics.js
 * Permission Rubrics - Super Admin
 * CRUD system for managing rubric categories and indicators
 */

let allCategories = [];
let allIndicators = [];

// ─── Modal Functions ──────────────────────────────────────────────────────────

function closeCategoryModal() {
    document.getElementById('categoryModal').classList.add('hidden');
}

function closeIndicatorModal() {
    document.getElementById('indicatorModal').classList.add('hidden');
}

window.closeCategoryModal = closeCategoryModal;
window.closeIndicatorModal = closeIndicatorModal;

// ─── Data Loading ─────────────────────────────────────────────────────────────

async function loadCategories() {
    try {
        const response = await fetch('/api/rubric-admin/categories', { credentials: 'include' });
        if (!response.ok) throw new Error('Failed to fetch categories');
        const result = await response.json();
        allCategories = result.data || [];
        renderCategories();
        updateStats();
    } catch (err) {
        console.error('Error loading categories:', err);
    }
}

async function loadIndicators() {
    try {
        const response = await fetch('/api/rubric-admin/indicators', { credentials: 'include' });
        if (!response.ok) throw new Error('Failed to fetch indicators');
        const result = await response.json();
        allIndicators = result.data || [];
        renderIndicators();
        updateStats();
    } catch (err) {
        console.error('Error loading indicators:', err);
    }
}

// ─── Stats Calculation ────────────────────────────────────────────────────────

function updateStats() {
    const totalCategories = allCategories.length;
    const totalIndicators = allIndicators.length;
    const activeItems = [...allCategories.filter(c => c.status === 'active'), ...allIndicators.filter(i => i.status === 'active')].length;
    const inactiveItems = totalCategories + totalIndicators - activeItems;

    document.getElementById('totalCategories').textContent = totalCategories;
    document.getElementById('totalIndicators').textContent = totalIndicators;
    document.getElementById('activeItems').textContent = activeItems;
    document.getElementById('inactiveItems').textContent = inactiveItems;
}

// ─── Categories CRUD ──────────────────────────────────────────────────────────

function renderCategories() {
    const tbody = document.getElementById('categoriesTableBody');
    
    if (allCategories.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="py-4 text-center text-slate-500">No categories found</td></tr>`;
        return;
    }

    let html = '';
    allCategories.forEach(cat => {
        const statusColor = cat.status === 'active' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' : 'text-amber-400 bg-amber-500/10 border-amber-500/30';
        
        html += `
            <tr class="hover:bg-slate-800/30 transition">
                <td class="py-1.5 px-2 text-slate-200 text-[10px] font-mono">${cat.category_id}</td>
                <td class="py-1.5 px-2 text-slate-200 text-[10px]">${cat.name}</td>
                <td class="py-1.5 px-2 text-slate-300 text-[10px]">${cat.weight}%</td>
                <td class="py-1.5 px-2">
                    <span class="inline-block px-1.5 py-[1px] ${statusColor} text-[9px] rounded border">${cat.status}</span>
                </td>
                <td class="py-1.5 px-2">
                    <div class="flex gap-1">
                        <button onclick="editCategory('${cat.category_id}')" class="px-1.5 py-0.5 bg-slate-800 hover:bg-violet-500/20 text-slate-300 hover:text-violet-400 text-[9px] rounded border border-slate-700 hover:border-violet-500/30 transition" title="Edit">
                            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                            </svg>
                        </button>
                        <button onclick="deleteCategory('${cat.category_id}')" class="px-1.5 py-0.5 bg-slate-800 hover:bg-rose-500/20 text-slate-300 hover:text-rose-400 text-[9px] rounded border border-slate-700 hover:border-rose-500/30 transition" title="Delete">
                            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                            </svg>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}

function openCategoryModal() {
    document.getElementById('categoryForm').reset();
    document.getElementById('categoryId').value = '';
    document.getElementById('categoryModalTitle').textContent = 'Add Category';
    document.getElementById('categoryModal').classList.remove('hidden');
}

function editCategory(categoryId) {
    const cat = allCategories.find(c => c.category_id === categoryId);
    if (!cat) return;

    document.getElementById('categoryId').value = cat.id || '';
    document.getElementById('category_id').value = cat.category_id;
    document.getElementById('categoryName').value = cat.name;
    document.getElementById('categoryWeight').value = cat.weight;
    document.getElementById('categoryStatus').value = cat.status;
    document.getElementById('categoryModalTitle').textContent = 'Edit Category';
    document.getElementById('categoryModal').classList.remove('hidden');
}

async function deleteCategory(categoryId) {
    if (!confirm(`Are you sure you want to delete category "${categoryId}"? This will also delete all indicators in this category.`)) {
        return;
    }

    try {
        const response = await fetch(`/api/rubric-admin/categories/${categoryId}`, {
            method: 'DELETE',
            credentials: 'include'
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Failed to delete category');
        }

        alert('Category deleted successfully!');
        await loadCategories();
        await loadIndicators();
    } catch (err) {
        alert('Error: ' + err.message);
    }
}

document.getElementById('categoryForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const id = document.getElementById('categoryId').value;
    const category_id = document.getElementById('category_id').value;
    const name = document.getElementById('categoryName').value;
    const weight = parseFloat(document.getElementById('categoryWeight').value) || 0;
    const status = document.getElementById('categoryStatus').value;

    try {
        const url = id ? `/api/rubric-admin/categories/${id}` : '/api/rubric-admin/categories';
        const method = id ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ category_id, name, weight, status })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Failed to save category');
        }

        closeCategoryModal();
        await loadCategories();
    } catch (err) {
        alert('Error: ' + err.message);
    }
});

// ─── Indicators CRUD ──────────────────────────────────────────────────────────

function renderIndicators() {
    const tbody = document.getElementById('indicatorsTableBody');
    
    if (allIndicators.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="py-4 text-center text-slate-500">No indicators found</td></tr>`;
        return;
    }

    let html = '';
    allIndicators.forEach(ind => {
        const statusColor = ind.status === 'active' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' : 'text-amber-400 bg-amber-500/10 border-amber-500/30';
        
        html += `
            <tr class="hover:bg-slate-800/30 transition">
                <td class="py-1.5 px-2 text-slate-200 text-[10px] font-mono">${ind.indicator_id}</td>
                <td class="py-1.5 px-2 text-slate-200 text-[10px]">${ind.name}</td>
                <td class="py-1.5 px-2 text-slate-300 text-[10px]">${ind.category_name || ind.category_id}</td>
                <td class="py-1.5 px-2 text-slate-300 text-[10px]">${ind.type || 'HUMAN'}</td>
                <td class="py-1.5 px-2 text-slate-300 text-[10px]">${ind.value}</td>
                <td class="py-1.5 px-2">
                    <span class="inline-block px-1.5 py-[1px] ${statusColor} text-[9px] rounded border">${ind.status}</span>
                </td>
                <td class="py-1.5 px-2">
                    <div class="flex gap-1">
                        <button onclick="editIndicator('${ind.indicator_id}')" class="px-1.5 py-0.5 bg-slate-800 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-400 text-[9px] rounded border border-slate-700 hover:border-cyan-500/30 transition" title="Edit">
                            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                            </svg>
                        </button>
                        <button onclick="deleteIndicator('${ind.indicator_id}')" class="px-1.5 py-0.5 bg-slate-800 hover:bg-rose-500/20 text-slate-300 hover:text-rose-400 text-[9px] rounded border border-slate-700 hover:border-rose-500/30 transition" title="Delete">
                            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                            </svg>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}

function openIndicatorModal() {
    document.getElementById('indicatorForm').reset();
    document.getElementById('indicatorId').value = '';
    document.getElementById('indicatorModalTitle').textContent = 'Add Indicator';
    
    // Populate category dropdown
    const categorySelect = document.getElementById('indicatorCategory');
    categorySelect.innerHTML = '<option value="">Select category...</option>';
    allCategories.forEach(cat => {
        categorySelect.innerHTML += `<option value="${cat.category_id}">${cat.name}</option>`;
    });
    
    document.getElementById('indicatorModal').classList.remove('hidden');
}

function editIndicator(indicatorId) {
    const ind = allIndicators.find(i => i.indicator_id === indicatorId);
    if (!ind) return;

    document.getElementById('indicatorId').value = ind.id || '';
    document.getElementById('indicator_id').value = ind.indicator_id;
    document.getElementById('indicatorName').value = ind.name;
    
    // Populate and select category
    const categorySelect = document.getElementById('indicatorCategory');
    categorySelect.innerHTML = '<option value="">Select category...</option>';
    allCategories.forEach(cat => {
        categorySelect.innerHTML += `<option value="${cat.category_id}" ${cat.category_id === ind.category_id ? 'selected' : ''}>${cat.name}</option>`;
    });
    
    document.getElementById('indicatorType').value = ind.type || 'HUMAN';
    document.getElementById('indicatorValue').value = ind.value;
    document.getElementById('indicatorStatus').value = ind.status;
    document.getElementById('indicatorGate').checked = ind.is_gate == 1;
    document.getElementById('indicatorModalTitle').textContent = 'Edit Indicator';
    document.getElementById('indicatorModal').classList.remove('hidden');
}

async function deleteIndicator(indicatorId) {
    if (!confirm(`Are you sure you want to delete indicator "${indicatorId}"?`)) {
        return;
    }

    try {
        const response = await fetch(`/api/rubric-admin/indicators/${indicatorId}`, {
            method: 'DELETE',
            credentials: 'include'
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Failed to delete indicator');
        }

        alert('Indicator deleted successfully!');
        await loadIndicators();
    } catch (err) {
        alert('Error: ' + err.message);
    }
}

document.getElementById('indicatorForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const id = document.getElementById('indicatorId').value;
    const indicator_id = document.getElementById('indicator_id').value;
    const name = document.getElementById('indicatorName').value;
    const category_id = document.getElementById('indicatorCategory').value;
    const type = document.getElementById('indicatorType').value;
    const value = parseFloat(document.getElementById('indicatorValue').value) || 1;
    const status = document.getElementById('indicatorStatus').value;
    const is_gate = document.getElementById('indicatorGate').checked ? 1 : 0;

    try {
        const url = id ? `/api/rubric-admin/indicators/${id}` : '/api/rubric-admin/indicators';
        const method = id ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ indicator_id, category_id, name, type, value, status, is_gate })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Failed to save indicator');
        }

        closeIndicatorModal();
        await loadIndicators();
    } catch (err) {
        alert('Error: ' + err.message);
    }
});

// ─── Refresh & Init ───────────────────────────────────────────────────────────

async function refreshData() {
    await Promise.all([
        loadCategories(),
        loadIndicators()
    ]);
}

async function init() {
    await refreshData();
}

document.addEventListener('DOMContentLoaded', init);