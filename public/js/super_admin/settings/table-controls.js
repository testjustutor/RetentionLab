/**
 * public/js/super_admin/settings/table-controls.js
 */

const KNOWN_TABLES = [
  { id: 'transcriptsContainer', label: 'Transcripts' },
  { id: 'recordingsContainer', label: 'Recordings' },
  { id: 'videosContainer', label: 'Videos' },
  { id: 'summariesContainer', label: 'Summaries' },
  { id: 'connectionsContainer', label: 'Calendar Accounts' },
  { id: 'scoresRoot', label: 'Scores' }
];

const CONTROL_FIELDS = [
  { key: 'showSearch', label: 'Search' },
  { key: 'showEntries', label: 'Entries per page' },
  { key: 'showInfo', label: 'Showing X-Y of Z' },
  { key: 'showPagination', label: 'Pagination' }
];

async function apiJson(url, options = {}) {
  const res = await fetch(url, { credentials: 'include', ...options });
  let data = {};
  try { data = await res.json(); } catch (e) { /* ignore */ }
  if (!res.ok || data.success === false) {
    throw new Error(data.error || data.message || 'Request failed');
  }
  return data;
}

function esc(s) {
  if (s === undefined || s === null) return '';
  const d = document.createElement('div');
  d.textContent = String(s);
  return d.innerHTML;
}

async function reloadControls() {
  const container = document.getElementById('controlsContainer');
  if (!container) return;
  container.innerHTML = '<div class="p-6 text-center text-cyan-800 text-xs">Loading...</div>';
  let stored = {};
  try {
    const json = await apiJson('/api/tables/controls');
    (json.items || []).forEach(it => { stored[it.tableId] = it.controls || {}; });
  } catch (e) {
    container.innerHTML = '<div class="p-6 text-center text-rose-600 text-xs">Failed to load controls: ' + esc(e.message) + '</div>';
    return;
  }

  let html = '<table class="w-full text-left text-xs">' +
    '<thead><tr class="border-b-2 border-cyan-200 bg-cyan-200">' +
      '<th class="py-2 px-3 text-cyan-800 uppercase font-medium">Table</th>' +
      CONTROL_FIELDS.map(f => '<th class="py-2 px-3 text-cyan-800 uppercase font-medium text-center">' + f.label + '</th>').join('') +
      '<th class="py-2 px-3 text-cyan-800 uppercase font-medium">Actions</th>' +
    '</tr></thead><tbody>';

  if (KNOWN_TABLES.length === 0) {
    html += '<tr><td colspan="' + (CONTROL_FIELDS.length + 2) + '" class="py-4 text-center text-cyan-800">No tables defined</td></tr>';
  } else {
    KNOWN_TABLES.forEach(function(t) {
      const c = Object.assign({ showSearch: true, showEntries: true, showInfo: true, showPagination: true }, stored[t.id] || {});
      html += '<tr class="border-b border-cyan-200">' +
        '<td class="py-2.5 px-3"><span class="text-cyan-950 font-bold">' + esc(t.label) + '</span>' +
        '<div class="text-[10px] text-cyan-700 font-mono">' + esc(t.id) + '</div></td>' +
        CONTROL_FIELDS.map(f =>
          '<td class="py-2.5 px-3 text-center">' +
            '<input type="checkbox" id="' + esc(t.id) + '_' + f.key + '" ' + (c[f.key] ? 'checked' : '') + ' class="accent-teal-500 h-4 w-4">' +
          '</td>'
        ).join('') +
        '<td class="py-2.5 px-3"><button onclick="saveTable(\'' + esc(t.id) + '\')" class="px-3 py-1 bg-teal-600 hover:bg-teal-500 text-white text-[11px] font-medium rounded transition">Save</button></td>' +
      '</tr>';
    });
  }

  html += '</tbody></table>';
  container.innerHTML = html;
}

async function saveTable(id) {
  const payload = {};
  CONTROL_FIELDS.forEach(function(f) {
    const el = document.getElementById(id + '_' + f.key);
    payload[f.key] = !!el && el.checked;
  });
  try {
    await apiJson('/api/tables/controls/' + encodeURIComponent(id), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    alert('Saved controls for ' + id);
  } catch (e) {
    alert('Failed to save: ' + e.message);
  }
}

document.addEventListener('DOMContentLoaded', reloadControls);