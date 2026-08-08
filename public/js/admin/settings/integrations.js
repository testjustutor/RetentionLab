/**
 * Admin Settings - Integrations Page
 * Fetches dynamic calendar integration data from calendar_providers and calendar_credentials tables
 */

// API helper
async function apiFetch(url, options = {}) {
  const token = localStorage.getItem('auth_token') || document.cookie.match(/auth_token=([^;]+)/)?.[1];
  
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...options.headers
  };

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include'
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

// Render integration cards
function renderIntegrations(integrations) {
  const container = document.getElementById('integrations-container');
  if (!container) return;

  if (!integrations || integrations.length === 0) {
    container.innerHTML = `
      <div class="bg-slate-900 border border-slate-800 rounded-lg p-8 text-center">
        <svg class="w-12 h-12 mx-auto text-slate-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
        </svg>
        <p class="text-sm text-slate-400">No calendar providers configured</p>
        <p class="text-xs text-slate-500 mt-1">Contact super admin to add calendar providers</p>
      </div>
    `;
    return;
  }

  container.innerHTML = integrations.map(integration => {
    const isActive = integration.is_active === 1;
    const hasCredentials = integration.has_credentials;
    const isConnected = isActive && hasCredentials;
    
    // Determine status badge
    let statusBadge = '';
    if (isConnected) {
      statusBadge = `<span class="px-2 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">Active</span>`;
    } else if (isActive && !hasCredentials) {
      statusBadge = `<span class="px-2 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30">Not Configured</span>`;
    } else {
      statusBadge = `<span class="px-2 py-1 rounded-full text-xs font-medium bg-slate-500/10 text-slate-400 border border-slate-500/30">Inactive</span>`;
    }

    // Determine connection status text
    const connectionText = isConnected ? 'Connected' : (isActive ? 'Not Configured' : 'Disabled');
    const connectionTextClass = isConnected ? 'text-emerald-400' : (isActive ? 'text-amber-400' : 'text-slate-400');

     return `
       <div class="flex items-center justify-between p-3 rounded-md bg-slate-800/30 hover:bg-slate-800/50 transition-colors">
         <div class="flex-1 min-w-0">
           <p class="text-sm font-medium text-slate-200">${escapeHtml(integration.display_name || integration.name)}</p>
           <p class="text-xs ${connectionTextClass} mt-0.5">${connectionText}</p>
           ${hasCredentials ? `
             <p class="text-[11px] text-slate-500 mt-1">
               🔒 Credentials configured via .env file
             </p>
           ` : ''}
         </div>
         <div class="flex items-center gap-2 ml-3">
           ${statusBadge}
         </div>
       </div>
     `;
  }).join('');
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Load integration data
async function loadIntegrations() {
  const container = document.getElementById('integrations-container');
  if (!container) return;

  try {
    // Show loading state
    container.innerHTML = `
      <div class="bg-slate-900 border border-slate-800 rounded-lg p-8 text-center">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-slate-400 mb-3"></div>
        <p class="text-sm text-slate-400">Loading integrations...</p>
      </div>
    `;

    // Fetch integration status
    const response = await apiFetch('/api/admin/calendar-integrations/integration-status');
    
    if (response.success && response.data) {
      renderIntegrations(response.data);
    } else {
      throw new Error('Invalid response format');
    }
  } catch (error) {
    console.error('Failed to load integrations:', error);
    container.innerHTML = `
      <div class="bg-slate-900 border border-red-500/30 rounded-lg p-6 text-center">
        <svg class="w-10 h-10 mx-auto text-red-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <p class="text-sm text-red-400">Failed to load integrations</p>
        <p class="text-xs text-slate-500 mt-1">${escapeHtml(error.message)}</p>
        <button onclick="loadIntegrations()" class="mt-3 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg transition-colors">
          Retry
        </button>
      </div>
    `;
  }
}

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
  // Load integrations when page is ready
  loadIntegrations();

  // Refresh button handler (if exists)
  const refreshBtn = document.getElementById('refresh-integrations-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', loadIntegrations);
  }
});

// Auto-refresh every 30 seconds
setInterval(loadIntegrations, 30000);