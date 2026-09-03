/**
 * public/js/super_admin/people/manage-rubrics.js
 */

let allCategories = [];
let allIndicators = [];
let catTable = null;
let indTable = null;

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
        const response = await fetch('/api/super_admin/people/manage-rubrics/categories', { credentials: 'include' });
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
        const response = await fetch('/api/super_admin/people/manage-rubrics/indicators', { credentials: 'include' });
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
    const activeItems = [
        ...allCategories.filter(c => c.status === 'active'),
        ...allIndicators.filter(i => i.status === 'active')
    ].length;
    const inactiveItems = totalCategories + totalIndicators - activeItems;

    document.getElementById('totalCategories').textContent = totalCategories;
    document.getElementById('totalIndicators').textContent = totalIndicators;
    document.getElementById('activeItems').textContent = activeItems;
    document.getElementById('inactiveItems').textContent = inactiveItems;
}

// ─── Categories Table (centralized createTable) ───────────────────────────────

const EDIT_ICON = '<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>';
const DELETE_ICON = '<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>';

function statusBadge(status) {
    const active = status === 'active';
    return active
        ? '<span class="inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 text-emerald-700 border border-emerald-200">Active</span>'
        : '<span class="inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-700 border border-amber-200">Inactive</span>';
}

function renderCategories() {
    const container = document.getElementById('categoriesTableContainer');
    if (!container) return;

    const rows = allCategories.map(cat => ({
        id: cat.category_id,
        category_id: cat.category_id,
        name: cat.name,
        weight: cat.weight,
        status: cat.status
    }));

    if (!catTable) {
        catTable = createTable({
            containerId: 'categoriesTableContainer',
            searchable: true,
            pagination: true,
            exportable: true,
            exportFilename: 'rubric-categories',
            emptyMessage: 'No categories found',
            headers: [
                { label: 'ID', key: 'category_id', width: '18%', render: (val) => '<span class="text-violet-700 text-xs font-mono">' + escHtml(val) + '</span>' },
                { label: 'Name', key: 'name', width: '34%', render: (val) => '<span class="text-violet-950 text-xs font-semibold">' + escHtml(val) + '</span>' },
                { label: 'Weight', key: 'weight', width: '12%', align: 'right', render: (val) => '<span class="text-violet-900 text-xs">' + (val || 0) + '%</span>' },
                { label: 'Status', key: 'status', width: '16%', render: (val) => statusBadge(val) },
                { label: 'Actions', key: 'category_id', width: '20%', align: 'right', render: (val) => {
                    return '<div class="flex gap-1 justify-end">' +
                        '<button onclick="editCategory(\'' + escHtml(val) + '\')" class="px-1.5 py-0.5 bg-white hover:bg-violet-50 text-violet-700 text-[9px] rounded border border-slate-300 hover:border-violet-300 transition" title="Edit">' + EDIT_ICON + '</button>' +
                        '<button onclick="deleteCategory(\'' + escHtml(val) + '\')" class="px-1.5 py-0.5 bg-white hover:bg-rose-50 text-rose-600 text-[9px] rounded border border-slate-300 hover:border-rose-300 transition" title="Delete">' + DELETE_ICON + '</button>' +
                        '</div>';
                } }
            ]
        });
    }

    catTable.setData(rows);
}

// ─── Indicators Table (centralized createTable) ───────────────────────────────

function renderIndicators() {
    const container = document.getElementById('indicatorsTableContainer');
    if (!container) return;

    const rows = allIndicators.map(ind => ({
        indicator_id: ind.indicator_id,
        name: ind.name,
        category: ind.category_name || ind.category_id || 'N/A',
        type: ind.type || 'HUMAN',
        value: ind.value,
        status: ind.status
    }));

    if (!indTable) {
        indTable = createTable({
            containerId: 'indicatorsTableContainer',
            searchable: true,
            pagination: true,
            exportable: true,
            exportFilename: 'rubric-indicators',
            emptyMessage: 'No indicators found',
            headers: [
                { label: 'ID', key: 'indicator_id', width: '14%', render: (val) => '<span class="text-cyan-700 text-xs font-mono">' + escHtml(val) + '</span>' },
                { label: 'Name', key: 'name', width: '26%', render: (val) => '<span class="text-cyan-950 text-xs font-semibold">' + escHtml(val) + '</span>' },
                { label: 'Category', key: 'category', width: '16%', render: (val) => '<span class="text-cyan-900 text-xs">' + escHtml(val) + '</span>' },
                { label: 'Type', key: 'type', width: '10%', render: (val) => '<span class="inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 text-blue-700 border border-blue-200">' + escHtml(val) + '</span>' },
                { label: 'Value', key: 'value', width: '10%', align: 'right', render: (val) => '<span class="text-cyan-900 text-xs">' + (val || 1) + '</span>' },
                { label: 'Status', key: 'status', width: '12%', render: (val) => statusBadge(val) },
                { label: 'Actions', key: 'indicator_id', width: '12%', align: 'right', render: (val) => {
                    return '<div class="flex gap-1 justify-end">' +
                        '<button onclick="editIndicator(\'' + escHtml(val) + '\')" class="px-1.5 py-0.5 bg-white hover:bg-cyan-50 text-cyan-700 text-[9px] rounded border border-slate-300 hover:border-cyan-300 transition" title="Edit">' + EDIT_ICON + '</button>' +
                        '<button onclick="deleteIndicator(\'' + escHtml(val) + '\')" class="px-1.5 py-0.5 bg-white hover:bg-rose-50 text-rose-600 text-[9px] rounded border border-slate-300 hover:border-rose-300 transition" title="Delete">' + DELETE_ICON + '</button>' +
                        '</div>';
                } }
            ]
        });
    }

    indTable.setData(rows);
}


