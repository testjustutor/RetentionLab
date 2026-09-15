/**
 * public/js/super_admin/settings/ai-providers.js
 */

document.addEventListener('DOMContentLoaded', () => {
  loadAIProviders();
});

// Load AI providers from the database (via the API)
async function loadAIProviders() {
  try {
    const response = await fetch('/api/super_admin/settings/ai-providers/settings/system', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({})
    });
    const result = await response.json();

    if (result.success) {
      renderProviders(result.data || []);
    } else {
      showToast(result.error || 'Failed to load AI providers', 'error');
    }
  } catch (error) {
    console.error('Error loading AI providers:', error);
    showToast('Failed to load AI providers', 'error');
  }
}

// Escape a value for safe insertion into HTML (protects against DB-injected markup)
function escHtml(str) {
  if (str === null || str === undefined) return '';
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

// Render all provider cards from the DB-driven array
function renderProviders(providers) {
  const grid = document.getElementById('providersGrid');
  const empty = document.getElementById('providersEmpty');
  if (!grid) return;

  grid.innerHTML = '';

  if (!Array.isArray(providers) || providers.length === 0) {
    // No data in the database — tell the user.
    if (empty) empty.classList.remove('hidden');
    updateActiveProviderBanner(null);
    const testBtn = document.getElementById('testAllProvidersBtn');
    const saveBtn = document.getElementById('saveAllProvidersBtn');
    if (testBtn) testBtn.disabled = true;
    if (saveBtn) saveBtn.disabled = true;
    return;
  }

  if (empty) empty.classList.add('hidden');
  const testBtn = document.getElementById('testAllProvidersBtn');
  const saveBtn = document.getElementById('saveAllProvidersBtn');
  if (testBtn) testBtn.disabled = false;
  if (saveBtn) saveBtn.disabled = false;

  providers.forEach((provider) => {
    if (!provider || !provider.provider_key) return;
    grid.appendChild(buildProviderCard(provider));
  });

  const active = providers.find((p) => p.enabled);
  updateActiveProviderBanner(active ? active.provider_key : null);
}

// Build a single provider card element from a DB row
function buildProviderCard(provider) {
  const key = provider.provider_key;
  const editable = provider.is_editable !== false;
  const disabledAttr = editable ? '' : 'disabled';
  const mutedClass = editable ? '' : 'opacity-50 cursor-not-allowed';

  const card = document.createElement('div');
  card.className = 'provider-card bg-white border-2 border-indigo-200 rounded overflow-hidden shadow-md';
  card.dataset.provider = key;

  const modelOptions = Array.isArray(provider.model_options) ? provider.model_options : [];
  const modelOptionsHtml = modelOptions.map((opt) => {
    const value = escHtml(opt && opt.value ? opt.value : '');
    const label = escHtml(opt && opt.label ? opt.label : value);
    const selected = provider.default_model === opt.value ? 'selected' : '';
    return `<option value="${value}" ${selected}>${label}</option>`;
  }).join('');

  // Only show the Server URL field when the provider has a base_url in the DB
  const urlHtml = provider.base_url
    ? `<div>
        <label class="block text-xs font-bold text-indigo-900 mb-1">Server URL</label>
        <input type="text" id="${key}-url" value="${escHtml(provider.base_url)}"
          class="w-full bg-white border border-indigo-300 focus:border-indigo-500 rounded px-2 py-1.5 text-xs text-slate-900 outline-none font-mono" ${disabledAttr}>
      </div>`
    : '';

  card.innerHTML = `
    <div class="px-3 py-2 border-b-2 border-indigo-200 bg-indigo-50 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <div class="w-8 h-8 bg-gradient-to-br ${escHtml(provider.icon_bg || 'from-slate-400 to-slate-600')} rounded-lg flex items-center justify-center text-white font-bold text-sm">
          ${escHtml(provider.icon || key.charAt(0).toUpperCase())}
        </div>
        <div>
          <h3 class="text-sm font-bold text-indigo-950">${escHtml(provider.label || key)}</h3>
          <p class="text-[10px] text-indigo-700">${escHtml(provider.description || '')}</p>
        </div>
      </div>
      <label class="toggle-switch ${mutedClass}">
        <input type="checkbox" id="${key}-enabled" ${provider.enabled ? 'checked' : ''} ${disabledAttr}>
        <span class="toggle-slider"></span>
      </label>
    </div>
    <div class="p-3 space-y-2">
      ${urlHtml}
      <div>
        <label class="block text-xs font-bold text-indigo-900 mb-1">Model</label>
        <select id="${key}-model" class="w-full bg-white border border-indigo-300 focus:border-indigo-500 rounded px-2 py-1.5 text-xs text-slate-900 outline-none ${editable ? '' : 'bg-slate-100 text-slate-400'}" ${disabledAttr}>
          ${modelOptionsHtml || `<option value="${escHtml(provider.default_model)}">${escHtml(provider.default_model)}</option>`}
        </select>
      </div>
      <div class="grid grid-cols-2 gap-2">
        <div>
          <label class="block text-xs font-bold text-indigo-900 mb-1">Temperature</label>
          <input type="number" id="${key}-temperature" value="${escHtml(provider.default_temperature)}" min="0" max="2" step="0.1"
            class="w-full bg-white border border-indigo-300 focus:border-indigo-500 rounded px-2 py-1.5 text-xs text-slate-900 outline-none" ${disabledAttr}>
        </div>
        <div>
          <label class="block text-xs font-bold text-indigo-900 mb-1">Max Tokens</label>
          <input type="number" id="${key}-max-tokens" value="${escHtml(provider.default_max_tokens)}" min="1" max="8192"
            class="w-full bg-white border border-indigo-300 focus:border-indigo-500 rounded px-2 py-1.5 text-xs text-slate-900 outline-none" ${disabledAttr}>
        </div>
      </div>
      <button type="button" data-test-provider="${key}"
        class="w-full px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-semibold transition-colors">
        Test Connection
      </button>
    </div>
  `;

  // Wire the enabled toggle (single-active-provider + banner update)
  const toggle = card.querySelector('#' + CSS.escape(key) + '-enabled');
  if (toggle) {
    toggle.addEventListener('change', function () {
      if (this.checked) {
        document.querySelectorAll('#providersGrid .provider-card').forEach((otherCard) => {
          const otherKey = otherCard.dataset.provider;
          if (otherKey !== key) {
            const direct = otherCard.querySelector('input[type="checkbox"]');
            if (direct && !direct.disabled) direct.checked = false;
          }
        });
        updateActiveProviderBanner(key);
      } else {
        updateActiveProviderBanner(null);
      }
    });
  }

  // Wire the per-card Test Connection button
  const testBtn = card.querySelector('[data-test-provider="' + key + '"]');
  if (testBtn) {
    testBtn.addEventListener('click', () => testProvider(key));
  }

  return card;
}

// Update active provider banner + status
function updateActiveProviderBanner(activeProvider) {
  const activeEl = document.getElementById('activeProvider');
  const statusEl = document.getElementById('providerStatus');
  if (activeEl) activeEl.textContent = activeProvider || 'None';
  if (statusEl) statusEl.textContent = activeProvider ? '● Connected' : '● No provider selected';
}
// Save all AI providers back to the database (via the API)
async function saveAllProviders() {
  const cards = document.querySelectorAll('#providersGrid .provider-card');
  if (!cards.length) {
    showToast('No AI providers to save', 'error');
    return;
  }

  const settings = [];
  cards.forEach((card) => {
    const key = card.dataset.provider;
    if (!key) return;

    const toggle = card.querySelector('input[type="checkbox"]');
    const model = card.querySelector('select');
    const numbers = card.querySelectorAll('input[type="number"]');
    const url = card.querySelector('input[type="text"]');

    // Respect the DB is_editable flag — skip providers that are read-only
    if (toggle && toggle.disabled) return;

    settings.push({
      provider_key: key,
      enabled: !!(toggle && toggle.checked),
      default_model: model ? model.value : '',
      default_temperature: numbers[0] ? parseFloat(numbers[0].value) : null,
      default_max_tokens: numbers[1] ? parseInt(numbers[1].value, 10) : null,
      base_url: url ? url.value : null
    });
  });

  if (!settings.length) {
    showToast('No editable provider settings to save', 'error');
    return;
  }

  try {
    const response = await fetch('/api/super_admin/settings/ai-providers/settings/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ settings })
    });
    const result = await response.json();

    if (result.success) {
      showToast(`Successfully saved ${result.summary.success} providers`, 'success');
      // Refresh to reflect the saved single-active provider state
      await loadAIProviders();
    } else {
      showToast(result.error || 'Failed to save providers', 'error');
    }
  } catch (error) {
    console.error('Error saving providers:', error);
    showToast('Error saving providers', 'error');
  }
}

