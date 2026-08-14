/**
 * public/js/common-ui.js
 * Shared UI utilities: modal open/close, toast notifications, escape-html.
 * Include this after tailwind in HTML pages that need modals/toasts.
 */

// ── Toast ──
function showToast(msg, isErr) {
  let toast = document.getElementById('commonToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'commonToast';
    toast.className = 'hidden fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl text-white text-sm font-medium shadow-lg flex items-center gap-2 transition-all duration-300';
    toast.innerHTML = '<svg class="w-4 h-4 toast-icon" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"></svg><span class="toast-msg"></span>';
    document.body.appendChild(toast);
  }
  const icon = toast.querySelector('.toast-icon');
  const span = toast.querySelector('.toast-msg');
  span.textContent = msg;
  toast.className = 'fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl text-white text-sm font-medium shadow-lg flex items-center gap-2 transition-all duration-300 ' + (isErr ? 'bg-red-600' : 'bg-emerald-600');
  icon.className = 'w-4 h-4 toast-icon';
  icon.innerHTML = isErr
    ? '<circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/><line x1="15" y1="9" x2="9" y2="15" stroke="currentColor" stroke-width="2"/><line x1="9" y1="9" x2="15" y2="15" stroke="currentColor" stroke-width="2"/>'
    : '<path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>';
  toast.classList.remove('hidden');
  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => toast.classList.add('hidden'), 3000);
}

// ── Modal ──
function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.remove('hidden');
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) { modal.classList.add('hidden'); }
}

function setupModal(id, openBtnId, closeBtnIds) {
  const modal = document.getElementById(id);
  if (!modal) return;
  if (openBtnId) {
    const openBtn = document.getElementById(openBtnId);
    if (openBtn) openBtn.addEventListener('click', () => openModal(id));
  }
  if (closeBtnIds) {
    closeBtnIds.forEach(cid => {
      const btn = document.getElementById(cid);
      if (btn) btn.addEventListener('click', () => closeModal(id));
    });
  }
}

// ── Escape HTML ──
function escHtml(str) {
  if (!str) return '';
  const d = document.createElement('div');
  d.textContent = String(str);
  return d.innerHTML;
}

// ── Pagination Service (lightweight, no HTML rendering) ──
// Options:
//   containerId: ID of the pagination container element
//   currentPage: current page number
//   totalPages: total number of pages
//   onPageChange: callback when page changes (receives page number)
// Returns: { render(), setPage(), getPage() }
function createPagination(options = {}) {
  const { containerId, currentPage = 1, totalPages = 1, onPageChange } = options;
  const container = document.getElementById(containerId);
  if (!container) {
    console.error('Pagination container not found:', containerId);
    return null;
  }

  let current = currentPage;
  let total = totalPages;

  function generatePageNumbers(current, total) {
    const pages = [];
    
    if (total <= 7) {
      for (let i = 1; i <= total; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);
      
      if (current > 3) {
        pages.push('...');
      }
      
      const start = Math.max(2, current - 1);
      const end = Math.min(total - 1, current + 1);
      
      for (let i = start; i <= end; i++) {
        if (!pages.includes(i)) {
          pages.push(i);
        }
      }
      
      if (current < total - 2) {
        pages.push('...');
      }
      
      if (!pages.includes(total)) {
        pages.push(total);
      }
    }
    
    return pages;
  }

  function render() {
    if (total <= 1) {
      container.innerHTML = '';
      return;
    }

    const pageNumbers = generatePageNumbers(current, total);

    // All controls in one horizontal flex row so they align cleanly
    let html = '<div class="flex items-center gap-2 flex-wrap">';

    // Previous button - darkest grey when enabled, light grey when disabled
    html += '<button class="px-3 py-1.5 rounded-md text-xs font-medium transition-colors ' + (current <= 1 ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-slate-900 text-white hover:bg-slate-800') + '" ' + (current <= 1 ? 'disabled' : '') + '>Previous</button>';

    html += '<div class="flex items-center gap-1">';
    for (const page of pageNumbers) {
      if (page === '...') {
        html += '<span class="px-2 py-1 text-xs text-slate-500">...</span>';
      } else {
        const isActive = page === current;
        html += '<button data-page="' + page + '" class="px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ' + (isActive ? 'bg-violet-600 text-white' : 'bg-white border border-slate-300 text-slate-600 hover:bg-violet-50 hover:text-violet-600 hover:border-violet-300') + '">' + page + '</button>';
      }
    }
    html += '</div>';

    // Next button - darkest grey when enabled, light grey when disabled
    html += '<button class="px-3 py-1.5 rounded-md text-xs font-medium transition-colors ' + (current >= total ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-slate-900 text-white hover:bg-slate-800') + '" ' + (current >= total ? 'disabled' : '') + '>Next</button>';

    html += '</div>';
    container.innerHTML = html;

    const buttons = container.querySelectorAll('button[data-page]');
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        const page = parseInt(btn.getAttribute('data-page'));
        if (page !== current) {
          current = page;
          render();
          if (onPageChange) onPageChange(page);
        }
      });
    });

    const prevBtn = container.querySelector('button:not([data-page]):first-child');
    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        if (current > 1) {
          current--;
          render();
          if (onPageChange) onPageChange(current);
        }
      });
    }

    const nextBtn = container.querySelector('button:not([data-page]):last-child');
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        if (current < total) {
          current++;
          render();
          if (onPageChange) onPageChange(current);
        }
      });
    }
  }

  return {
    render,
    setPage: (page) => {
      current = page;
      render();
    },
    setTotalPages: (newTotal) => {
      total = newTotal;
      if (current > total) current = total;
      render();
    },
    getPage: () => current
  };
}

