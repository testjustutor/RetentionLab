let currentTable = "";

// INIT
window.onload = () => {
  loadTables();
  loadStats();
};

// ================= TABLES =================

async function loadTables() {
  showLoading();
  try {
    const res = await fetch('/api/db/tables');
    const data = await res.json();
    const select = document.getElementById('tableSelect');
    select.innerHTML = '<option value="">Select table</option>';
    data.data.tables.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.name;
      opt.textContent = t.name;
      select.appendChild(opt);
    });
  } catch (e) {
    showError(e.message);
  }
  hideLoading();
}

async function loadTableData(table) {
  showLoading();
  try {
    const res = await fetch(`/api/db/table/${table}`);
    const data = await res.json();
    if (data.status !== 'success') throw new Error(data.message);
    renderTable(data.data);
    currentTable = table;
    updateLastUpdated();
  } catch (e) {
    showError(e.message);
  }
  hideLoading();
}

function renderTable(table) {
  const el = document.getElementById('data');
  if (!table.rows.length) {
    el.innerHTML = '<div class="empty">No data</div>';
    return;
  }
  let html = `<h3>${table.name} (${table.rows.length} rows)</h3>`;
  html += `<table><thead><tr>`;
  table.columns.forEach(c => {
    html += `<th>${c.name}<br><small>${c.type}</small></th>`;
  });
  html += `<th>Actions</th></tr></thead><tbody>`;
  table.rows.forEach(row => {
    html += "<tr>";
    table.columns.forEach(c => {
      html += `<td>${truncate(row[c.name])}</td>`;
    });
    const id = row.id || row.rowid;
    html += `<td><button onclick="deleteRow('${table.name}',${id})">🗑️</button></td>`;
    html += "</tr>";
  });
  html += "</tbody></table>";
  el.innerHTML = html;
}

// ================= ACTIONS =================

async function deleteRow(table,id) {
  if (!confirm('Delete row?')) return;
  await fetch(`/api/db/row/${table}/${id}`, { method:'DELETE' });
  loadTableData(table);
}

async function clearTable() {
  if (!currentTable) return;
  if (!confirm('Clear table?')) return;
  await fetch(`/api/db/clear/${currentTable}`, { method:'POST' });
  loadTableData(currentTable);
}

async function exportCSV() {
  if (!currentTable) return;
  const res = await fetch(`/api/db/export/${currentTable}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = currentTable + ".csv";
  a.click();
}

function refreshData() {
  if (!currentTable) return;
  loadTableData(currentTable);
}

// ================= STATS =================

async function loadStats() {
  try {
    const res = await fetch('/api/db/stats');
    const data = await res.json();
    const el = document.getElementById('stats');
    el.innerHTML = data.data.tables.map(t => `
      <div class="stat-card">
        <div class="stat-number">${t.count}</div>
        <div>${t.name}</div>
      </div>
    `).join('');
  } catch(e) {
    console.error(e);
  }
}

// ================= QUERY =================

async function executeQuery() {
  const sql = prompt('Enter SQL query');
  if (!sql) return;
  const res = await fetch('/api/db/query', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({sql})
  });
  const data = await res.json();
  alert(JSON.stringify(data,null,2));
}

// ================= HELPERS =================

function truncate(str,len=80){
  str = String(str || '');
  return str.length > len ? str.slice(0,len)+'...' : str;
}

function showLoading(){
  document.getElementById('loading').style.display='block';
  document.getElementById('data').style.display='none';
}

function hideLoading(){
  document.getElementById('loading').style.display='none';
  document.getElementById('data').style.display='block';
}

function showError(msg){
  const el = document.getElementById('error');
  el.innerText = msg;
  el.style.display='block';
}

function updateLastUpdated(){
  document.getElementById('lastUpdated').innerText =
    'Updated: ' + new Date().toLocaleString();
}

// ================= EVENTS =================

document.getElementById('tableSelect').addEventListener('change', e => {
  if (e.target.value) loadTableData(e.target.value);
});