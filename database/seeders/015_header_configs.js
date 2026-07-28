/**
 * root/database/seeders/015_header_configs.js
 * Seeds header configuration data (logos, titles, themes, etc.)
 */
const { runAsync, getAsync } = require('../seedHelpers');

const HEADER_CONFIGS = [
  {
    config_key: 'app_logo',
    config_json: JSON.stringify({
      light: '/images/logo-light.png',
      dark: '/images/logo-dark.png',
      favicon: '/favicon.ico',
      alt_text: 'RetentionLab'
    }),
    description: 'Application logo and branding'
  },
  {
    config_key: 'app_title',
    config_json: JSON.stringify({
      default: 'RetentionLab',
      separator: ' | ',
      show_page_title: true
    }),
    description: 'Application title configuration'
  },
  {
    config_key: 'header_theme',
    config_json: JSON.stringify({
      background: 'slate-950',
      border_color: 'slate-800',
      text_color: 'white',
      height: 'auto',
      sticky: true,
      shadow: true
    }),
    description: 'Header visual theme settings'
  },
  {
    config_key: 'header_navigation',
    config_json: JSON.stringify({
      show_search: true,
      show_notifications: true,
      show_messages: false,
      show_help: true,
      max_menu_items: 10
    }),
    description: 'Header navigation features'
  },
  {
    config_key: 'user_menu',
    config_json: JSON.stringify({
      show_profile: true,
      show_settings: true,
      show_switch_role: true,
      show_logout: true,
      show_theme_toggle: true
    }),
    description: 'User dropdown menu items'
  }
];

const seedHeaderConfigs = async () => {
  console.log('[Seed] Starting header_configs seed...');

  const { count } = await getAsync(`SELECT COUNT(*) as count FROM header_configs`);
  if (count > 0) {
    console.log(`[Seed] header_configs already seeded (${count} records found), skipping...`);
    return;
  }

  for (const config of HEADER_CONFIGS) {
    await runAsync(
      `INSERT INTO header_configs (config_key, config_json, description, created_at, updated_at)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [config.config_key, config.config_json, config.description]
    );
  }

  console.log(`[Seed] ✓ header_configs seeded successfully (${HEADER_CONFIGS.length} configs)`);
};

module.exports = { seedHeaderConfigs, HEADER_CONFIGS };

// Run seeder if executed directly
if (require.main === module) {
  seedHeaderConfigs()
    .then(() => {
      console.log('[Seed] ✓ Header configs seeder completed successfully');
      process.exit(0);
    })
    .catch(err => {
      console.error('[Seed] ✗ Header configs seeder failed:', err);
      process.exit(1);
    });
}
