let allAssets = [];
let currentFilter = '';

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
        <td class="px-4 py-3 text-sm text-white">${asset.name || 'Untitled'}</td>
        <td class="px-4 py-3 text-sm text-slate-300">${asset.type || 'N/A'}</td>
        <td class="px-4 py-3 text-sm text-slate-300">${asset.file_size || '-'}</td>
        <td class="px-4 py-3 text-sm text-slate-400">${asset.created_at ? new Date(asset.created_at).toLocaleDateString() : '-'}</td>
        <td class="px-4 py-3 text-sm">
          <button class="text-indigo-400 hover:text-indigo-600 mr-2" onclick="viewAsset('${asset.id}')">View</button>
          <button class="text-red-400 hover:text-red-600" onclick="deleteAsset('${asset.id}')">Delete</button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Error loading assets:', err);
    container.innerHTML = '<tr><td colspan="5" class="py-6 text-center text-red-400">Failed to load assets</td></tr>';
  }
}

async function viewAsset(id) {
  const asset = allAssets.find(a => a.id === id);
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
    const response = await fetch('/api/assets/' + id, { method: 'DELETE' });
    if (!response.ok) throw new Error('Delete failed');
    alert('Asset deleted successfully!');
    loadAssets();
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

if (document.getElementById('assetSearch')) {
  document.getElementById('assetSearch').addEventListener('input', loadAssets);
}

loadAssets();