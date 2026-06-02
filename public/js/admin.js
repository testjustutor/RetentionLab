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
    const text = await res.text();
    if (text.trim().startsWith('<')) throw new Error('HTML response');
    const data = JSON.parse(text);
    const select = document.getElementById('tableSelect');
    select.innerHTML = '<option value="">Select table</option>';
    const tablesArr = data.data ? data.data.tables : data.tables;
    if (tablesArr) {
      tablesArr.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.name;
        opt.textContent = t.name;
        select.appendChild(opt);
      });
    }
  } catch (e) {
    console.warn('API error, tables could not be loaded', e);
    const select = document.getElementById('tableSelect');
    select.innerHTML = '<option value="">Cannot load tables (API Error)</option>';
  }
  hideLoading();
}

async function loadTableData(table) {
  showLoading();
  try {
    const res = await fetch(`/api/db/table/${table}`);
    const text = await res.text();
    if (text.trim().startsWith('<')) throw new Error('HTML response');
    const data = JSON.parse(text);
    if (data.status && data.status !== 'success') throw new Error(data.message || 'Error');
    renderTable(data.data);
    currentTable = table;
    updateLastUpdated();
  } catch (e) {
    console.warn('API error, table data could not be loaded', e);
    const el = document.getElementById('data');
    el.innerHTML = '<div class="empty">Unable to load data. The API endpoints are not yet connected or returned an error.</div>';
    currentTable = table;
    updateLastUpdated();
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
    const text = await res.text();
    if (text.trim().startsWith('<')) throw new Error('HTML response');
    const data = JSON.parse(text);
    const el = document.getElementById('stats');
    const tablesArr = data.data ? data.data.tables : [];
    el.innerHTML = tablesArr.map(t => `
      <div class="bg-slate-900/60 backdrop-blur-md border border-slate-800/80 shadow-md rounded-xl p-4 flex flex-col gap-1 transition relative overflow-hidden group hover:border-slate-700">
        <div class="absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-indigo-500/50 to-purple-500/50 opacity-50 group-hover:opacity-100 transition"></div>
        <div class="text-2xl font-bold text-white font-mono leading-none">${t.count}</div>
        <div class="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">${t.name}</div>
      </div>
    `).join('');
  } catch(e) {
    console.warn('API error, stats could not be loaded', e);
    const el = document.getElementById('stats');
    el.innerHTML = `
      <div class="bg-indigo-500/10 backdrop-blur-md border border-indigo-500/20 shadow-md rounded-xl p-4 flex flex-col gap-1 mx-auto col-span-full">
        <div class="text-[12px] uppercase tracking-wide text-indigo-400 font-semibold text-center mt-2 mb-2">No Data Available</div>
        <div class="text-[11px] text-slate-400 text-center font-mono">System disconnected from underlying database layer or API is under construction.</div>
      </div>
    `;
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