// ── Unified Table Component ──
// Options:
//   containerId: ID of the container to render the table into
//   headers: Array of { label: string, key: string, width?: string, render?: (value, row) => string }
//   data: Array of objects (rows)
//   onRowClick: (row) => void - callback when row is clicked
//   emptyMessage: string - message when no data (default: "No data found")
//   loading: boolean - show loading spinner
//   pagination: { perPage: number, currentPage: number, onPageChange: (page) => void }
//   searchable: boolean - show a search box in the table header (default: true)
//   searchPlaceholder: string - placeholder text for the search box
//   pageSizeOptions: array - options for the "entries per page" dropdown (default: [10, 20, 50, 100, 200, 'All'])
//   exportable: boolean - show an "Export Excel" button in the header (default: true)
//   exportFilename: string - base name for the downloaded file (default: <containerId>-export)
// Returns: { render(), setData(data), setHeaders(headers), setLoading(bool), getPagination(), destroy() }
function createTable(options = {}) {
  const { containerId, headers = [], data = [], onRowClick, emptyMessage = 'No data found', loading = false, pagination, searchable = true, searchPlaceholder = 'Search...', pageSizeOptions = [10, 20, 50, 100, 200, 'All'], exportable = true, exportFilename = '' } = options;
  const container = document.getElementById(containerId);
  if (!container) {
    console.error('Table container not found:', containerId);
    return null;
  }

  let currentHeaders = headers;
  let currentData = data;
  let isLoading = loading;
  let paginationObj = null;
  let currentPage = pagination?.currentPage || 1;
  let pageSize = pagination?.perPage || 10;   // current "entries per page" selection (number or 'All')
  let searchTerm = '';

  function render() {
    if (isLoading) {
      container.innerHTML = '<div class="bg-white border border-slate-200 rounded-lg overflow-hidden">' +
        '<div class="overflow-x-auto">' +
          '<table class="w-full">' +
            '<thead>' +
              '<tr class="text-[10px] font-bold text-slate-950 uppercase border-b-2 border-slate-300 bg-slate-200">' +
                currentHeaders.map(h => '<th class="py-2 px-3 text-left font-bold tracking-wide' + (h.width ? '" style="width:' + h.width : '') + '">' + (h.label || '') + '</th>').join('') +
              '</tr>' +
            '</thead>' +
            '<tbody>' +
              '<tr><td colspan="' + Math.max(1, currentHeaders.length) + '" class="px-4 py-12">' +
                '<div class="flex items-center justify-center">' +
                  '<div class="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin"></div>' +
                  '<span class="ml-3 text-sm text-slate-500">Loading...</span>' +
                '</div>' +
              '</td></tr>' +
            '</tbody>' +
          '</table>' +
        '</div>' +
      '</div>';
      return;
    }

    // Determine which data to show (search-filtered, then paginated)
    const perPage = pageSize === 'All' ? Number.MAX_SAFE_INTEGER : Number(pageSize);
    let baseData = currentData;
    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      baseData = currentData.filter(function(row) {
        return currentHeaders.some(function(h) {
          const v = row ? row[h.key] : undefined;
          return v !== undefined && v !== null && String(v).toLowerCase().indexOf(q) !== -1;
        });
      });
    }
    let displayData = baseData;
    const totalItems = baseData.length;
    const totalPages = Math.ceil(totalItems / perPage) || 1;

    if (pagination && totalItems > perPage) {
      const start = (currentPage - 1) * perPage;
      const end = start + perPage;
      displayData = baseData.slice(start, end);
    }

    // Build table HTML
    const hasData = displayData.length > 0;
    const headerHtml = '<tr class="text-[10px] font-bold text-slate-950 uppercase border-b-2 border-slate-300 bg-slate-200">' +
      currentHeaders.map(h => '<th class="py-2 px-3 text-left font-bold tracking-wide' + (h.width ? '" style="width:' + h.width : '') + '">' + (h.label || '') + '</th>').join('') +
    '</tr>';

    let bodyHtml = '';
    const emptyMsg = searchTerm.trim() ? ('No results found for "' + searchTerm.trim() + '"') : emptyMessage;
    if (!hasData) {
      bodyHtml = '<tr><td colspan="' + Math.max(1, currentHeaders.length) + '" class="px-4 py-12">' +
        '<div class="flex flex-col items-center justify-center">' +
          '<div class="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-3">' +
            '<svg class="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">' +
              '<path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>' +
            '</svg>' +
          '</div>' +
          '<p class="text-sm font-bold text-slate-800 mb-1">' + escHtml(emptyMsg) + '</p>' +
        '</div>' +
      '</td></tr>';
    } else {
      bodyHtml = displayData.map((row, rowIdx) => {
        const isClickable = typeof onRowClick === 'function';
        return '<tr class="hover:bg-slate-100 transition-colors' + (isClickable ? ' cursor-pointer' : '') + '"' + (isClickable ? ' onclick="handleRowClick_' + containerId + '(' + rowIdx + ')"' : '') + '>' +
          currentHeaders.map(h => {
            const cellValue = h.render ? h.render(row[h.key], row) : (row[h.key] !== undefined && row[h.key] !== null ? escHtml(String(row[h.key])) : '--');
            return '<td class="py-2.5 px-4 text-xs text-slate-700">' + cellValue + '</td>';
          }).join('') +
        '</tr>';
      }).join('');
    }

    // Build full table HTML (toolbar: entries-per-page on left, search on right)
    let tableHtml = '<div class="bg-white border border-slate-200 rounded-lg overflow-hidden">';
    if (searchable || pagination) {
      tableHtml += '<div class="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-slate-200 flex-wrap">';

      // Left group: entries-per-page dropdown + Export button (kept adjacent)
      tableHtml += '<div class="flex items-center gap-2 flex-wrap">';

      // Entries-per-page dropdown (only when pagination is enabled)
      if (pagination) {
        const pageSizeHtml = pageSizeOptions.map(function(opt) {
          const val = opt === 'All' ? 'All' : String(opt);
          const selected = String(pageSize) === val ? ' selected' : '';
          return '<option value="' + val + '"' + selected + '>' + (opt === 'All' ? 'All' : opt) + '</option>';
        }).join('');
        tableHtml += '<div class="flex items-center gap-2">' +
          '<label for="pageSize_' + containerId + '" class="text-xs text-slate-600 whitespace-nowrap">Show</label>' +
          '<select id="pageSize_' + containerId + '" class="bg-slate-100 border border-slate-300 rounded-md px-2 py-1.5 text-xs text-slate-700 outline-none cursor-pointer focus:border-violet-400 focus:bg-white">' +
            pageSizeHtml +
          '</select>' +
          '<span class="text-xs text-slate-500 whitespace-nowrap">entries</span>' +
        '</div>';
      }

      // Export Excel button (right after entries-per-page)
      if (exportable) {
        tableHtml += '<button type="button" id="export_' + containerId + '" class="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors">' +
          '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">' +
            '<path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>' +
          '</svg>' +
          'Export Excel' +
        '</button>';
      }

      tableHtml += '</div>';

      // Right: search box
      if (searchable) {
        tableHtml += '<div class="flex items-center gap-2">' +
          '<svg class="w-4 h-4 text-slate-400 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">' +
            '<path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-4.35-4.35m1.35-5.15a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z"/>' +
          '</svg>' +
          '<input type="text" id="tableSearch_' + containerId + '" value="' + escHtml(searchTerm) + '" placeholder="' + escHtml(searchPlaceholder) + '" class="w-60 max-w-full bg-slate-100 border border-slate-300 rounded-md px-3 py-1.5 text-xs text-slate-700 placeholder-slate-400 outline-none focus:border-violet-400 focus:bg-white" />' +
        '</div>';
      }

      tableHtml += '</div>';
    }
    tableHtml += '<div class="overflow-x-auto">' +
        '<table class="w-full">' +
          '<thead>' + headerHtml + '</thead>' +
          '<tbody class="divide-y divide-slate-200">' + bodyHtml + '</tbody>' +
        '</table>' +
      '</div>';

    // Pagination footer (count/info text on left, page controls on right)
    if (pagination && totalPages > 1) {
      const pageStart = (currentPage - 1) * perPage + 1;
      const pageEnd = Math.min(pageStart + perPage - 1, totalItems);
      tableHtml += '<div class="border-t border-slate-200 bg-slate-200 px-4 py-2.5 flex items-center justify-between gap-4 flex-wrap">' +
        '<span class="text-xs text-slate-600">Showing ' + pageStart + ' to ' + pageEnd + ' of ' + totalItems + ' entries</span>' +
        '<div id="tablePagination_' + containerId + '"></div>' +
      '</div>';
    }

    tableHtml += '</div>';
    container.innerHTML = tableHtml;

    // Initialize pagination
    if (pagination && totalPages > 1) {
      paginationObj = createPagination({
        containerId: 'tablePagination_' + containerId,
        currentPage: currentPage,
        totalPages: totalPages,
        onPageChange: (page) => {
          currentPage = page;
          if (pagination.onPageChange) pagination.onPageChange(page);
          render();
        }
      });
      paginationObj.render();
    }

    // Entries-per-page dropdown: re-render with the new page size, reset to page 1
    const sizeSelect = document.getElementById('pageSize_' + containerId);
    if (sizeSelect) {
      sizeSelect.addEventListener('change', function(e) {
        const val = e.target.value;
        pageSize = val === 'All' ? 'All' : parseInt(val, 10);
        currentPage = 1;
        render();
      });
    }

    // Export button: download all currently-shown (search-filtered) rows as CSV (opens in Excel)
    const exportBtn = document.getElementById('export_' + containerId);
    if (exportBtn) {
      exportBtn.addEventListener('click', function() {
        const exportRows = baseData;
        if (!exportRows.length) {
          if (typeof toast === 'function') toast('No data to export', true);
          return;
        }
        const csvRows = [];
        csvRows.push(currentHeaders.map(function(h) {
          return '"' + String(h.label || '').replace(/"/g, '""') + '"';
        }).join(','));
        exportRows.forEach(function(row) {
          csvRows.push(currentHeaders.map(function(h) {
            const v = row ? row[h.key] : '';
            const s = (v === null || v === undefined) ? '' : String(v);
            return '"' + s.replace(/"/g, '""') + '"';
          }).join(','));
        });
        const csv = '\uFEFF' + csvRows.join('\r\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = (exportFilename || (containerId + '-export')) + '-' + new Date().toISOString().split('T')[0] + '.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      });
    }

    // Search input: filter data as the user types, keep focus in the box
    const searchInput = document.getElementById('tableSearch_' + containerId);
    if (searchInput) {
      searchInput.addEventListener('input', function(e) {
        const hadFocus = document.activeElement === e.target;
        searchTerm = e.target.value;
        currentPage = 1;
        render();
        const newInput = document.getElementById('tableSearch_' + containerId);
        if (newInput && hadFocus) {
          newInput.focus();
          newInput.setSelectionRange(newInput.value.length, newInput.value.length);
        }
      });
    }

    // Store row click handler globally
    if (typeof onRowClick === 'function') {
      window['handleRowClick_' + containerId] = (rowIdx) => {
        onRowClick(displayData[rowIdx]);
      };
    }
  }

  return {
    render,
    setData: (newData) => {
      currentData = newData || [];
      currentPage = 1;
      render();
    },
    setHeaders: (newHeaders) => {
      currentHeaders = newHeaders || [];
      render();
    },
    setLoading: (bool) => {
      isLoading = bool;
      render();
    },
    setPaginationPage: (page) => {
      currentPage = page;
      if (paginationObj) {
        paginationObj.setPage(page);
      }
      render();
    },
    getPagination: () => paginationObj,
    destroy: () => {
      container.innerHTML = '';
      delete window['handleRowClick_' + containerId];
    }
  };
}

// ── Confirm Dialog (reusable, matches app styling) ──
// Options:
//   title        - Heading text (default: 'Confirm')
//   message      - Body message (default: 'Are you sure?')
//   confirmText  - Confirm button label (default: 'Confirm')
//   cancelText   - Cancel button label (default: 'Cancel')
//   color        - 'violet' (default) or 'red' for the confirm button
//   onConfirm    - callback invoked when the user confirms
function showConfirmDialog(options = {}) {
  const { title = 'Confirm', message = 'Are you sure?', confirmText = 'Confirm', cancelText = 'Cancel', color = 'violet', onConfirm } = options;

  const existing = document.getElementById('confirmDialog');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'confirmDialog';
  overlay.className = 'fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm';
  const confirmBtnCls = color === 'red' ? 'bg-red-600 hover:bg-red-700' : 'bg-violet-600 hover:bg-violet-700';
  overlay.innerHTML =
    '<div class="bg-white border-2 border-slate-200 rounded-xl p-5 w-full max-w-sm mx-4 shadow-2xl">' +
      '<h3 class="text-base font-bold text-slate-900 mb-2">' + escHtml(title) + '</h3>' +
      '<p class="text-sm text-slate-600 mb-5">' + escHtml(message) + '</p>' +
      '<div class="flex justify-end gap-2">' +
        '<button type="button" data-cancel class="px-3 py-1.5 rounded-md bg-slate-100 border-2 border-slate-300 text-xs text-slate-700 hover:bg-slate-200 transition-colors">' + escHtml(cancelText) + '</button>' +
        '<button type="button" data-confirm class="px-3 py-1.5 rounded-md text-white text-xs font-semibold transition-colors ' + confirmBtnCls + '">' + escHtml(confirmText) + '</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  overlay.querySelector('[data-cancel]').addEventListener('click', close);
  overlay.querySelector('[data-confirm]').addEventListener('click', () => {
    close();
    if (typeof onConfirm === 'function') onConfirm();
  });
}

// ── Date Filter Service (lightweight, no HTML rendering) ──
// ── Date Filter Service (lightweight, no HTML rendering) ──
// Options:
//   onFilter(fromDate, toDate)  - Called when Get Data is clicked
//   onClear()                   - Called when Clear is clicked
//   onSearch(query)             - Called when search input changes
//   days                        - Number of days for default range (default: 7)
// Returns: { getDates(), setDates(from, to), reset(), validate() }
function createDateFilter(options = {}) {
  const { onFilter, onClear, onSearch, days = 7, autoLoad = true } = options;

  const today = new Date();
  const defaultFromDate = new Date(today);
  defaultFromDate.setDate(defaultFromDate.getDate() - days);

  const formatDate = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const defaultFrom = formatDate(defaultFromDate);
  const defaultTo = formatDate(today);
  const maxDate = formatDate(today);
  const sixMonthsAgo = new Date(today);
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const minDate = formatDate(sixMonthsAgo);

  const fromInput = document.getElementById('filterFromDate');
  const toInput = document.getElementById('filterToDate');
  const errorEl = document.getElementById('dateFilterError');
  const getDataBtn = document.getElementById('getDataBtn');
  const clearBtn = document.getElementById('clearFilterBtn');
  const searchInput = document.getElementById('userSearch');

  if (fromInput) fromInput.value = defaultFrom;
  if (toInput) toInput.value = defaultTo;
  if (fromInput) fromInput.min = minDate;
  if (fromInput) fromInput.max = maxDate;
  if (toInput) toInput.min = minDate;
  if (toInput) toInput.max = maxDate;

  function validateDateRange(fromDate, toDate) {
    if (!fromDate || !toDate) return true;
    const from = new Date(fromDate);
    const to = new Date(toDate);
    if (to < from) {
      if (errorEl) {
        errorEl.textContent = 'To date must be after from date';
        errorEl.classList.remove('hidden');
      }
      return false;
    }
    const diffMonths = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
    if (diffMonths > 6) {
      if (errorEl) {
        errorEl.textContent = 'Date range cannot exceed 6 months';
        errorEl.classList.remove('hidden');
      }
      return false;
    }
    if (errorEl) errorEl.classList.add('hidden');
    return true;
  }

  // Auto-load data when From/To dates change (same behavior as clicking Get Data).
  // Set autoLoad: false to only fetch when the Get Data button is clicked.
  function handleDateChange() {
    const fromDate = fromInput ? fromInput.value : '';
    const toDate = toInput ? toInput.value : '';
    if (!validateDateRange(fromDate, toDate)) return;
    if (fromDate && toDate && onFilter) onFilter(fromDate, toDate);
  }
  if (autoLoad && fromInput) {
    fromInput.addEventListener('change', handleDateChange);
  }
  if (autoLoad && toInput) {
    toInput.addEventListener('change', handleDateChange);
  }
  if (getDataBtn) {
    getDataBtn.addEventListener('click', () => {
      const fromDate = fromInput ? fromInput.value : '';
      const toDate = toInput ? toInput.value : '';
      if (!validateDateRange(fromDate, toDate)) return;
      if (onFilter) onFilter(fromDate, toDate);
    });
  }
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (fromInput) fromInput.value = '';
      if (toInput) toInput.value = '';
      if (errorEl) errorEl.classList.add('hidden');
      if (onClear) onClear();
    });
  }
  if (searchInput && onSearch) {
    searchInput.addEventListener('input', onSearch);
  }

  return {
    getDates: () => ({ fromDate: fromInput ? fromInput.value : '', toDate: toInput ? toInput.value : '' }),
    setDates: (from, to) => {
      if (fromInput) fromInput.value = from || '';
      if (toInput) toInput.value = to || '';
    },
    reset: () => {
      if (fromInput) fromInput.value = defaultFrom;
      if (toInput) toInput.value = defaultTo;
      if (errorEl) errorEl.classList.add('hidden');
    },
    validate: () => validateDateRange(fromInput ? fromInput.value : '', toInput ? toInput.value : '')
  };
}

