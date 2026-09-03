/**
 * public/js/users.js
 */

import AuthAPI from './auth.js';

const UsersAPI = {
  base: '/users',
  async request(path, opts = {}) {
    const headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
    const res = await fetch(UsersAPI.base + path, Object.assign({ headers, credentials: 'same-origin' }, opts));
    const text = await res.text();
    try { return JSON.parse(text); } catch(e) { return text; }
  },

  list: () => UsersAPI.request('/', { method: 'GET' }),
  get: (id) => UsersAPI.request('/' + id, { method: 'GET' }),
  create: (data) => UsersAPI.request('/', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => UsersAPI.request('/' + id, { method: 'PUT', body: JSON.stringify(data) }),
  softDelete: (id) => UsersAPI.request('/' + id, { method: 'DELETE' })
};

export default UsersAPI;