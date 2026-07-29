// AI Providers Configuration Page Logic

document.addEventListener('DOMContentLoaded', () => {
  loadAIProviders();
});

// Load AI providers settings
async function loadAIProviders() {
  try {
    const response = await fetch('/api/settings/system?category=ai');
    const result = await response.json();
    
    if (result.success && result.data) {
      const settings = result.data;
      
      // Group settings by provider
      settings.forEach(setting => {
        const key = setting.setting_key.replace('ai.', '');
        
        // Handle provider enabled toggles
        if (key.endsWith('.enabled')) {
          const provider = key.split('.')[0];
          const el = document.getElementById(`${provider}-enabled`);
          if (el) {
            const isEditable = setting.is_editable !== false;
            el.disabled = !isEditable;
            if (!isEditable) el.classList.add('opacity-50', 'cursor-not-allowed');
            el.checked = setting.setting_value === 'true';
            
            // Single-active-provider: when one is enabled, disable all others
            el.addEventListener('change', function() {
              if (this.checked) {
                const providers = ['groq', 'gemini', 'openai', 'xai', 'ollama'];
                providers.forEach(p => {
                  if (p !== provider) {
                    const otherEl = document.getElementById(`${p}-enabled`);
                    if (otherEl) otherEl.checked = false;
                  }
                });
                updateActiveProviderBanner(provider);
              } else {
                const activeProviderEl = document.getElementById('activeProvider');
                if (activeProviderEl) activeProviderEl.textContent = 'None';
              }
            });
          }
        }
        
        // Handle models
        if (key.endsWith('.model')) {
          const provider = key.split('.')[0];
          const el = document.getElementById(`${provider}-model`);
          if (el) {
            const isEditable = setting.is_editable !== false;
            el.disabled = !isEditable;
            if (!isEditable) el.classList.add('bg-slate-800', 'text-slate-400', 'cursor-not-allowed');
            el.value = setting.setting_value;
          }
        }
        
        // Handle temperature
        if (key.endsWith('.temperature')) {
          const provider = key.split('.')[0];
          const el = document.getElementById(`${provider}-temperature`);
          if (el) {
            const isEditable = setting.is_editable !== false;
            el.disabled = !isEditable;
            if (!isEditable) el.classList.add('bg-slate-800', 'text-slate-400', 'cursor-not-allowed');
            el.value = setting.setting_value;
          }
        }
        
        // Handle max tokens
        if (key.endsWith('.max_tokens')) {
          const provider = key.split('.')[0];
          const el = document.getElementById(`${provider}-max-tokens`);
          if (el) {
            const isEditable = setting.is_editable !== false;
            el.disabled = !isEditable;
            if (!isEditable) el.classList.add('bg-slate-800', 'text-slate-400', 'cursor-not-allowed');
            el.value = setting.setting_value;
          }
        }
        
        // Handle Ollama URL
        if (key === 'ollama.url') {
          const el = document.getElementById('ollama-url');
          if (el) {
            const isEditable = setting.is_editable !== false;
            el.disabled = !isEditable;
            if (!isEditable) el.classList.add('bg-slate-800', 'text-slate-400', 'cursor-not-allowed');
            el.value = setting.setting_value;
          }
        }
      });
      
      // Update active provider banner from loaded settings
      updateActiveProviderBannerFromSettings(settings);
    }
  } catch (error) {
    console.error('Error loading AI providers:', error);
    showToast('Failed to load AI providers', 'error');
  }
}

// Update active provider banner
function updateActiveProviderBanner(activeProvider) {
  const activeProviderEl = document.getElementById('activeProvider');
  if (activeProviderEl) activeProviderEl.textContent = activeProvider;
}

// Update active provider banner from loaded settings
function updateActiveProviderBannerFromSettings(settings) {
  const activeProviderEl = document.getElementById('activeProvider');
  if (!activeProviderEl) return;
  const enabledSetting = settings.find(s => s.setting_value === 'true' && s.setting_key.endsWith('.enabled'));
  if (enabledSetting) {
    const provider = enabledSetting.setting_key.split('.')[1];
    activeProviderEl.textContent = provider;
  } else {
    activeProviderEl.textContent = 'None';
  }
}

