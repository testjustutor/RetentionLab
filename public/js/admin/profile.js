/**
 * Admin Profile Page
 * Handles profile viewing, editing, and password changes
 */

let currentUser = null;

// Initialize page when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  // Wait for apiFetch to be available
  const checkInterval = setInterval(() => {
    if (typeof apiFetch === 'function') {
      clearInterval(checkInterval);
      initializeProfile();
    }
  }, 100);

  // Timeout after 5 seconds
  setTimeout(() => {
    clearInterval(checkInterval);
    if (!currentUser) {
      console.error('Failed to initialize profile page: apiFetch not available');
    }
  }, 5000);
});

async function initializeProfile() {
  try {
    await loadUserProfile();
    setupEventListeners();
  } catch (error) {
    console.error('Failed to initialize profile:', error);
    showToast('Failed to load profile data', true);
  }
}

async function loadUserProfile() {
  try {
    // Get current user from session cache or API
    let userData = null;
    
    // Try to get from sessionStorage first
    try {
      const cached = sessionStorage.getItem('cached_user');
      if (cached) {
        userData = JSON.parse(cached);
      }
    } catch (e) {
      // Ignore cache errors
    }

    // If not in cache, fetch from API
    if (!userData || !userData.id) {
      // Get current user ID from token payload in auth.js
      // The req.user is set by the server, so we need to get our own user data
      // We'll use the /api/users/me endpoint or get the first user from list
      const response = await apiFetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page: 1, per_page: 1 })
      });
      if (response.data && response.data.length > 0) {
        userData = response.data[0];
      }
    }

    if (!userData || !userData.id) {
      throw new Error('Unable to retrieve user data');
    }

    currentUser = userData;
    populateProfileForm(userData);
    populateUserOverview(userData);
    populateAccountInfo(userData);
    
  } catch (error) {
    console.error('Error loading profile:', error);
    throw error;
  }
}

function populateProfileForm(user) {
  document.getElementById('firstName').value = user.first_name || '';
  document.getElementById('lastName').value = user.last_name || '';
  document.getElementById('email').value = user.email || '';
  document.getElementById('phone').value = user.phone || '';
}

function populateUserOverview(user) {
  // Update avatar with initials
  const avatar = document.getElementById('userAvatar');
  if (avatar) {
    const firstName = user.first_name || '';
    const lastName = user.last_name || '';
    const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
    avatar.textContent = initials || '?';
  }

  // Update user name
  const userName = document.getElementById('userName');
  if (userName) {
    const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim();
    userName.textContent = fullName || 'User';
  }

  // Update user role
  const userRole = document.getElementById('userRole');
  if (userRole) {
    const roleName = user.role_name || 'User';
    userRole.textContent = roleName.charAt(0).toUpperCase() + roleName.slice(1).replace(/_/g, ' ');
  }

  // Update user status badge
  const userStatus = document.getElementById('userStatus');
  const statusText = document.getElementById('statusText');
  if (userStatus && statusText) {
    const status = user.status || 'active';
    const statusConfig = {
      'active': { 
        bg: 'bg-blue-50', 
        text: 'text-blue-700', 
        border: 'border-blue-200', 
        dot: 'bg-blue-600',
        label: 'Active'
      },
      'inactive': { 
        bg: 'bg-slate-100', 
        text: 'text-slate-700', 
        border: 'border-slate-200', 
        dot: 'bg-slate-500',
        label: 'Inactive'
      },
      'pending': { 
        bg: 'bg-amber-50', 
        text: 'text-amber-700', 
        border: 'border-amber-200', 
        dot: 'bg-amber-600',
        label: 'Pending'
      }
    };
    const config = statusConfig[status] || statusConfig['active'];
    
    // Update the status badge styling
    userStatus.className = `inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold ${config.bg} ${config.text} border ${config.border}`;
    
    // Update the dot color
    const dot = userStatus.querySelector('span:first-child');
    if (dot) {
      dot.className = `w-2 h-2 rounded-full ${config.dot} mr-1.5`;
    }
    
    // Update the status text
    statusText.textContent = config.label;
  }

  // Update member since
  const memberSince = document.getElementById('memberSince');
  if (memberSince && user.created_at) {
    const date = new Date(user.created_at);
    memberSince.textContent = date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  }
}

