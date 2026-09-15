/**
 * public/js/super_admin/content/assets.js
 */
let allAssets = [];
let currentFilter = '';
let searchDebounceTimer = null;

function escHtml(s) {
  if (s === null || s === undefined) return '';
  const div = document.createElement('div');
  div.textContent = String(s);
  return div.innerHTML;
}

async function loadAssets() {
  const container = document.getElementById('assetsTableBody');
  const searchInput = document.getElementById('assetSearch');
  const filterValue = searchInput ? searchInput.value.toLowerCase() : '';

  try {
    let url = '/api/assets?';
    if (filterValue) url += 'search=' + encodeURIComponent(filterValue);
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch assets');
    const result = await response.json();
    allAssets = result.data || result.assets || [];
    if (allAssets.length === 0) {
      container.innerHTML = '<tr><td colspan="5" class="py-6 text-center text-slate-500">No assets found</td></tr>';
      return;
    }
    container.innerHTML = allAssets.map(asset => `
      <tr class="hover:bg-slate-800/30">
        <td class="px-4 py-3 text-sm text-white">${escHtml(asset.name || 'Untitled')}</td>
        <td class="px-4 py-3 text-sm text-slate-300">${escHtml(asset.type || 'N/A')}</td>
        <td class="px-4 py-3 text-sm text-slate-300">${escHtml(asset.file_size || '-')}</td>
        <td class="px-4 py-3 text-sm text-slate-400">${asset.created_at ? escHtml(new Date(asset.created_at).toLocaleDateString()) : '-'}</td>
        <td class="px-4 py-3 text-sm">
          <button class="asset-view-btn text-indigo-400 hover:text-indigo-600 mr-2" data-asset-id="${escHtml(asset.id)}">View</button>
          <button class="asset-delete-btn text-red-400 hover:text-red-600" data-asset-id="${escHtml(asset.id)}">Delete</button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Error loading assets:', err);
    container.innerHTML = '<tr><td colspan="5" class="py-6 text-center text-red-400">Failed to load assets</td></tr>';
  }
}

async function viewAsset(id) {
  // Compare as strings since asset.id may be a number or string depending
  // on the API response, while `id` read from a data-* attribute is always
  // a string.
  const asset = allAssets.find(a => String(a.id) === String(id));
  if (!asset) return;
  if (asset.file_url) {
    window.open(asset.file_url, '_blank');
  } else {
    alert('Asset details: ' + JSON.stringify(asset, null, 2));
  }
}

async function deleteAsset(id) {
  if (!confirm('Are you sure you want to delete this asset?')) return;
  try {
    const response = await fetch('/api/assets/' + encodeURIComponent(id), { method: 'DELETE' });
    if (!response.ok) throw new Error('Delete failed');
    alert('Asset deleted successfully!');
    loadAssets();
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

// Delegated click handler for View/Delete buttons rendered dynamically above.
// Avoids inline onclick="viewAsset('${asset.id}')" style handlers, which are
// vulnerable to breaking (or worse, injection) if an id or other value ever
// contains a quote character.
document.getElementById('assetsTableBody')?.addEventListener('click', function (e) {
  const viewBtn = e.target.closest('.asset-view-btn');
  if (viewBtn) {
    viewAsset(viewBtn.dataset.assetId);
    return;
  }
  const deleteBtn = e.target.closest('.asset-delete-btn');
  if (deleteBtn) {
    deleteAsset(deleteBtn.dataset.assetId);
  }
});

// Debounced search - avoids firing a network request on every keystroke.
if (document.getElementById('assetSearch')) {
  document.getElementById('assetSearch').addEventListener('input', function () {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(loadAssets, 300);
  });
}

loadAssets();