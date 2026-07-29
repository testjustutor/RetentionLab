/**
 * public/js/admin/rubrics.js
 * Frontend logic for admin rubric management
 */

(function() {
  'use strict';

  // State
  let masterCategories = [];
  let masterIndicators = [];
  let adminCategories = [];
  let adminIndicators = [];
  let assignedCategoryIds = [];
  let selectedCategories = new Set();
  let selectedIndicators = new Set();
  let currentUserId = null;

  // DOM Elements
  const tabMyRubrics = document.getElementById('tab-my-rubrics');
  const tabMaster = document.getElementById('tab-master');
  const tabCreate = document.getElementById('tab-create');
  const myRubricsTab = document.getElementById('my-rubrics-tab');
  const masterTab = document.getElementById('master-tab');
  const createTab = document.getElementById('create-tab');
  const rubricsRoot = document.getElementById('rubricsRoot');
  const copySelectedBtn = document.getElementById('copy-selected-btn');
  const masterCategoriesTable = document.getElementById('master-categories-table');
  const masterIndicatorsTable = document.getElementById('master-indicators-table');
  const createCategoryForm = document.getElementById('create-category-form');
  const createIndicatorForm = document.getElementById('create-indicator-form');
  const indicatorCategorySelect = document.getElementById('indicator-category');

  // Initialize page
  async function init() {
    await loadComponents();
    await loadCurrentUser();
    setupEventListeners();
  }

  // Load sidebar and header components
  async function loadComponents() {
    const sidebarPlaceholder = document.getElementById('sidebar-placeholder');
    const headerPlaceholder = document.getElementById('header-placeholder');

    if (sidebarPlaceholder) {
      try {
        const response = await fetch('/sidebar.html');
        const html = await response.text();
        sidebarPlaceholder.innerHTML = html;
      } catch (err) {
        console.error('Failed to load sidebar:', err);
      }
    }

    if (headerPlaceholder) {
      try {
        const response = await fetch('/header.html');
        const html = await response.text();
        headerPlaceholder.innerHTML = html;
      } catch (err) {
        console.error('Failed to load header:', err);
      }
    }
  }

  // Load current user
  async function loadCurrentUser() {
    try {
      const { fetchCurrentUser } = await import('../../js/auth.js');
      const user = await fetchCurrentUser();
      currentUserId = user.id;
      await loadMyRubrics();
    } catch (err) {
      console.error('Failed to load user:', err);
      rubricsRoot.innerHTML = '<p class="text-red-400">Auth failed: ' + escHtml(err.message) + '</p>';
    }
  }

  // Load my rubrics
  async function loadMyRubrics() {
    try {
      const rubric = await apiFetch('/api/rubrics/admin/' + currentUserId);
      const cats = rubric.categories || [];
      const inds = rubric.indicators || [];

      if (!cats.length) {
        rubricsRoot.innerHTML = '<p class="text-slate-500 text-center py-16">No rubric assigned yet. Copy from master or create your own.</p>';
        return;
      }

      let html = '<div class="space-y-3">';
      cats.forEach(function(c, i) {
        const cId = c.original_category_id;
        const cItems = inds.filter(function(x) { return x.original_category_id === cId; });
        const totalVal = cItems.reduce(function(s, x) { return s + (+x.value || 0); }, 0);
        const colors = ['violet', 'emerald', 'amber', 'rose', 'sky', 'indigo', 'teal', 'cyan'];
        const color = colors[i % colors.length];
        const sourceBadge = c.source === 'custom' ? '<span class="badge badge-warning text-[10px] ml-1">Custom</span>' : '';

        html += '<div class="rounded-lg border border-slate-800 bg-slate-900 overflow-hidden">' +
          '<div class="flex items-center justify-between px-3 py-2 border-b border-slate-800 bg-' + color + '-500/5">' +
            '<div class="flex items-center gap-2">' +
              '<span class="w-7 h-7 rounded-md bg-' + color + '-500/10 border border-' + color + '-500/20 flex items-center justify-center text-' + color + '-400 font-bold text-[12px]">' + (i + 1) + '</span>' +
              '<div><p class="text-xs font-semibold">' + escHtml(c.name) + sourceBadge + '</p><p class="text-[12px] text-slate-500">' + cItems.length + ' indicator' + (cItems.length !== 1 ? 's' : '') + '</p></div>' +
            '</div>' +
            '<div class="flex items-center gap-1.5">' +
              '<span class="text-[12px] text-slate-400">Wt:</span>' +
              '<input type="number" step="0.1" min="0" max="100" value="' + (+c.weight || 0) + '" data-cat="' + cId + '" class="w-14 bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-[12px] text-center cat-weight focus:border-violet-500 outline-none" oninput="markDirty()">' +
            '</div>' +
          '</div>';

        if (cItems.length) {
          html += '<div class="overflow-x-auto"><table class="w-full text-left text-xs"><thead><tr class="border-b border-slate-800 text-[12px] text-slate-500 uppercase tracking-wider">' +
            '<th class="py-2 px-3">Indicator</th>' +
            '<th class="py-2 px-3 w-16">Type</th>' +
            '<th class="py-2 px-3 w-12 text-center">Gate</th>' +
            '<th class="py-2 px-3 w-16 text-center">Value</th>' +
            '<th class="py-2 px-3 w-20 text-right">Wt %</th>' +
          '</tr></thead><tbody class="divide-y divide-slate-800/50">';
          cItems.forEach(function(ind) {
            const pct = totalVal > 0 ? ((+ind.value || 0) / totalVal * 100).toFixed(1) : '0.0';
            const typeColor = ind.type === 'AI' ? 'bg-violet-500/10 text-violet-400' : 'bg-emerald-500/10 text-emerald-400';
            html += '<tr class="hover:bg-slate-800/30">' +
              '<td class="py-2 px-3">' + escHtml(ind.name) + '</td>' +
              '<td class="py-2 px-3"><span class="text-[12px] px-1.5 py-0.5 rounded ' + typeColor + '">' + (ind.type || 'HUMAN') + '</span></td>' +
              '<td class="py-2 px-3 text-center">' + (ind.is_gate ? '<span class="text-emerald-400 font-bold">&#x2713;</span>' : '<span class="text-slate-600">--</span>') + '</td>' +
              '<td class="py-2 px-3 text-center"><input type="number" step="0.1" min="0" value="' + (+ind.value || 1) + '" data-ind="' + ind.original_indicator_id + '" class="w-14 bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-[12px] text-center ind-value focus:border-violet-500 outline-none" oninput="markDirty()"></td>' +
              '<td class="py-2 px-3 text-right text-slate-500">' + pct + '%</td>' +
            '</tr>';
          });
          html += '</tbody></table></div>';
        }
        html += '</div>';
      });
      html += '</div>';
      html += '<div class="flex justify-end mt-4 gap-2">' +
        '<button onclick="resetRubric()" class="px-3 py-1.5 rounded-md bg-slate-800 border border-slate-700 text-xs text-white hover:text-slate-900 transition-colors">Reset</button>' +
        '<button onclick="saveRubric()" class="px-4 py-1.5 rounded-md bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold transition-colors">Save</button>' +
      '</div>';
      rubricsRoot.innerHTML = html;
    } catch (err) {
      rubricsRoot.innerHTML = '<p class="text-red-400">Failed to load rubric: ' + escHtml(err.message) + '</p>';
    }
  }

  // Load master data
  async function loadMasterData() {
    try {
      const [categoriesRes, indicatorsRes, assignedRes] = await Promise.all([
        fetch('/api/rubrics/master-categories', { credentials: 'include' }),
        fetch('/api/rubrics/master-indicators', { credentials: 'include' }),
        fetch('/api/rubrics/admin/' + currentUserId + '/assigned-ids', { credentials: 'include' })
      ]);

      const categoriesData = await categoriesRes.json();
      const indicatorsData = await indicatorsRes.json();
      const assignedData = await assignedRes.json();

      if (categoriesData.success) {
        masterCategories = categoriesData.categories || [];
      }
      if (indicatorsData.success) {
        masterIndicators = indicatorsData.indicators || [];
      }
      if (assignedData.success) {
        assignedCategoryIds = assignedData.assignedIds || [];
      }

      renderMasterCategories();
      renderMasterIndicators();
    } catch (err) {
      console.error('Failed to load master data:', err);
    }
  }

  // Render master categories
  function renderMasterCategories() {
    if (masterCategories.length === 0) {
      masterCategoriesTable.innerHTML = '<tr><td colspan="6" class="text-center py-8 text-slate-500">No master categories found.</td></tr>';
      return;
    }

    const availableCats = masterCategories.filter(function(c) { return !assignedCategoryIds.includes(c.category_id); });
    const allSelected = availableCats.length > 0 && selectedCategories.size === availableCats.length;

    masterCategoriesTable.innerHTML = '<tr><td colspan="6" class="py-2 px-3 border-b border-slate-200">' +
      '<label class="flex items-center gap-2 cursor-pointer">' +
      '<input type="checkbox" id="select-all-categories" ' + (allSelected ? 'checked' : '') + '> ' +
      '<span class="text-sm font-medium text-slate-700">Select All (' + availableCats.length + ' available)</span></label></td></tr>' +
      masterCategories.map(function(cat) {
        const isAssigned = assignedCategoryIds.includes(cat.category_id);
        const isChecked = selectedCategories.has(cat.category_id);
        return '<tr class="' + (isAssigned ? 'opacity-50' : 'hover:bg-slate-100') + '">' +
          '<td><input type="checkbox" class="master-category-checkbox" value="' + cat.category_id + '" ' + (isChecked ? 'checked' : '') + (isAssigned ? ' disabled' : '') + '></td>' +
          '<td class="font-mono text-sm">' + escHtml(cat.category_id) + '</td>' +
          '<td class="font-medium text-slate-900">' + escHtml(cat.name) + '</td>' +
          '<td>' + cat.weight + '</td>' +
          '<td><span class="badge badge-info">' + masterIndicators.filter(function(i) { return i.category_id === cat.category_id; }).length + '</span></td>' +
          '<td>' + (isAssigned ? '<span class="badge badge-success text-[10px]">Already Copied</span>' : '') + '</td>' +
        '</tr>';
      }).join('');
  }

  // Render master indicators
  function renderMasterIndicators() {
    if (masterIndicators.length === 0) {
      masterIndicatorsTable.innerHTML = '<tr><td colspan="7" class="text-center py-8 text-slate-500">No master indicators found.</td></tr>';
      return;
    }

    const availableInds = masterIndicators.filter(function(i) { return !assignedCategoryIds.includes(i.category_id); });
    const allSelected = availableInds.length > 0 && selectedIndicators.size === availableInds.length;

    masterIndicatorsTable.innerHTML = '<tr><td colspan="7" class="py-2 px-3 border-b border-slate-200">' +
      '<label class="flex items-center gap-2 cursor-pointer">' +
      '<input type="checkbox" id="select-all-indicators" ' + (allSelected ? 'checked' : '') + '> ' +
      '<span class="text-sm font-medium text-slate-700">Select All (' + availableInds.length + ' available)</span></label></td></tr>' +
      masterIndicators.map(function(ind) {
        const category = masterCategories.find(function(c) { return c.category_id === ind.category_id; });
        const isAssigned = assignedCategoryIds.includes(ind.category_id);
        const isChecked = selectedIndicators.has(ind.indicator_id);
        return '<tr class="' + (isAssigned ? 'opacity-50' : 'hover:bg-slate-100') + '">' +
          '<td><input type="checkbox" class="master-indicator-checkbox" value="' + ind.indicator_id + '" ' + (isChecked ? 'checked' : '') + (isAssigned ? ' disabled' : '') + ' data-category="' + ind.category_id + '"></td>' +
          '<td class="font-mono text-sm">' + escHtml(ind.indicator_id) + '</td>' +
          '<td>' + (category ? escHtml(category.name) : escHtml(ind.category_id)) + '</td>' +
          '<td class="font-medium text-slate-900">' + escHtml(ind.name) + '</td>' +
          '<td><span class="badge badge-' + (ind.type === 'AI' ? 'warning' : 'secondary') + '">' + ind.type + '</span></td>' +
          '<td>' + (ind.is_gate ? '<span class="badge badge-danger">Yes</span>' : 'No') + '</td>' +
          '<td>' + ind.value + '</td>' +
        '</tr>';
      }).join('');
  }

  // Setup event listeners
  function setupEventListeners() {
    tabMyRubrics.addEventListener('click', function() { switchTab('my-rubrics'); });
    tabMaster.addEventListener('click', async function() {
      switchTab('master');
      selectedCategories.clear();
      selectedIndicators.clear();
      await loadMasterData();
    });
    tabCreate.addEventListener('click', function() { switchTab('create'); });

    // Category checkboxes (delegated)
    masterCategoriesTable.addEventListener('change', function(e) {
      if (e.target.classList.contains('master-category-checkbox')) {
        const value = e.target.value;
        if (e.target.checked) {
          selectedCategories.add(value);
        } else {
          selectedCategories.delete(value);
        }
        updateCopyButton();
        updateSelectAllState('categories');
      }
      if (e.target.id === 'select-all-categories') {
        toggleSelectAll('categories', e.target.checked);
      }
    });

    // Indicator checkboxes (delegated)
    masterIndicatorsTable.addEventListener('change', function(e) {
      if (e.target.classList.contains('master-indicator-checkbox')) {
        const value = e.target.value;
        if (e.target.checked) {
          selectedIndicators.add(value);
        } else {
          selectedIndicators.delete(value);
        }
        updateSelectAllState('indicators');
      }
      if (e.target.id === 'select-all-indicators') {
        toggleSelectAll('indicators', e.target.checked);
      }
    });

    copySelectedBtn.addEventListener('click', copySelectedCategories);
    createCategoryForm.addEventListener('submit', handleCreateCategory);
    createIndicatorForm.addEventListener('submit', handleCreateIndicator);
  }

  // Toggle select all
  function toggleSelectAll(type, checked) {
    if (type === 'categories') {
      masterCategories.forEach(function(cat) {
        if (!assignedCategoryIds.includes(cat.category_id)) {
          if (checked) selectedCategories.add(cat.category_id);
          else selectedCategories.delete(cat.category_id);
        }
      });
      document.querySelectorAll('.master-category-checkbox:not(:disabled)').forEach(function(cb) { cb.checked = checked; });
    } else if (type === 'indicators') {
      masterIndicators.forEach(function(ind) {
        if (!assignedCategoryIds.includes(ind.category_id)) {
          if (checked) selectedIndicators.add(ind.indicator_id);
          else selectedIndicators.delete(ind.indicator_id);
        }
      });
      document.querySelectorAll('.master-indicator-checkbox:not(:disabled)').forEach(function(cb) { cb.checked = checked; });
    }
    updateCopyButton();
  }

  // Update select all checkbox state
  function updateSelectAllState(type) {
    if (type === 'categories') {
      const el = document.getElementById('select-all-categories');
      if (el) {
        const avail = masterCategories.filter(function(c) { return !assignedCategoryIds.includes(c.category_id); });
        el.checked = avail.length > 0 && selectedCategories.size === avail.length;
      }
    } else if (type === 'indicators') {
      const el = document.getElementById('select-all-indicators');
      if (el) {
        const avail = masterIndicators.filter(function(i) { return !assignedCategoryIds.includes(i.category_id); });
        el.checked = avail.length > 0 && selectedIndicators.size === avail.length;
      }
    }
  }

  // Switch tab
  function switchTab(tabName) {
    [tabMyRubrics, tabMaster, tabCreate].forEach(function(btn) { btn.classList.remove('active'); });
    document.querySelector('[data-tab="' + tabName + '"]').classList.add('active');
    [myRubricsTab, masterTab, createTab].forEach(function(content) { content.classList.add('hidden'); });
    document.getElementById(tabName + '-tab').classList.remove('hidden');
  }

  // Update copy button state
  function updateCopyButton() {
    copySelectedBtn.disabled = selectedCategories.size === 0;
  }

  // Copy selected categories
  async function copySelectedCategories() {
    if (selectedCategories.size === 0) return;
    try {
      const response = await fetch('/api/rubrics/admin/' + currentUserId + '/copy-from-master', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ categoryIds: Array.from(selectedCategories) })
      });
      const data = await response.json();
      if (data.success) {
        showToast(data.message || 'Categories copied successfully');
        selectedCategories.clear();
        selectedIndicators.clear();
        updateCopyButton();
        await loadMasterData();
        switchTab('my-rubrics');
        await loadMyRubrics();
      } else {
        showToast(data.error || 'Failed to copy categories', true);
      }
    } catch (err) {
      showToast('Failed to copy categories', true);
    }
  }

  // Handle create category
  async function handleCreateCategory(e) {
    e.preventDefault();
    const name = document.getElementById('category-name').value;
    const weight = document.getElementById('category-weight').value;
    try {
      const response = await fetch('/api/rubrics/admin/' + currentUserId + '/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: name, weight: weight })
      });
      const data = await response.json();
      if (data.success) {
        showToast('Category created successfully');
        createCategoryForm.reset();
        switchTab('my-rubrics');
        await loadMyRubrics();
      } else {
        showToast(data.error || 'Failed to create category', true);
      }
    } catch (err) {
      showToast('Failed to create category', true);
    }
  }

  // Handle create indicator
  async function handleCreateIndicator(e) {
    e.preventDefault();
    const category_id = document.getElementById('indicator-category').value;
    const name = document.getElementById('indicator-name').value;
    const type = document.getElementById('indicator-type').value;
    const is_gate = document.getElementById('indicator-gate').value;
    const value = document.getElementById('indicator-value').value;
    const description = document.getElementById('indicator-description').value;
    if (!category_id) { showToast('Please select a category', true); return; }
    try {
      const response = await fetch('/api/rubrics/admin/' + currentUserId + '/indicators', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ category_id: category_id, name: name, type: type, is_gate: is_gate, value: value, description: description })
      });
      const data = await response.json();
      if (data.success) {
        showToast('Indicator created successfully');
        createIndicatorForm.reset();
        switchTab('my-rubrics');
        await loadMyRubrics();
      } else {
        showToast(data.error || 'Failed to create indicator', true);
      }
    } catch (err) {
      showToast('Failed to create indicator', true);
    }
  }

  // Save rubric
  window.saveRubric = async function() {
    const catEls = rubricsRoot.querySelectorAll('.cat-weight');
    const indEls = rubricsRoot.querySelectorAll('.ind-value');
    const catChanges = [], indChanges = [];
    catEls.forEach(function(el) {
      catChanges.push({ original_category_id: el.getAttribute('data-cat'), weight: parseFloat(el.value) || 0 });
    });
    indEls.forEach(function(el) {
      indChanges.push({ original_indicator_id: el.getAttribute('data-ind'), value: parseFloat(el.value) || 0 });
    });
    if (!catChanges.length && !indChanges.length) { showToast('No changes'); return; }
    try {
      await apiFetch('/api/rubrics/admin/' + currentUserId + '/bulk', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categories: catChanges, indicators: indChanges })
      });
      showToast('Rubric saved');
      document.getElementById('saveStatus').textContent = '';
      await loadMyRubrics();
    } catch (e) { showToast(e.message, true); }
  };

  window.resetRubric = function() { location.reload(); };
  window.markDirty = function() {
    document.getElementById('saveStatus').textContent = '(unsaved changes)';
    document.getElementById('saveStatus').classList.add('text-amber-400');
  };

  function escHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();