function populateAccountInfo(user) {
  const accountInfo = document.getElementById('accountInfo');
  
  const createdDate = user.created_at ? new Date(user.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }) : 'N/A';

  const roleName = user.role_name || 'User';
  const status = user.status || 'active';
  const statusColors = {
    'active': 'text-emerald-600',
    'inactive': 'text-slate-500',
    'pending': 'text-amber-600'
  };
  const statusColor = statusColors[status] || 'text-slate-600';

  accountInfo.innerHTML = `
    <div class="space-y-3">
      <div class="flex justify-between items-center py-2">
        <span class="text-sm text-slate-600">User ID</span>
        <span class="text-sm font-semibold text-slate-900">#${user.id || 'N/A'}</span>
      </div>
      <div class="flex justify-between items-center py-2 border-t border-slate-100">
        <span class="text-sm text-slate-600">Role</span>
        <span class="text-sm font-semibold text-slate-900 capitalize">${escHtml(roleName.replace(/_/g, ' '))}</span>
      </div>
      <div class="flex justify-between items-center py-2 border-t border-slate-100">
        <span class="text-sm text-slate-600">Status</span>
        <span class="text-sm font-semibold capitalize ${statusColor}">${escHtml(status)}</span>
      </div>
      <div class="flex justify-between items-center py-2 border-t border-slate-100">
        <span class="text-sm text-slate-600">Member Since</span>
        <span class="text-sm font-semibold text-slate-900">${createdDate}</span>
      </div>
      <div class="flex justify-between items-center py-2 border-t border-slate-100">
        <span class="text-sm text-slate-600">User UUID</span>
        <span class="text-xs font-mono text-slate-500 text-right max-w-[150px] truncate" title="${escHtml(user.user_uuid || 'N/A')}">${escHtml(user.user_uuid || 'N/A')}</span>
      </div>
    </div>
  `;
}

function setupEventListeners() {
  // Profile form submission
  const profileForm = document.getElementById('profileForm');
  if (profileForm) {
    profileForm.addEventListener('submit', handleProfileUpdate);
  }

  // Cancel button
  const cancelBtn = document.getElementById('cancelBtn');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      if (currentUser) {
        populateProfileForm(currentUser);
        showToast('Changes discarded');
      }
    });
  }

  // Password form submission
  const passwordForm = document.getElementById('passwordForm');
  if (passwordForm) {
    passwordForm.addEventListener('submit', handlePasswordChange);
  }
}

async function handleProfileUpdate(e) {
  e.preventDefault();
  
  if (!currentUser) {
    showToast('User data not loaded', true);
    return;
  }

  const firstName = document.getElementById('firstName').value.trim();
  const lastName = document.getElementById('lastName').value.trim();
  const phone = document.getElementById('phone').value.trim();

  // Validation
  if (!firstName || !lastName) {
    showToast('First name and last name are required', true);
    return;
  }

  try {
    const updates = {
      first_name: firstName,
      last_name: lastName,
      phone: phone || null
    };

    const result = await apiFetch(`/api/users/${currentUser.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updates)
    });

    if (result.success) {
      // Update local user data
      currentUser = { ...currentUser, ...updates };
      
      // Update cache
      try {
        sessionStorage.setItem('cached_user', JSON.stringify(currentUser));
      } catch (e) {
        // Ignore cache errors
      }

      showToast('Profile updated successfully');
    }
  } catch (error) {
    console.error('Error updating profile:', error);
    showToast(error.message || 'Failed to update profile', true);
  }
}

async function handlePasswordChange(e) {
  e.preventDefault();

  if (!currentUser) {
    showToast('User data not loaded', true);
    return;
  }

  const currentPassword = document.getElementById('currentPassword').value;
  const newPassword = document.getElementById('newPassword').value;
  const confirmPassword = document.getElementById('confirmPassword').value;

  // Validation
  if (!currentPassword || !newPassword || !confirmPassword) {
    showToast('All password fields are required', true);
    return;
  }

  if (newPassword !== confirmPassword) {
    showToast('New passwords do not match', true);
    return;
  }

  if (newPassword.length < 6) {
    showToast('New password must be at least 6 characters', true);
    return;
  }

  try {
    // Note: The current API doesn't have a dedicated password change endpoint
    // This would need to be implemented in the backend
    // For now, we'll show a message that this feature needs backend support
    
    // TODO: Implement password change endpoint in backend
    // For now, we'll simulate the update
    showToast('Password change feature requires backend implementation', true);
    
    // Clear form
    document.getElementById('currentPassword').value = '';
    document.getElementById('newPassword').value = '';
    document.getElementById('confirmPassword').value = '';

  } catch (error) {
    console.error('Error changing password:', error);
    showToast(error.message || 'Failed to change password', true);
  }
}

// Toast notification is already defined in common-ui.js
// This function is here as a fallback if common-ui.js fails to load
function showToast(msg, isErr) {
  if (typeof window.showToast === 'function') {
    window.showToast(msg, isErr);
    return;
  }
  
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