// ── Select Filter Service (Select2-based) ──
// Options:
//   containerId: ID of the container element to render into
//   placeholder: Placeholder text for the search input
//   dataSource: Array or async function(searchTerm) that returns array of items
//   onFilter: Callback when filter is submitted (receives selected value)
//   displayField: Field name to display in dropdown (default: 'name')
//   valueField: Field name to use as value (default: 'id')
// Returns: { getValue(), setValue(), clear(), on(event, callback) }
function createSelectFilter(options = {}) {
  const { containerId, placeholder, dataSource, onFilter, displayField = 'name', valueField = 'id' } = options;
  const container = document.getElementById(containerId);
  if (!container) {
    console.error('Select filter container not found:', containerId);
    return null;
  }

  let selectedValue = null;
  let items = [];
  let $select = null;

  // Create a native select element for Select2 to enhance
  container.innerHTML = '<div class="flex items-center gap-2">' +
    '<div class="flex-1"><select id="selectFilter_' + containerId + '" class="w-full text-xs" style="width:100%"></select></div>' +
    '<button id="selectFilterBtn_' + containerId + '" class="bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium px-4 py-1.5 rounded-md transition-colors whitespace-nowrap">Get Data</button>' +
  '</div>';

  const selectEl = document.getElementById('selectFilter_' + containerId);
  const btn = document.getElementById('selectFilterBtn_' + containerId);
  $select = $(selectEl);

  // Initialize Select2
  $select.select2({
    placeholder: placeholder || 'Select...',
    allowClear: true,
    width: '100%',
    minimumResultsForSearch: 1,
    matcher: function(params, data) {
      if ($.trim(params.term) === '') return data;
      const term = params.term.toLowerCase();
      const text = (data.text || '').toLowerCase();
      if (text.indexOf(term) > -1) return data;
      return null;
    }
  });

  async function loadItems(searchTerm = '') {
    try {
      let data;
      if (typeof dataSource === 'function') {
        data = await dataSource(searchTerm);
      } else if (Array.isArray(dataSource)) {
        data = dataSource;
      }
      items = data || [];
      renderOptions(items);
    } catch (err) {
      console.error('Failed to load items:', err);
      items = [];
      renderOptions([]);
    }
  }

  function renderOptions(itemsToRender) {
    const currentVal = $select.val();
    $select.empty();
    $select.append('<option value=""></option>');
    itemsToRender.forEach(item => {
      const value = item[valueField];
      const display = item[displayField] || '--';
      $select.append('<option value="' + escHtml(String(value)) + '">' + escHtml(display) + '</option>');
    });
    if (currentVal) {
      $select.val(currentVal);
    }
    $select.trigger('change');
  }

  // Handle selection
  $select.on('change', function() {
    selectedValue = $select.val() || null;
  });

  btn.addEventListener('click', () => {
    if (onFilter) onFilter(selectedValue);
  });

  loadItems();

  return {
    getValue: () => selectedValue,
    setValue: (value) => {
      selectedValue = value;
      $select.val(value ? String(value) : null).trigger('change');
    },
    clear: () => {
      selectedValue = null;
      $select.val(null).trigger('change');
    },
    on: (event, callback) => {
      if (event === 'filter' && onFilter) {
        btn.onclick = () => {
          if (onFilter) onFilter(selectedValue);
          if (callback) callback(selectedValue);
        };
      }
    }
  };
}

