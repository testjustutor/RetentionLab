let adminRoleId = null;

async function loadAdminRole() {
  try {
    const response = await fetch('/api/roles/admin', { credentials: 'include' });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to fetch admin role');
    }
    const role = await response.json();
    adminRoleId = role.id;
  } catch (err) {
    console.error('Error loading admin role:', err);
    alert('Failed to load admin role: ' + err.message);
  }
}

async function loadCompanies() {
  try {
    const response = await fetch('/api/companies', { credentials: 'include' });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to fetch companies');
    }
    const result = await response.json();
    const companies = result.data || [];
    const companySelect = document.getElementById('company');
    companySelect.innerHTML = '<option value="">Select a company</option>';
    companies.forEach(company => {
      const option = document.createElement('option');
      option.value = company.id;
      option.textContent = company.company_name;
      companySelect.appendChild(option);
    });
  } catch (err) {
    console.error('Error loading companies:', err);
    alert('Failed to load companies: ' + err.message);
  }
}

document.getElementById('addUserForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!adminRoleId) {
    alert('Admin role is not available. Refresh and try again.');
    return;
  }
  const formData = new FormData(event.target);
  const userData = Object.fromEntries(formData.entries());

  try {
    const response = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        email: userData.email,
        first_name: userData.name,
        password_hash: userData.password,
        role_id: adminRoleId,
        company_id: parseInt(userData.company_id, 10)
      })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to create admin user');
    }

    const created = await response.json();
    alert(`Admin user "${created.email}" created successfully!`);
    document.getElementById('addUserForm').reset();
  } catch (err) {
    alert('Error: ' + err.message);
  }
});

window.addEventListener('load', () => {
  loadAdminRole();
  loadCompanies();
});