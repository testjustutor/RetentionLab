// Load roles dynamically from backend API
async function loadRolesAndPermissions() {
  const rolesAccessContainer = document.getElementById('rolesAccessContainer');
  try {
    const response = await fetch('/api/roles');
    if (!response.ok) throw new Error('Failed to fetch roles');
    const result = await response.json();
    const roles = result.data || [];

    if (roles.length === 0) {
      rolesAccessContainer.innerHTML = '<p class="text-slate-400">No roles found.</p>';
      return;
    }

    let contentHtml = `
      <div class="mb-3">
        <h3 class="text-sm font-semibold  mb-2">Roles & Descriptions</h3>
        <table class="min-w-full divide-y divide-slate-700">
          <thead>
            <tr>
              <th class="px-3 py-2 text-left text-[10px] font-medium text-slate-400 uppercase tracking-wider">ID</th>
              <th class="px-3 py-2 text-left text-[10px] font-medium text-slate-400 uppercase tracking-wider">Role Name</th>
              <th class="px-3 py-2 text-left text-[10px] font-medium text-slate-400 uppercase tracking-wider">Description</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-800">
    `;
    roles.forEach(role => {
      contentHtml += `
        <tr>
          <td class="px-3 py-2 whitespace-nowrap text-xs text-slate-300">${role.id}</td>
          <td class="px-3 py-2 whitespace-nowrap text-xs font-medium ">${role.role_name}</td>
          <td class="px-3 py-2 whitespace-nowrap text-xs text-slate-300">${role.description || 'No description'}</td>
        </tr>
      `;
    });
    contentHtml += `
          </tbody>
        </table>
      </div>
      <button class="px-3 py-1.5 bg-indigo-600  text-xs font-semibold rounded-md hover:bg-indigo-500 transition-colors" onclick="addRole()">Add Role</button>
    `;
    rolesAccessContainer.innerHTML = contentHtml;
  } catch (err) {
    console.error('Error loading roles:', err);
    rolesAccessContainer.innerHTML = '<p class="text-red-400">Failed to load roles. ' + err.message + '</p>';
  }
}

async function addRole() {
  const roleName = prompt('Enter new role name:');
  if (roleName !== null && roleName.trim() !== '') {
    try {
      const response = await fetch('/api/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role_name: roleName.trim() })
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to create role');
      }
      alert('Role "' + roleName.trim() + '" created successfully!');
      loadRolesAndPermissions();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  }
}

loadRolesAndPermissions();