// ── Searchable Select Component (Select2-based) ──
// Options:
//   containerId: ID of the container element to render into
//   placeholder: Placeholder text for the search input
//   dataSource: Array or async function(searchTerm) that returns array of items
//   onSelect: Callback when item is selected (receives value or array of values for multi-select)
//   multiSelect: Boolean - enable multi-select mode (default: false)
//   displayField: Field name to display in dropdown (default: 'name')
//   valueField: Field name to use as value (default: 'id')
// Returns: { getValue(), setValue(), clear(), on(event, callback) }
function createSearchableSelect(options = {}) {
  const { containerId, placeholder, dataSource, onSelect, multiSelect = false, displayField = 'name', valueField = 'id' } = options;
  const container = document.getElementById(containerId);
  if (!container) {
    console.error('Searchable select container not found:', containerId);
    return null;
  }

  let selectedItems = [];
  let items = [];
  let selectEl = null;
  let $select = null;

  // Create a native select element for Select2 to enhance
  container.innerHTML = '<select id="searchableSelect_' + containerId + '" class="w-full text-xs" style="width:100%"></select>';
  selectEl = document.getElementById('searchableSelect_' + containerId);
  $select = $(selectEl);

  // Initialize Select2
  $select.select2({
    placeholder: placeholder || 'Select...',
    allowClear: true,
    multiple: multiSelect,
    width: '100%',
    minimumResultsForSearch: 1,
    matcher: function(params, data) {
      // Custom matcher for client-side filtering
      if ($.trim(params.term) === '') return data;
      const term = params.term.toLowerCase();
      const text = (data.text || '').toLowerCase();
      if (text.indexOf(term) > -1) return data;
      return null;
    }
  });

  // Load items
  async function loadItems(searchTerm = '') {
    try {
      let data;
      if (typeof dataSource === 'function') {
        data = await dataSource(searchTerm);
      } else if (Array.isArray(dataSource)) {
        data = dataSource;
      }
      items = data || [];
      renderOptions(items);
    } catch (err) {
      console.error('Failed to load items:', err);
      items = [];
      renderOptions([]);
    }
  }

  function renderOptions(itemsToRender) {
    // Preserve current selection
    const currentVal = $select.val();
    $select.empty();
    if (!multiSelect) {
      $select.append('<option value=""></option>');
    }
    itemsToRender.forEach(item => {
      const value = item[valueField];
      const display = item[displayField] || '--';
      $select.append('<option value="' + escHtml(String(value)) + '">' + escHtml(display) + '</option>');
    });
    if (currentVal) {
      $select.val(currentVal);
    }
    $select.trigger('change');
  }

  // Handle selection
  $select.on('change', function() {
    const val = $select.val();
    if (multiSelect) {
      const vals = Array.isArray(val) ? val : (val ? [val] : []);
      selectedItems = items.filter(i => vals.includes(String(i[valueField])));
      if (onSelect) onSelect(selectedItems.map(i => i[valueField]));
    } else {
      const selectedVal = val || null;
      selectedItems = selectedVal ? items.filter(i => String(i[valueField]) === String(selectedVal)) : [];
      if (onSelect) onSelect(selectedVal);
    }
  });

  loadItems();

  return {
    getValue: () => multiSelect ? selectedItems.map(i => i[valueField]) : (selectedItems[0] ? selectedItems[0][valueField] : null),
    setValue: (value) => {
      if (multiSelect) {
        if (Array.isArray(value)) {
          selectedItems = items.filter(i => value.includes(String(i[valueField])));
          $select.val(selectedItems.map(i => String(i[valueField]))).trigger('change');
        }
      } else {
        const item = items.find(i => String(i[valueField]) === String(value));
        if (item) {
          selectedItems = [item];
          $select.val(String(value)).trigger('change');
        }
      }
    },
    clear: () => {
      selectedItems = [];
      $select.val(null).trigger('change');
    },
    on: (event, callback) => {
      if (event === 'select' && onSelect) {
        const originalOnSelect = onSelect;
        $select.on('change', function() {
          const val = $select.val();
          originalOnSelect(val);
          callback(val);
        });
      }
    }
  };
}

