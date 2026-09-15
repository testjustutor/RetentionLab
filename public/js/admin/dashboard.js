/**
 * public/js/admin/dashboard.js
 */

const DashboardAPI = {
  base: '/dashboard',
  async getCounts() {
    const res = await fetch(DashboardAPI.base + '/', { credentials: 'same-origin' });
    return res.json();
  }
};

export default DashboardAPI;