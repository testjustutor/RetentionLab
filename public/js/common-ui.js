/**
 * public/js/common-ui.js
 * Shared UI utilities: modal open/close, toast notifications, escape-html.
 * Include this after tailwind in HTML pages that need modals/toasts.
 */

// ── Toast ──
function showToast(msg, isErr) {
  let toast = document.getElementById('commonToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'commonToast';
    toast.className = 'hidden fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl text-white text-sm font-medium shadow-lg flex items-center gap-2 transition-all duration-300';
    toast.innerHTML = '<svg class="w-4 h-4 toast-icon" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"></svg><span class="toast-msg"></span>';
    document.body.appendChild(toast);
  }
  const icon = toast.querySelector('.toast-icon');
  const span = toast.querySelector('.toast-msg');
  span.textContent = msg;
  toast.className = 'fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl text-white text-sm font-medium shadow-lg flex items-center gap-2 transition-all duration-300 ' + (isErr ? 'bg-red-600' : 'bg-emerald-600');
  icon.className = 'w-4 h-4 toast-icon';
  icon.innerHTML = isErr
    ? '<circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/><line x1="15" y1="9" x2="9" y2="15" stroke="currentColor" stroke-width="2"/><line x1="9" y1="9" x2="15" y2="15" stroke="currentColor" stroke-width="2"/>'
    : '<path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>';
  toast.classList.remove('hidden');
  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => toast.classList.add('hidden'), 3000);
}

// ── Modal ──
function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.remove('hidden');
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) { modal.classList.add('hidden'); }
}

function setupModal(id, openBtnId, closeBtnIds) {
  const modal = document.getElementById(id);
  if (!modal) return;
  if (openBtnId) {
    const openBtn = document.getElementById(openBtnId);
    if (openBtn) openBtn.addEventListener('click', () => openModal(id));
  }
  if (closeBtnIds) {
    closeBtnIds.forEach(cid => {
      const btn = document.getElementById(cid);
      if (btn) btn.addEventListener('click', () => closeModal(id));
    });
  }
}

// ── Escape HTML ──
function escHtml(str) {
  if (!str) return '';
  const d = document.createElement('div');
  d.textContent = String(str);
  return d.innerHTML;
}

// ── API helper ──
async function apiFetch(url, options) {
  const res = await fetch(url, { credentials: 'include', ...options });
  const json = await res.json();
  if (!res.ok || json.success === false) {
    throw new Error(json.error || json.message || 'Request failed');
  }
  return json;
}