/**
 * root/database/seeders/019_seed_ai_providers.js
 * Seeds the ai_providers table with default provider metadata + model options.
 * These rows drive the Super Admin "AI Providers" page so it renders entirely
 * from the database (no hardcoded cards/options in HTML/JS).
 */
const { runAsync, getAsync, allAsync } = require('../seedHelpers');

const PROVIDERS = [
  {
    provider_key: 'cloude',
    label: 'cloude',
    icon: 'G',
    icon_bg: 'from-orange-500 to-red-600',
    description: 'Ultra-fast inference',
    base_url: 'https://api.cloude.com/v1',
    enabled: 1,
    default_model: 'llama-3.1-8b-instant',
    default_temperature: 0.2,
    default_max_tokens: 2048,
    model_options: [
      { value: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B Versatile' },
      { value: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B Instant' },
      { value: 'gemma2-9b-it', label: 'Gemma 2 9B IT' },
      { value: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B' }
    ],
    sort_order: 1
  },
  {
    provider_key: 'gemini',
    label: 'Google Gemini',
    icon: 'G',
    icon_bg: 'from-blue-500 to-cyan-600',
    description: 'Advanced reasoning',
    base_url: 'https://generativelanguage.googleapis.com',
    enabled: 0,
    default_model: 'gemini-2.5-flash',
    default_temperature: 0.2,
    default_max_tokens: 2048,
    model_options: [
      { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
      { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
      { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
      { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' }
    ],
    sort_order: 2
  },
  {
    provider_key: 'openai',
    label: 'OpenAI',
    icon: 'O',
    icon_bg: 'from-green-500 to-emerald-600',
    description: 'GPT-4o & GPT-4',
    base_url: 'https://api.openai.com/v1',
    enabled: 0,
    default_model: 'gpt-4o-mini',
    default_temperature: 0.2,
    default_max_tokens: 2048,
    model_options: [
      { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
      { value: 'gpt-4o', label: 'GPT-4o' },
      { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
      { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' }
    ],
    sort_order: 3
  },
  {
    provider_key: 'ollama',
    label: 'Ollama (Local)',
    icon: 'O',
    icon_bg: 'from-purple-500 to-pink-600',
    description: 'Self-hosted models',
    base_url: 'http://localhost:11434/v1',
    enabled: 0,
    default_model: 'llama3.1',
    default_temperature: 0.2,
    default_max_tokens: 2048,
    model_options: [
      { value: 'llama3.1', label: 'Llama 3.1' },
      { value: 'llama3.2', label: 'Llama 3.2' },
      { value: 'mistral', label: 'Mistral' },
      { value: 'codellama', label: 'Code Llama' }
    ],
    sort_order: 4
  }
];

const seedAiProviders = async () => {
  console.log('[Seeder] Starting ai_providers seeder...');

  for (const p of PROVIDERS) {
    const existing = await getAsync('SELECT id FROM ai_providers WHERE provider_key = ? LIMIT 1', [p.provider_key]);
    if (existing) {
      console.log(`  ↻ ai_provider '${p.provider_key}' already exists, skipping`);
      continue;
    }

    await runAsync(
      `INSERT INTO ai_providers
        (provider_key, label, icon, icon_bg, description, base_url, enabled,
         default_model, default_temperature, default_max_tokens, model_options,
         is_editable, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      [
        p.provider_key, p.label, p.icon, p.icon_bg, p.description, p.base_url, p.enabled,
        p.default_model, p.default_temperature, p.default_max_tokens,
        JSON.stringify(p.model_options), p.sort_order
      ]
    );
    console.log(`  ✓ ai_provider '${p.provider_key}' created`);
  }

  console.log('[Seeder] ai_providers seeder complete.');
};

// Run if called directly
if (require.main === module) {
  seedAiProviders().catch((err) => {
    console.error('[Seeder] ai_providers failed:', err);
    process.exit(1);
  });
}

module.exports = { seedAiProviders };