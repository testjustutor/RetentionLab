// Super Admin - Google OAuth Credentials Management
let allCredentials = [];

async function loadCredentials() {
  try {
    const json = await apiFetch('/api/google-credentials');
    allCredentials = json.data || [];
    renderCredentials();
  } catch (err) {
    document.getElementById('credentialsList').innerHTML = 'Failed to load';
  }
}

function renderCredentials() {
  const container = document.getElementById('credentialsList');
  if (!allCredentials.length) {
    container.innerHTML = 'No credentials found';
    return;
  }
  container.innerHTML = allCredentials.map(cred => {
    const statusBadge = cred.is_active ? 'Active' : 'Inactive';
    return '<div class="bg-white border rounded-lg p-4">' +
      '<h3>Google OAuth Configuration</h3>' +
      '<p>Status: ' + statusBadge + '</p>' +
      '<p class="text-xs text-gray-500">Credentials managed via .env file</p>' +
      '<button onclick="editCredential(' + cred.id + ')">Edit</button> ' +
      '<button onclick="deleteCredential(' + cred.id + ')">Delete</button>' +
    '</div>';
  }).join('');
}

function openAddModal() {
  document.getElementById('editId').value = '';
  document.getElementById('credentialForm').reset();
  document.getElementById('is_active').checked = true;
  document.getElementById('modalTitle').textContent = 'Add Credentials';
  document.getElementById('credentialModal').classList.remove('hidden');
}

function editCredential(id) {
  const cred = allCredentials.find(c => c.id === id);
  if (!cred) return;
  document.getElementById('editId').value = cred.id;
  document.getElementById('project_id').value = cred.project_id || '';
  document.getElementById('redirect_uris').value = (cred.redirect_uris || []).join('\n');
  document.getElementById('javascript_origins').value = (cred.javascript_origins || []).join('\n');
  document.getElementById('is_active').checked = cred.is_active === 1;
  document.getElementById('modalTitle').textContent = 'Edit OAuth Configuration';
  document.getElementById('credentialModal').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('credentialModal').classList.add('hidden');
}

async function deleteCredential(id) {
  if (!confirm('Delete credentials?')) return;
  try {
    await apiFetch('/api/google-credentials/' + id, { method: 'DELETE' });
    showToast('Deleted');
    loadCredentials();
  } catch (err) {
    showToast('Delete failed', 'error');
  }
}

document.getElementById('credentialForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('editId').value;
  const data = {
    project_id: document.getElementById('project_id').value.trim() || null,
    redirect_uris: document.getElementById('redirect_uris').value.split('\n').map(s => s.trim()).filter(Boolean),
    javascript_origins: document.getElementById('javascript_origins').value.split('\n').map(s => s.trim()).filter(Boolean),
    is_active: document.getElementById('is_active').checked ? 1 : 0
  };
  try {
    if (id) {
      await apiFetch('/api/google-credentials/' + id, { method: 'PUT', body: data });
      showToast('Updated');
    } else {
      await apiFetch('/api/google-credentials', { method: 'POST', body: data });
      showToast('Added');
    }
    closeModal();
    loadCredentials();
  } catch (err) {
    showToast('Save failed', 'error');
  }
});

document.getElementById('credentialModal').addEventListener('click', (e) => {
  if (e.target === document.getElementById('credentialModal')) closeModal();
});

loadCredentials();