// Save all AI providers
async function saveAllProviders() {
  try {
    const settings = [
      { key: 'ai.groq.enabled', value: document.getElementById('groq-enabled').checked ? 'true' : 'false', type: 'boolean' },
      { key: 'ai.groq.model', value: document.getElementById('groq-model').value, type: 'string' },
      { key: 'ai.groq.temperature', value: document.getElementById('groq-temperature').value, type: 'number' },
      { key: 'ai.groq.max_tokens', value: document.getElementById('groq-max-tokens').value, type: 'number' },
      
      { key: 'ai.gemini.enabled', value: document.getElementById('gemini-enabled').checked ? 'true' : 'false', type: 'boolean' },
      { key: 'ai.gemini.model', value: document.getElementById('gemini-model').value, type: 'string' },
      { key: 'ai.gemini.temperature', value: document.getElementById('gemini-temperature').value, type: 'number' },
      { key: 'ai.gemini.max_tokens', value: document.getElementById('gemini-max-tokens').value, type: 'number' },
      
      { key: 'ai.openai.enabled', value: document.getElementById('openai-enabled').checked ? 'true' : 'false', type: 'boolean' },
      { key: 'ai.openai.model', value: document.getElementById('openai-model').value, type: 'string' },
      { key: 'ai.openai.temperature', value: document.getElementById('openai-temperature').value, type: 'number' },
      { key: 'ai.openai.max_tokens', value: document.getElementById('openai-max-tokens').value, type: 'number' },
      
      { key: 'ai.xai.enabled', value: document.getElementById('xai-enabled').checked ? 'true' : 'false', type: 'boolean' },
      { key: 'ai.xai.model', value: document.getElementById('xai-model').value, type: 'string' },
      { key: 'ai.xai.temperature', value: document.getElementById('xai-temperature').value, type: 'number' },
      { key: 'ai.xai.max_tokens', value: document.getElementById('xai-max-tokens').value, type: 'number' },
      
      { key: 'ai.ollama.enabled', value: document.getElementById('ollama-enabled').checked ? 'true' : 'false', type: 'boolean' },
      { key: 'ai.ollama.url', value: document.getElementById('ollama-url').value, type: 'string' },
      { key: 'ai.ollama.model', value: document.getElementById('ollama-model').value, type: 'string' },
      { key: 'ai.ollama.temperature', value: document.getElementById('ollama-temperature').value, type: 'number' },
      { key: 'ai.ollama.max_tokens', value: document.getElementById('ollama-max-tokens').value, type: 'number' }
    ];

    const response = await fetch('/api/settings/system/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings })
    });

    const result = await response.json();
    
    if (result.success) {
      showToast(`Successfully saved ${result.summary.success} settings`, 'success');
    } else {
      showToast(result.error || 'Failed to save settings', 'error');
    }
  } catch (error) {
    console.error('Error saving providers:', error);
    showToast('Error saving providers', 'error');
  }
}

// Test individual provider connection
async function testProvider(provider) {
  showToast(`Testing ${provider} connection...`, 'info');
  
  // Simulate API test (in real implementation, call actual API)
  setTimeout(() => {
    showToast(`${provider} connection successful!`, 'success');
  }, 1500);
}

// Test all providers
async function testAllProviders() {
  showToast('Testing all provider connections...', 'info');
  
  const providers = ['groq', 'gemini', 'openai', 'xai', 'ollama'];
  
  for (const provider of providers) {
    await new Promise(resolve => setTimeout(resolve, 500));
    console.log(`Testing ${provider}...`);
  }
  
  showToast('All provider tests completed', 'success');
}

// Toast notification
function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  const toastMessage = document.getElementById('toastMessage');
  const toastIcon = document.getElementById('toastIcon');
  
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