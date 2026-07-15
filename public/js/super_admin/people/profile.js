function initProfileMenu() {
  const btn = document.getElementById('profileMenuBtn');
  const menu = document.getElementById('profileMenu');
  if (!btn || !menu) return;
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    menu.classList.toggle('hidden');
  });
  document.addEventListener('click', () => menu.classList.add('hidden'));
}

async function handleLogout() {
  localStorage.removeItem('rl_user');
  localStorage.removeItem('rl_token');
  sessionStorage.clear();
  try { await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }); } catch(_) {}
  window.location.href = '/login.html';
}

window.addEventListener('load', () => { if (typeof initProfileMenu === 'function') initProfileMenu(); });