// ─── Categories CRUD ──────────────────────────────────────────────────────────

function openCategoryModal() {
    document.getElementById('categoryForm').reset();
    document.getElementById('categoryId').value = '';
    document.getElementById('categoryModalTitle').textContent = 'Add Category';
    document.getElementById('categoryModal').classList.remove('hidden');
}

window.openCategoryModal = openCategoryModal;

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

window.editCategory = editCategory;

async function deleteCategory(categoryId) {
    if (!confirm(`Are you sure you want to delete category "${categoryId}"?`)) return;
    try {
        const response = await fetch(`/api/super_admin/people/manage-rubrics/categories/${categoryId}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Failed to delete category');
        }
        showToast('Category deleted successfully!', 'info');
        await loadCategories();
        await loadIndicators();
    } catch (err) {
        alert('Error: ' + err.message);
    }
}

window.deleteCategory = deleteCategory;

document.getElementById('categoryForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('categoryId').value;
    const payload = {
        category_id: document.getElementById('category_id').value || 'CAT_' + Date.now(),
        name: document.getElementById('categoryName').value,
        weight: parseFloat(document.getElementById('categoryWeight').value) || 0,
        status: document.getElementById('categoryStatus').value
    };
    try {
        const url = id
            ? `/api/super_admin/people/manage-rubrics/categories/${id}`
            : '/api/super_admin/people/manage-rubrics/categories';
        const method = id ? 'PUT' : 'POST';
        const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(payload)
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

function openIndicatorModal() {
    document.getElementById('indicatorForm').reset();
    document.getElementById('indicatorId').value = '';
    document.getElementById('indicatorModalTitle').textContent = 'Add Indicator';

    const categorySelect = document.getElementById('indicatorCategory');
    categorySelect.innerHTML = '<option value="">Select category...</option>';
    allCategories.forEach(cat => {
        categorySelect.innerHTML += `<option value="${escHtml(cat.category_id)}">${escHtml(cat.name)}</option>`;
    });

    document.getElementById('indicatorModal').classList.remove('hidden');
}

window.openIndicatorModal = openIndicatorModal;

function editIndicator(indicatorId) {
    const ind = allIndicators.find(i => i.indicator_id === indicatorId);
    if (!ind) return;

    document.getElementById('indicatorId').value = ind.id || '';
    document.getElementById('indicator_id').value = ind.indicator_id;
    document.getElementById('indicatorName').value = ind.name;

    const categorySelect = document.getElementById('indicatorCategory');
    categorySelect.innerHTML = '<option value="">Select category...</option>';
    allCategories.forEach(cat => {
        categorySelect.innerHTML += `<option value="${escHtml(cat.category_id)}" ${cat.category_id === ind.category_id ? 'selected' : ''}>${escHtml(cat.name)}</option>`;
    });

    document.getElementById('indicatorType').value = ind.type || 'HUMAN';
    document.getElementById('indicatorValue').value = ind.value;
    document.getElementById('indicatorStatus').value = ind.status;
    document.getElementById('indicatorGate').checked = ind.is_gate == 1;
    document.getElementById('indicatorModalTitle').textContent = 'Edit Indicator';
    document.getElementById('indicatorModal').classList.remove('hidden');
}

window.editIndicator = editIndicator;

async function deleteIndicator(indicatorId) {
    if (!confirm(`Are you sure you want to delete indicator "${indicatorId}"?`)) return;
    try {
        const response = await fetch(`/api/super_admin/people/manage-rubrics/indicators/${indicatorId}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Failed to delete indicator');
        }
        showToast('Indicator deleted successfully!', 'info');
        await loadIndicators();
    } catch (err) {
        alert('Error: ' + err.message);
    }
}

window.deleteIndicator = deleteIndicator;

document.getElementById('indicatorForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('indicatorId').value;
    const payload = {
        indicator_id: document.getElementById('indicator_id').value || 'IND_' + Date.now(),
        name: document.getElementById('indicatorName').value,
        category_id: document.getElementById('indicatorCategory').value,
        type: document.getElementById('indicatorType').value,
        value: parseFloat(document.getElementById('indicatorValue').value) || 1,
        status: document.getElementById('indicatorStatus').value,
        is_gate: document.getElementById('indicatorGate').checked ? 1 : 0
    };
    try {
        const url = id
            ? `/api/super_admin/people/manage-rubrics/indicators/${id}`
            : '/api/super_admin/people/manage-rubrics/indicators';
        const method = id ? 'PUT' : 'POST';
        const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(payload)
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

// ─── Init ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
    await Promise.all([loadCategories(), loadIndicators()]);
});
