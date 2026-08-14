/**
 * Admin Settings - Organization Page
 * Loads company profile + org stats + departments dynamically from the DB
 * via GET/PUT /api/admin/settings/organization (route > controller > model > db).
 */
let orgData = null;

(async () => {
  await loadOrganization();
  // Company profile is read-only — no save action
})();

async function loadOrganization() {
  try {
    const data = await apiFetch('/api/admin/settings/organization');
    orgData = data;
    const stats = data.stats || {};
    setText('statUsers', stats.totalUsers);
    setText('statInstructors', stats.activeInstructors);
    setText('statDepartments', stats.totalDepartments);
    setText('statMeetings', stats.totalMeetings);
    setText('statScores', stats.totalScores);

    const p = data.profile || {};
    setVal('companyName', p.company_name);
    setVal('companyCode', p.company_code);
    setVal('domain', p.domain);
    setVal('logoUrl', p.logo_url);
    setVal('status', p.status || 'active');
    setVal('companyCreated', p.created_at ? formatDate(p.created_at) : '');

    renderDepartments(data.departments || []);
  } catch (e) {
    console.error('loadOrganization:', e);
    showToast('Failed to load organization: ' + e.message, true);
  }
}

function renderDepartments(departments) {
  const tbody = document.getElementById('departmentBody');
  if (!tbody) return;
  if (!departments.length) {
    tbody.innerHTML = `<tr><td colspan='2' class='py-2 text-center text-violet-800 font-medium'>No departments found</td></tr>`;
    return;
  }
  let html = '';
  departments.forEach((d) => {
    html += `<tr class='border-b border-violet-200 hover:bg-violet-100/70 transition-colors'>`;
    html += `<td class='py-2 px-2 text-[11px] font-semibold text-violet-950'>${escapeHtml(d.name || '--')}</td>`;
    html += `<td class='py-2 px-2 text-[11px] font-bold text-violet-900 text-right'>${d.member_count || 0}</td>`;
    html += `</tr>`;
  });
  tbody.innerHTML = html;
}

function setText(id, v) { const el = document.getElementById(id); if (el) el.textContent = (v == null ? '-' : v); }
function setVal(id, v) { const el = document.getElementById(id); if (el) el.value = (v == null ? '' : v); }
function valOf(id) { const el = document.getElementById(id); return el ? el.value.trim() : ''; }
function formatDate(d) { if (!d) return 'N/A'; return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
function escapeHtml(s) { if (!s) return ''; const div = document.createElement('div'); div.textContent = String(s); return div.innerHTML; }
