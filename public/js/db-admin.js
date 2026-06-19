/**
 * root/public/js/db-admin.js
*/
// DB admin frontend helpers
const DBAdmin = {
  base: '/db-admin',
  async request(path, opts = {}) {
    const headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
    const res = await fetch(DBAdmin.base + path, Object.assign({ headers, credentials: 'same-origin' }, opts));
    const text = await res.text();
    try { return JSON.parse(text); } catch(e) { return text; }
  },

  listTables: () => DBAdmin.request('/tables', { method: 'GET' }),
  getTable: (name) => DBAdmin.request('/table/' + encodeURIComponent(name), { method: 'GET' }),
  clearTable: (name) => DBAdmin.request('/clear/' + encodeURIComponent(name), { method: 'POST' }),
  exportTable: (name) => { window.location = DBAdmin.base + '/export/' + encodeURIComponent(name); },
  runQuery: (sql) => DBAdmin.request('/query', { method: 'POST', body: JSON.stringify({ sql }) }),
  deleteRow: (table, id) => DBAdmin.request('/row/' + encodeURIComponent(table) + '/' + encodeURIComponent(id), { method: 'DELETE' }),
  insertRow: (table, data) => DBAdmin.request('/row/' + encodeURIComponent(table), { method: 'POST', body: JSON.stringify(data) }),
  stats: () => DBAdmin.request('/stats', { method: 'GET' })
};

export default DBAdmin;