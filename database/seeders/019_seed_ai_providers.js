/**
 * root/database/seeders/019_seed_ai_providers.js
 * Seeds the ai_providers table with default provider metadata + model options.
 * These rows drive the Super Admin "AI Providers" page so it renders entirely
 * from the database (no hardcoded cards/options in HTML/JS).
 */
const { runAsync, getAsync, allAsync } = require('../seedHelpers');

const PROVIDERS = [
    {
    provider_key: 'anthropic',
    label: 'Anthropic Claude',
    icon: 'ClaudeIcon',
    icon_bg: 'from-amber-600 to-orange-700',
    description: 'Frontier intelligence and deep reasoning',
    base_url: 'https://anthropic.com',
    enabled: 1,
    default_model: 'claude-5-sonnet',
    default_temperature: 0.7,
    default_max_tokens: 4096,
    model_options: [
      { value: 'claude-fable-5', label: 'Claude 5 Fable' },
      { value: 'claude-5-sonnet', label: 'Claude 5 Sonnet' },
      { value: 'claude-opus-5', label: 'Claude 5 Opus' },
      { value: 'claude-haiku-4.5', label: 'Claude 4.5 Haiku' }
    ],
    sort_order: 1
  },
  {
    provider_key: 'gemini',
    label: 'Google Gemini',
    icon: 'G',
    icon_bg: 'from-blue-500 to-cyan-600',
    description: 'Advanced reasoning, coding, and multi-step agent workflows.',
    base_url: 'https://generativelanguage.googleapis.com',
    enabled: 1, // Set to 1 to enable it immediately
    default_model: 'gemini-3.7-flash',
    default_temperature: 0.2, // Great for consistent, reliable code logic
    default_max_tokens: 8192,  // Increased from 2048 to handle larger code generations
    model_options: [
      { value: 'gemini-3.7-flash', label: 'Gemini 3.7 Flash (Coding & Agents)' },
      { value: 'gemini-3.1-pro', label: 'Gemini 3.1 Pro (Large Monorepos)' },
      { value: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash (Fast Stable)' },
      { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (Legacy Production)' }
    ],
    sort_order: 2
  },
  {
    provider_key: 'openai',
    label: 'OpenAI',
    icon: 'O',
    icon_bg: 'from-green-500 to-emerald-600',
    description: 'Frontier reasoning, agentic coding, and multi-step orchestration.',
    base_url: 'https://api.openai.com/v1',
    enabled: 1, // Set to 1 to activate the provider instantly
    default_model: 'gpt-5.4-mini', // The leading fast, cost-effective model for subagents and coding
    default_temperature: 0.2, // Low temperature ensures accurate and structured code output
    default_max_tokens: 16384, // Expanded to support large code generation files without truncation
    model_options: [
      { value: 'gpt-5.4-mini', label: 'GPT-5.4 Mini (Fast Coding & Subagents)' },
      { value: 'gpt-5.5', label: 'GPT-5.5 Flagship (Agentic Workflows)' },
      { value: 'o3', label: 'OpenAI o3 (Deep Math, Code & Science Reasoning)' },
      { value: 'gpt-4o', label: 'GPT-4o (Legacy General-Purpose)' }
    ],
    sort_order: 3
  },  
  {
    provider_key: 'ollama',
    label: 'Ollama (Local)',
    icon: 'OllamaIcon',
    icon_bg: 'from-zinc-700 to-zinc-900',
    description: 'Privacy-focused local models',
    base_url: 'http://localhost:11434/v1',
    enabled: 1,
    default_model: 'llama3.3',
    default_temperature: 0.7,
    default_max_tokens: 4096,
    model_options: [
      { value: 'llama3.3', label: 'Llama 3.3 (70B)' },
      { value: 'llama3.2', label: 'Llama 3.2 (3B)' },
      { value: 'qwen2.5', label: 'Qwen 2.5' },
      { value: 'mistral', label: 'Mistral 7B' }
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