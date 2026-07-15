let reviewerRoleId = null;

async function loadReviewerRole() {
  try {
    const response = await fetch('/api/roles/reviewer', { credentials: 'include' });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Unable to load reviewer role');
    }
    const role = await response.json();
    reviewerRoleId = role.id;
  } catch (err) {
    document.getElementById('formMessage').textContent = err.message;
    document.getElementById('formMessage').className = 'text-sm text-red-400';
  }
}

async function submitReviewerForm(event) {
  event.preventDefault();
  const messageEl = document.getElementById('formMessage');
  messageEl.textContent = '';

  if (!reviewerRoleId) {
    messageEl.textContent = 'Reviewer role not loaded. Please refresh.';
    messageEl.className = 'text-sm text-red-400';
    return;
  }

  const name = document.getElementById('name').value.trim();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  if (!name || !email || !password) {
    messageEl.textContent = 'Name, email, and password are required.';
    messageEl.className = 'text-sm text-red-400';
    return;
  }

  const payload = {
    first_name: name,
    email,
    password_hash: password,
    role_id: reviewerRoleId
  };

  try {
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to create reviewer');
    }

    const created = await res.json();
    messageEl.textContent = `Reviewer ${created.email} created successfully.`;
    messageEl.className = 'text-sm text-emerald-600';
    event.target.reset();
  } catch (err) {
    messageEl.textContent = err.message;
    messageEl.className = 'text-sm text-red-400';
  }
}

document.getElementById('addReviewerForm').addEventListener('submit', submitReviewerForm);
window.addEventListener('load', loadReviewerRole);