// ── Dark Searchable Select Component (Select2-based, for dark theme modals) ──
// Same as createSearchableSelect but with dark theme styling
function createDarkSearchableSelect(options = {}) {
  const { containerId, placeholder, dataSource, onSelect, multiSelect = false, displayField = 'name', valueField = 'id' } = options;
  const container = document.getElementById(containerId);
  if (!container) {
    console.error('Dark searchable select container not found:', containerId);
    return null;
  }

  let selectedItems = [];
  let items = [];
  let $select = null;

  // Create a native select element for Select2 to enhance
  container.innerHTML = '<select id="darkSelect_' + containerId + '" class="w-full text-xs" style="width:100%"></select>';
  const selectEl = document.getElementById('darkSelect_' + containerId);
  $select = $(selectEl);

  // Initialize Select2 with dark theme styling
  $select.select2({
    placeholder: placeholder || 'Select...',
    allowClear: true,
    multiple: multiSelect,
    width: '100%',
    minimumResultsForSearch: 1,
    dropdownCssClass: 'dark-select2-dropdown',
    containerCssClass: 'dark-select2-container',
    matcher: function(params, data) {
      if ($.trim(params.term) === '') return data;
      const term = params.term.toLowerCase();
      const text = (data.text || '').toLowerCase();
      if (text.indexOf(term) > -1) return data;
      return null;
    }
  });

  async function loadItems(searchTerm = '') {
    try {
      let data;
      if (typeof dataSource === 'function') {
        data = await dataSource(searchTerm);
      } else if (Array.isArray(dataSource)) {
        data = dataSource;
      }
      items = data || [];
      renderOptions(items);
    } catch (err) {
      console.error('Failed to load items:', err);
      items = [];
      renderOptions([]);
    }
  }

  function renderOptions(itemsToRender) {
    const currentVal = $select.val();
    $select.empty();
    if (!multiSelect) {
      $select.append('<option value=""></option>');
    }
    itemsToRender.forEach(item => {
      const value = item[valueField];
      const display = item[displayField] || '--';
      $select.append('<option value="' + escHtml(String(value)) + '">' + escHtml(display) + '</option>');
    });
    if (currentVal) {
      $select.val(currentVal);
    }
    $select.trigger('change');
  }

  // Handle selection
  $select.on('change', function() {
    const val = $select.val();
    if (multiSelect) {
      const vals = Array.isArray(val) ? val : (val ? [val] : []);
      selectedItems = items.filter(i => vals.includes(String(i[valueField])));
      if (onSelect) onSelect(selectedItems.map(i => i[valueField]));
    } else {
      const selectedVal = val || null;
      selectedItems = selectedVal ? items.filter(i => String(i[valueField]) === String(selectedVal)) : [];
      if (onSelect) onSelect(selectedVal);
    }
  });

  loadItems();

  return {
    getValue: () => multiSelect ? selectedItems.map(i => i[valueField]) : (selectedItems[0] ? selectedItems[0][valueField] : null),
    setValue: (value) => {
      if (multiSelect) {
        if (Array.isArray(value)) {
          selectedItems = items.filter(i => value.includes(String(i[valueField])));
          $select.val(selectedItems.map(i => String(i[valueField]))).trigger('change');
        }
      } else {
        const item = items.find(i => String(i[valueField]) === String(value));
        if (item) {
          selectedItems = [item];
          $select.val(String(value)).trigger('change');
        }
      }
    },
    clear: () => {
      selectedItems = [];
      $select.val(null).trigger('change');
    },
    setDataSource: (newDataSource) => {
      dataSource = newDataSource;
      loadItems();
    },
    on: (event, callback) => {
      if (event === 'select' && onSelect) {
        const originalOnSelect = onSelect;
        $select.on('change', function() {
          const val = $select.val();
          originalOnSelect(val);
          callback(val);
        });
      }
    }
  };
}

async function apiFetch(url, options) {
  const res = await fetch(url, { credentials: 'include', ...options });
  
  if (res.status === 401) {
    try {
      sessionStorage.removeItem('cached_user');
      sessionStorage.removeItem('rl_user_profile');
      sessionStorage.removeItem('rl_header_config');
      localStorage.removeItem('rl_user');
      localStorage.removeItem('rl_token');
    } catch {
      // ignore
    }
    window.location.href = '/login.html';
    throw new Error('Session expired');
  }
  
  const json = await res.json();
  if (!res.ok || json.success === false) {
    throw new Error(json.error || json.message || 'Request failed');
  }
  return json;
}