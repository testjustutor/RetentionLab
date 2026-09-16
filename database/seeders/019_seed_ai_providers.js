/**
 * root/database/seeders/019_seed_ai_providers.js
 * Seeds the ai_providers table with default provider metadata + model options.
 * These rows drive the Super Admin "AI Providers" page so it renders entirely
 * from the database (no hardcoded cards/options in HTML/JS).
 *
 * Only ONE provider is seeded enabled (openai — matches the AI_PROVIDER
 * fallback default in services/engine/ai_client.py) so a fresh install has
 * an unambiguous single active provider from the start. ai_client.py only
 * trusts the DB when exactly one row is enabled = 1; if more than one row
 * were enabled here, the engine would silently ignore this table and fall
 * back to .env instead.
 *
 * This seeder also runs a NORMALIZE step every time it's executed (not just
 * on first insert), which re-fixes two data issues on rows that already
 * exist from an earlier run of this same seeder:
 *   1. Bad icon values ('ClaudeIcon' / 'OllamaIcon' instead of 'C' / 'L').
 *   2. More than one provider left `enabled = 1` at once (ambiguous for
 *      ai_client.py — see above). Only acts when >1 row is enabled; never
 *      touches an already-unambiguous single-enabled row, so it won't
 *      override an admin's own choice made from the settings page.
 * Both steps only change a row when it still matches the known bad/ambiguous
 * state, so re-running this seeder is always safe.
 *
 * Re-apply on an existing database with: node database/seeders/019_seed_ai_providers.js
 */
const { runAsync, getAsync, allAsync } = require('../seedHelpers');

const DEFAULT_ENABLED_PROVIDER = 'openai';

const ICON_FIXES = [
  { provider_key: 'anthropic', old_icon: 'ClaudeIcon', new_icon: 'C' },
  { provider_key: 'ollama', old_icon: 'OllamaIcon', new_icon: 'L' }
];

const PROVIDERS = [
    {
    provider_key: 'anthropic',
    label: 'Anthropic Claude',
    icon: 'C',
    icon_bg: 'from-amber-600 to-orange-700',
    description: 'Frontier intelligence and deep reasoning',
    base_url: 'https://anthropic.com',
    enabled: 0,
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
    enabled: 0,
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
    enabled: 1, // The single default-enabled provider — matches ai_client.py's .env fallback default
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
    icon: 'L',
    icon_bg: 'from-zinc-700 to-zinc-900',
    description: 'Privacy-focused local models',
    base_url: 'http://localhost:11434/v1',
    enabled: 0,
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

  await normalizeExistingRows();

  console.log('[Seeder] ai_providers seeder complete.');
};

// Fixes for rows that were already inserted by a PRIOR run of this seeder.
// Runs every time (unlike the insert loop above, which skips existing rows)
// so a database seeded before a fix landed here gets corrected too.
const normalizeExistingRows = async () => {
  // 1) Bad icon values from an earlier version of this seeder.
  for (const fix of ICON_FIXES) {
    const row = await getAsync('SELECT id, icon FROM ai_providers WHERE provider_key = ?', [fix.provider_key]);
    if (!row || row.icon !== fix.old_icon) continue;
    await runAsync('UPDATE ai_providers SET icon = ?, updated_at = NOW() WHERE id = ?', [fix.new_icon, row.id]);
    console.log(`  ✓ ai_provider '${fix.provider_key}'.icon fixed: "${fix.old_icon}" -> "${fix.new_icon}"`);
  }

  // 2) More than one provider left enabled at once (ambiguous — see module
  //    docblock). Only acts when the ambiguous state is found.
  const enabledRows = await allAsync('SELECT id, provider_key FROM ai_providers WHERE enabled = 1');
  if (enabledRows.length > 1) {
    console.log(
      `  ⚠ ${enabledRows.length} ai_providers rows are enabled at once ` +
      `(${enabledRows.map(r => r.provider_key).join(', ')}) — disabling all except '${DEFAULT_ENABLED_PROVIDER}'`
    );
    for (const row of enabledRows) {
      if (row.provider_key === DEFAULT_ENABLED_PROVIDER) continue;
      await runAsync('UPDATE ai_providers SET enabled = 0, updated_at = NOW() WHERE id = ?', [row.id]);
      console.log(`  ✓ ai_provider '${row.provider_key}'.enabled fixed: 1 -> 0`);
    }
    const stillHasDefault = enabledRows.some(r => r.provider_key === DEFAULT_ENABLED_PROVIDER);
    if (!stillHasDefault) {
      await runAsync('UPDATE ai_providers SET enabled = 1, updated_at = NOW() WHERE provider_key = ?', [DEFAULT_ENABLED_PROVIDER]);
      console.log(`  ✓ ai_provider '${DEFAULT_ENABLED_PROVIDER}'.enabled fixed: 0 -> 1 (set as the single active provider)`);
    }
  }
};

// Run if called directly
if (require.main === module) {
  seedAiProviders().catch((err) => {
    console.error('[Seeder] ai_providers failed:', err);
    process.exit(1);
  });
}

module.exports = { seedAiProviders };