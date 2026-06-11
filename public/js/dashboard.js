/**
 * root/public/js/dashboard.js
*/
// Dashboard helpers
const DashboardAPI = {
  base: '/dashboard',
  async getCounts() {
    const res = await fetch(DashboardAPI.base + '/', { credentials: 'same-origin' });
    return res.json();
  }
};

export default DashboardAPI;