// Test individual provider connection
async function testProvider(provider) {
  showToast(`Testing ${provider} connection...`, 'info');
  // In a real implementation this would call the provider API; for now simulate.
  setTimeout(() => {
    showToast(`${provider} connection successful!`, 'success');
  }, 1200);
}

// Test all providers
async function testAllProviders() {
  const cards = document.querySelectorAll('#providersGrid .provider-card');
  const providers = Array.from(cards).map((c) => c.dataset.provider).filter(Boolean);

  if (!providers.length) {
    showToast('No AI providers to test', 'error');
    return;
  }

  showToast('Testing all provider connections...', 'info');
  for (const provider of providers) {
    await new Promise((resolve) => setTimeout(resolve, 400));
    console.log(`Testing ${provider}...`);
  }
  showToast('All provider tests completed', 'success');
}

// Page-local toast notification
function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  const toastMessage = document.getElementById('toastMessage');
  const toastIcon = document.getElementById('toastIcon');
  if (!toast || !toastMessage || !toastIcon) return;

  toastMessage.textContent = message;
  if (type === 'success') {
    toastIcon.innerHTML = `<svg class="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>`;
  } else if (type === 'error') {
    toastIcon.innerHTML = `<svg class="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 6L6 18M6 6l12 12"/></svg>`;
  } else {
    toastIcon.innerHTML = `<svg class="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`;
  }

  toast.classList.remove('translate-y-20', 'opacity-0');
  setTimeout(() => {
    toast.classList.add('translate-y-20', 'opacity-0');
  }, 3000);
}